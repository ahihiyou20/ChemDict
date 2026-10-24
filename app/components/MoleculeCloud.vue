<script setup lang="ts">
import type { StageHandle } from '~/lib/molecule-client'
import type { FrameState, StageLayout } from '~/lib/molecule-scene'
import { ACETYLENE, BENZENE, ETHYLENE, GAS, METHANE } from '~/lib/molecules'

/** loading → animated, or still (reduced motion, software GPU, slow device), or unavailable. */
type Tier = 'loading' | 'animated' | 'still' | 'unavailable'

// Each molecule on the stage is a dictionary entry, and its caption links there.
const captions: Record<number, { formula: [string, string][]; name: string; slug: string }> = {
  [BENZENE]: { formula: [['C', '6'], ['H', '6']], name: 'Aromatic compound', slug: 'aromatic-compound' },
  [METHANE]: { formula: [['C', ''], ['H', '4']], name: 'Alkane', slug: 'alkane' },
  [ETHYLENE]: { formula: [['C', '2'], ['H', '4']], name: 'Alkene', slug: 'alkene' },
  [ACETYLENE]: { formula: [['C', '2'], ['H', '2']], name: 'Alkyne', slug: 'alkyne' },
}
const sequence = [BENZENE, METHANE, ETHYLENE, ACETYLENE]

const searchActive = useState('search-active', () => false)
const stage = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
// A canvas handed to a worker cannot be used again, so a failed worker gets a fresh one.
const canvasKey = ref(0)
const tier = ref<Tier>('loading')
const showing = ref(BENZENE)
const caption = computed(() => captions[showing.value]!)

let teardown: (() => void) | undefined
let stopWaiting: (() => void) | undefined
let disposed = false

onMounted(() => {
  // The scene waits for a quiet moment: the page idle, no lookup under way and no key pressed for
  // a while. A reader who came to look something up types first, so the scene (and the GPU time
  // its first frame takes) never lands under their lookup. A lookup that starts while the scene is
  // still being built drops it (the worker is terminated); it is rebuilt once the field is clear.
  const QUIET_MS = 1200
  let lastKey = performance.now()
  const onKey = () => void (lastKey = performance.now())
  window.addEventListener('keydown', onKey, { capture: true, passive: true })
  const whenQuiet = (run: () => void) => {
    const wait = QUIET_MS - (performance.now() - lastKey)
    if (wait > 0) setTimeout(() => whenQuiet(run), wait)
    else if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1500 })
    else setTimeout(run, 0)
  }
  let building: AbortController | undefined
  const begin = () => {
    if (disposed || building || searchActive.value || tier.value !== 'loading') return
    if (performance.now() - lastKey < QUIET_MS) return whenQuiet(begin)
    const controller = new AbortController()
    building = controller
    mount(controller.signal)
      .then(() => {
        if (tier.value !== 'loading') window.removeEventListener('keydown', onKey, { capture: true })
      })
      .catch(() => {
        // No WebGPU and no WebGL2: the hero simply stays typographic.
        if (!controller.signal.aborted) tier.value = 'unavailable'
      })
      .finally(() => {
        if (building === controller) building = undefined
      })
  }
  const stopSearch = watch(searchActive, (active) => {
    if (tier.value !== 'loading') return
    if (active && building) {
      building.abort()
      building = undefined
      canvasKey.value++
    } else if (!active) whenQuiet(begin)
  })
  stopWaiting = () => {
    stopSearch()
    window.removeEventListener('keydown', onKey, { capture: true })
  }
  whenQuiet(begin)
})

async function connect(still: boolean, signal: AbortSignal): Promise<StageHandle | undefined> {
  const client = await import('~/lib/molecule-client')
  if (signal.aborted) return
  const options = { still, devicePixelRatio: window.devicePixelRatio }
  const onLost = () => {
    tier.value = 'unavailable'
    teardown?.()
  }
  if (!canvas.value || disposed) return
  if (client.canDrawOffThread(canvas.value)) {
    try {
      // three.js is parsed and drawn in a worker, so it never blocks typing on the main thread.
      return await client.startInWorker(canvas.value, options, onLost, signal)
    } catch (error) {
      if (!(error instanceof client.OffThreadFailed)) throw error
      canvasKey.value++
      await nextTick()
      if (!canvas.value || disposed || signal.aborted) return
    }
  }
  return client.startOnMainThread(canvas.value, { ...options, onLost })
}

/** Where the molecule sits: right of the title on wide screens, behind it on narrow ones. */
function layoutOf(host: HTMLElement): StageLayout {
  const width = host.clientWidth
  const height = host.clientHeight
  const wide = width >= 860
  return { width, height, focus: wide ? [0.4, 0.08] : [0.3, 0.32], size: wide ? 0.78 : 0.6 }
}

async function mount(signal: AbortSignal) {
  if (!canvas.value || !stage.value) return
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  const [active, motion] = await Promise.all([connect(reducedMotion, signal), loadMotion()])
  if (!active) return
  if (disposed || signal.aborted) {
    active.dispose()
    return
  }
  const { gsap, ScrollTrigger } = motion
  const host = stage.value

  let frozen = reducedMotion || active.isSoftware
  let running = false
  const state: Omit<FrameState, 'delta'> = {
    reveal: 0,
    pointer: [0, 0],
    pointerOn: false,
    from: frozen ? BENZENE : GAS,
    to: BENZENE,
    morph: frozen ? 1 : 0,
    disperse: 0,
  }
  // GSAP tags its tween targets with internal data, so frames copy the fields rather than the object.
  const snapshot = (delta: number): FrameState => ({
    delta,
    reveal: state.reveal,
    pointer: state.pointer,
    pointerOn: state.pointerOn,
    from: state.from,
    to: state.to,
    morph: state.morph,
    disperse: state.disperse,
  })
  // A still is drawn at most once a frame, and not at all while a lookup hides the stage: on a
  // software GPU each draw holds the compositor for hundreds of milliseconds.
  let stillQueued = false
  let stillOwed = false
  const drawStill = () => {
    if (searchActive.value) return void (stillOwed = true)
    if (stillQueued) return
    stillQueued = true
    requestAnimationFrame(() => {
      stillQueued = false
      if (!disposed) active.frame(snapshot(0))
    })
  }

  const fit = () => {
    active.resize(layoutOf(host))
    if (frozen) drawStill()
  }
  const resizeObserver = new ResizeObserver(fit)
  resizeObserver.observe(host)

  // The choreography: the gas condenses into benzene, then every few seconds the cloud dissolves
  // into the next hydrocarbon of Bài 10. Its clock stops whenever the stage is not drawing.
  const clock = gsap.timeline({ paused: true })
  clock.to(state, { reveal: 1, duration: 1.2, ease: 'power2.out' }, 0)
  clock.to(state, { morph: 1, duration: 2.8, ease: 'power2.inOut' }, 0)
  const cycle = gsap.timeline({ repeat: -1 })
  sequence.forEach((index, i) => {
    const next = sequence[(i + 1) % sequence.length]!
    cycle.to({}, { duration: 5.5 })
    cycle.call(() => {
      state.from = index
      state.to = next
      state.morph = 0
    })
    cycle.to(state, { morph: 1, duration: 2.6, ease: 'sine.inOut' })
    cycle.call(() => void (showing.value = next), undefined, '-=1.4')
  })
  clock.add(cycle)

  // Performance tier: a device that cannot hold ~45fps with the cloud moving keeps its current
  // frame as a still, so the dictionary itself never pays for the decoration.
  const samples: number[] = []
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0
  const freeze = () => {
    frozen = true
    pause()
    clock.kill()
    Object.assign(state, { reveal: 1, from: showing.value, to: showing.value, morph: 1 })
    drawStill()
    tier.value = 'still'
  }
  // One render loop: GSAP's ticker, which also drives Lenis and every other animation on the page.
  const tick = (_time: number, deltaMs: number) => {
    active.frame(snapshot(Math.min(deltaMs, 50) / 1000))
    if (samples.length === 12) return
    samples.push(deltaMs)
    // Skip the first two frames (shader compile), then judge the page's and the worker's pace.
    if (samples.length === 12 && Math.max(median(samples.slice(2)), median(active.drawTimes.slice(2))) > 22) freeze()
  }
  const play = () => {
    if (running || frozen) return
    running = true
    clock.play()
    gsap.ticker.add(tick)
  }
  function pause() {
    running = false
    clock.pause()
    gsap.ticker.remove(tick)
  }

  let onScreen = true
  const sync = () => (onScreen && !searchActive.value ? play() : pause())
  const visibility = new IntersectionObserver(([entry]) => {
    onScreen = Boolean(entry?.isIntersecting)
    sync()
  })
  visibility.observe(host)
  const stopSearchWatch = watch(searchActive, (value) => {
    // Lookups belong to the instrument: fade the cloud out and stop drawing it.
    state.pointerOn = false
    if (value) setTimeout(sync, 260)
    else sync()
    if (!value && stillOwed) {
      stillOwed = false
      drawStill()
    }
  })

  // As the hero scrolls away the cloud scatters, scrubbed straight to the scroll position.
  const scatter = frozen
    ? undefined
    : ScrollTrigger.create({
        trigger: host,
        start: 'top top',
        end: 'bottom top',
        onUpdate: (self) => void (state.disperse = self.progress),
      })

  // A fine pointer pushes electrons aside along its line of sight.
  const onPointer = (event: PointerEvent) => {
    const box = host.getBoundingClientRect()
    const x = (event.clientX - box.left) / box.width
    const y = (event.clientY - box.top) / box.height
    state.pointer = [x * 2 - 1, -(y * 2 - 1)]
    state.pointerOn = !searchActive.value && x >= 0 && x <= 1 && y >= 0 && y <= 1
  }
  const onLeave = () => void (state.pointerOn = false)
  const finePointer = !frozen && matchMedia('(pointer: fine)').matches
  if (finePointer) {
    window.addEventListener('pointermove', onPointer, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
  }

  // Re-read the palette when the theme changes, whether pinned or from the system.
  const onTheme = () => {
    active.syncPalette()
    if (frozen) drawStill()
  }
  const themeObserver = new MutationObserver(onTheme)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const scheme = matchMedia('(prefers-color-scheme: dark)')
  scheme.addEventListener('change', onTheme)

  fit()
  if (frozen) {
    state.reveal = 1
    drawStill()
    tier.value = 'still'
  } else {
    tier.value = 'animated'
    sync()
  }

  teardown = () => {
    pause()
    clock.kill()
    scatter?.kill()
    stopSearchWatch()
    visibility.disconnect()
    resizeObserver.disconnect()
    themeObserver.disconnect()
    scheme.removeEventListener('change', onTheme)
    window.removeEventListener('pointermove', onPointer)
    document.documentElement.removeEventListener('pointerleave', onLeave)
    active.dispose()
  }
}

onBeforeUnmount(() => {
  disposed = true
  stopWaiting?.()
  teardown?.()
})
</script>

<template>
  <figure
    class="cloud"
    :data-tier="tier"
    :class="{ 'is-ready': tier === 'animated' || tier === 'still', 'is-dimmed': searchActive, 'is-unavailable': tier === 'unavailable' }"
  >
    <div ref="stage" class="stage" aria-hidden="true">
      <canvas :key="canvasKey" ref="canvas" />
    </div>
    <figcaption class="label">
      <Transition name="swap" mode="out-in">
        <span :key="showing" class="caption">
          <span class="formula"><template v-for="[symbol, count] in caption.formula" :key="symbol">{{ symbol }}<sub v-if="count">{{ count }}</sub></template></span>
          <NuxtLink :to="`/tu/${caption.slug}`">{{ caption.name }}</NuxtLink>
        </span>
      </Transition>
    </figcaption>
  </figure>
</template>

<style scoped>
.cloud {
  margin: 0;
  display: grid;
  justify-items: end;
  align-self: end;
}

/* The stage bleeds to both viewport edges and up under the header; the copy sits above it. */
.stage {
  position: absolute;
  z-index: 0;
  top: calc((var(--hero-pad-top) + 96px) * -1);
  bottom: calc(var(--hero-gap) * -1);
  left: calc(50% - 50vw);
  right: calc(50% - 50vw);
  pointer-events: none;
  -webkit-mask-image: linear-gradient(to bottom, #000 72%, transparent);
  mask-image: linear-gradient(to bottom, #000 72%, transparent);
}

/* Depth tool 3: the stage sits on a farther plane and settles forward once drawn. */
canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  opacity: 0;
  transform: scale(0.97);
  transition: opacity 600ms var(--ease-out), transform 600ms var(--ease-out);
}

.is-ready canvas {
  opacity: 1;
  transform: none;
}

.is-ready.is-dimmed canvas {
  opacity: 0;
  transition-duration: 250ms;
}

/* Once faded, the stage leaves the compositor entirely, so a lookup never pays to keep it. */
.is-dimmed .stage {
  visibility: hidden;
  transition: visibility 0s linear 250ms;
}

figcaption {
  position: relative;
  z-index: 1;
  text-align: right;
  opacity: 0;
  transition: opacity 600ms var(--ease-out);
}

.is-ready figcaption {
  opacity: 1;
}

.is-dimmed figcaption {
  opacity: 0;
  visibility: hidden;
}

.caption {
  display: inline-flex;
  gap: var(--s2);
  align-items: baseline;
  padding: var(--s1) var(--s2);
  border-radius: 4px;
  background: color-mix(in oklch, var(--ground) 80%, transparent);
}

.formula {
  color: var(--ink);
}

figcaption a {
  position: relative;
  color: var(--accent);
}

/* A 44px tall hit area for the caption link. */
figcaption a::after {
  content: '';
  position: absolute;
  inset: -14px -6px;
}

.swap-enter-active,
.swap-leave-active {
  transition: opacity var(--t-peak) var(--ease-out), transform var(--t-peak) var(--ease-out);
}

.swap-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.swap-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.cloud.is-unavailable,
html:not(.js) .cloud {
  display: none;
}

@media (max-width: 860px) {
  /* No column of its own: the figure lies over the title block and only its stage shows. */
  .cloud {
    position: absolute;
    inset: 0;
    /* Stretch, or the grid's end alignment shrinks the box to its (hidden) caption. */
    align-self: stretch;
  }

  /* Below the header here, so the molecule never crowds the lesson tiles. */
  .stage {
    top: calc(var(--hero-pad-top) * -1);
    -webkit-mask-image: linear-gradient(to bottom, #000 60%, transparent);
    mask-image: linear-gradient(to bottom, #000 60%, transparent);
  }

  figcaption {
    display: none;
  }
}
</style>
