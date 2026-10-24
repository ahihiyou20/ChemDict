<script setup lang="ts">
import type { BenzeneScene } from '~/lib/benzene-scene'

/** loading → animated, or still (reduced motion, software GPU, slow device), or unavailable. */
type Tier = 'loading' | 'animated' | 'still' | 'unavailable'

const searchActive = useState('search-active', () => false)
const figure = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const tier = ref<Tier>('loading')

let scene: BenzeneScene | undefined
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

async function mount() {
  if (!canvas.value || !figure.value) return
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  const [{ createBenzeneScene }, { gsap }] = await Promise.all([import('~/lib/benzene-scene'), import('gsap')])
  if (disposed) return
  scene = await createBenzeneScene(canvas.value, {
    still: reducedMotion,
    onLost: () => {
      tier.value = 'unavailable'
      teardown?.()
    },
  })
  if (disposed) {
    scene.dispose()
    return
  }
  const host = figure.value
  const active = scene

  const fade = { value: 0 }
  let frozen = reducedMotion || active.isSoftware
  let running = false

  const fit = () => {
    active.resize(host.clientWidth, host.clientHeight)
    if (frozen) active.render(0)
  }
  const resizeObserver = new ResizeObserver(fit)
  resizeObserver.observe(host)

  // Performance tier: a device that cannot hold ~45fps with the cloud turning keeps its current
  // frame as a still, so the dictionary itself never pays for the decoration.
  const samples: number[] = []
  const freeze = () => {
    frozen = true
    pause()
    gsap.killTweensOf(fade)
    active.setReveal(1)
    active.render(0)
    tier.value = 'still'
  }
  // One render loop: GSAP's ticker, which also drives every other animation on the page.
  const tick = (_time: number, deltaMs: number) => {
    active.render(Math.min(deltaMs, 50) / 1000)
    if (samples.length === 12) return
    samples.push(deltaMs)
    if (samples.length === 12) {
      // Skip the first two frames (shader compile), then judge the median.
      const steady = samples.slice(2).sort((a, b) => a - b)
      if (steady[Math.floor(steady.length / 2)]! > 22) freeze()
    }
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
  const sync = () => (onScreen && !searchActive.value ? play() : pause())
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
    if (frozen) active.render(0)
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
      <canvas ref="canvas" />
    </div>
    <figcaption class="label">
      Đám mây electron π của benzene, C<sub>6</sub>H<sub>6</sub> (mô phỏng) ·
      <NuxtLink to="/tu/aromatic-compound">Aromatic compound</NuxtLink>
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
:global(html:not(.js)) .cloud {
  display: none;
}

@media (max-width: 860px) {
  /* On narrow screens the cloud becomes a backdrop behind the title, never pushing the search down. */
  .cloud {
    position: absolute;
    top: -12px;
    right: calc(var(--gutter) * -1);
    width: min(64vw, 300px);
    z-index: 0;
    pointer-events: none;
  }

  .is-ready canvas {
    opacity: 0.5;
  }

  figcaption {
    display: none;
  }
}
</style>
