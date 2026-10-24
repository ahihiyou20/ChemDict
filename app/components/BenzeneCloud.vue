<script setup lang="ts">
import type { BenzeneHandle } from '~/lib/benzene-client'

/** loading → animated, or still (reduced motion, software GPU, slow device), or unavailable. */
type Tier = 'loading' | 'animated' | 'still' | 'unavailable'

const searchActive = useState('search-active', () => false)
const figure = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
// A canvas handed to a worker cannot be used again, so a failed worker gets a fresh one.
const canvasKey = ref(0)
const tier = ref<Tier>('loading')

let teardown: (() => void) | undefined
let disposed = false

onMounted(() => {
  const start = () =>
    mount().catch(() => {
      // No WebGPU and no WebGL2: the hero simply stays typographic.
      tier.value = 'unavailable'
    })
  // Load three.js only once the page is idle, so it never competes with hydration or the first keystroke.
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1500 })
  else setTimeout(start, 600)
})

async function connect(reducedMotion: boolean): Promise<BenzeneHandle | undefined> {
  const client = await import('~/lib/benzene-client')
  const options = { still: reducedMotion, devicePixelRatio: window.devicePixelRatio }
  const onLost = () => {
    tier.value = 'unavailable'
    teardown?.()
  }
  if (!canvas.value || disposed) return
  if (client.canDrawOffThread(canvas.value)) {
    try {
      // three.js is parsed and drawn in a worker, so it never blocks typing on the main thread.
      return await client.startInWorker(canvas.value, options, onLost)
    } catch (error) {
      if (!(error instanceof client.OffThreadFailed)) throw error
      canvasKey.value++
      await nextTick()
      if (!canvas.value || disposed) return
    }
  }
  return client.startOnMainThread(canvas.value, { ...options, onLost })
}

async function mount() {
  if (!canvas.value || !figure.value) return
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  const [active, { gsap }, { ScrollTrigger }] = await Promise.all([connect(reducedMotion), import('gsap'), import('gsap/ScrollTrigger')])
  gsap.registerPlugin(ScrollTrigger)
  if (!active) return
  if (disposed) {
    active.dispose()
    return
  }
  const host = figure.value

  const fade = { value: 0 }
  let frozen = reducedMotion || active.isSoftware
  let running = false

  const fit = () => {
    active.resize(host.clientWidth, host.clientHeight)
    if (frozen) active.frame(0)
  }
  const resizeObserver = new ResizeObserver(fit)
  resizeObserver.observe(host)

  // Performance tier: a device that cannot hold ~45fps with the cloud turning keeps its current
  // frame as a still, so the dictionary itself never pays for the decoration.
  const samples: number[] = []
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0
  const freeze = () => {
    frozen = true
    pause()
    gsap.killTweensOf(fade)
    active.setReveal(1)
    active.frame(0)
    tier.value = 'still'
  }
  // One render loop: GSAP's ticker, which also drives every other animation on the page.
  const tick = (_time: number, deltaMs: number) => {
    active.frame(Math.min(deltaMs, 50) / 1000)
    if (samples.length === 12) return
    samples.push(deltaMs)
    // Skip the first two frames (shader compile), then judge the page's and the worker's pace.
    if (samples.length === 12 && Math.max(median(samples.slice(2)), median(active.drawTimes.slice(2))) > 22) freeze()
  }
  const play = () => {
    if (running || frozen) return
    running = true
    gsap.ticker.add(tick)
  }
  function pause() {
    running = false
    gsap.ticker.remove(tick)
  }

  let onScreen = true
  let scrolling = false
  const sync = () => (onScreen && !scrolling && !searchActive.value ? play() : pause())
  // Hold the cloud still while the reader scrolls: the page's frames go to the scroll.
  const onScrollStart = () => {
    scrolling = true
    sync()
  }
  const onScrollEnd = () => {
    scrolling = false
    sync()
  }
  ScrollTrigger.addEventListener('scrollStart', onScrollStart)
  ScrollTrigger.addEventListener('scrollEnd', onScrollEnd)
  const visibility = new IntersectionObserver(([entry]) => {
    onScreen = Boolean(entry?.isIntersecting)
    sync()
  })
  visibility.observe(host)
  const stopSearchWatch = watch(searchActive, (value) => {
    // Lookups belong to the instrument: fade the cloud out and stop drawing it.
    if (value) setTimeout(sync, 260)
    else sync()
  })

  const onPointer = (event: PointerEvent) => {
    active.setPointer((event.clientX / window.innerWidth) * 2 - 1, (event.clientY / window.innerHeight) * 2 - 1)
  }
  if (!frozen && matchMedia('(pointer: fine)').matches) window.addEventListener('pointermove', onPointer, { passive: true })

  // Re-read the palette when the theme changes, whether pinned or from the system.
  const onTheme = () => {
    active.syncColors()
    if (frozen) active.frame(0)
  }
  const themeObserver = new MutationObserver(onTheme)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const scheme = matchMedia('(prefers-color-scheme: dark)')
  scheme.addEventListener('change', onTheme)

  if (frozen) {
    active.setReveal(1)
    fit()
    tier.value = 'still'
  } else {
    fit()
    tier.value = 'animated'
    gsap.to(fade, { value: 1, duration: 1.4, ease: 'power3.out', onUpdate: () => active.setReveal(fade.value) })
    sync()
  }

  teardown = () => {
    pause()
    gsap.killTweensOf(fade)
    stopSearchWatch()
    ScrollTrigger.removeEventListener('scrollStart', onScrollStart)
    ScrollTrigger.removeEventListener('scrollEnd', onScrollEnd)
    visibility.disconnect()
    resizeObserver.disconnect()
    themeObserver.disconnect()
    scheme.removeEventListener('change', onTheme)
    window.removeEventListener('pointermove', onPointer)
    active.dispose()
  }
}

onBeforeUnmount(() => {
  disposed = true
  teardown?.()
})
</script>

<template>
  <figure
    class="cloud"
    :data-tier="tier"
    :class="{ 'is-ready': tier === 'animated' || tier === 'still', 'is-dimmed': searchActive, 'is-unavailable': tier === 'unavailable' }"
  >
    <div ref="figure" class="stage" aria-hidden="true">
      <canvas :key="canvasKey" ref="canvas" />
    </div>
    <figcaption class="label">
      C<sub>6</sub>H<sub>6</sub> · <NuxtLink to="/tu/aromatic-compound">Aromatic compound</NuxtLink>
    </figcaption>
  </figure>
</template>

<style scoped>
.cloud {
  position: relative;
  margin: 0;
  display: grid;
  gap: var(--s2);
  justify-items: end;
}

.stage {
  position: relative;
  width: 100%;
  aspect-ratio: 5 / 4;
  max-height: 360px;
}

/* Depth tool 3: the cloud sits on a farther plane and settles forward once drawn. */
canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  opacity: 0;
  transform: scale(0.96);
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

figcaption {
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

figcaption a {
  color: var(--ink);
}

.cloud.is-unavailable,
html:not(.js) .cloud {
  display: none;
}

@media (max-width: 860px) {
  /* On narrow screens the cloud becomes a backdrop behind the title, never pushing the search down. */
  .cloud {
    position: absolute;
    top: -20px;
    right: calc(var(--gutter) * -1);
    width: min(62vw, 260px);
    z-index: 0;
    pointer-events: none;
  }

  /* It belongs to the display title: fade it out before the body copy starts. */
  .stage {
    -webkit-mask-image: linear-gradient(to bottom, #000 35%, transparent 72%);
    mask-image: linear-gradient(to bottom, #000 35%, transparent 72%);
  }

  .is-ready canvas {
    opacity: 0.55;
  }

  figcaption {
    display: none;
  }
}
</style>
