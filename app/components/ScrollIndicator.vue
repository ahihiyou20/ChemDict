<script setup lang="ts">
const strip = ref<HTMLElement | null>(null)
const router = useRouter()

// Universal indicator, pH 1 to 14, as discrete swatches: the page's scroll progress reads as acid to base.
// auteur-allow: NO_AI_PURPLE_GRADIENT -- not a gradient: fourteen hard-edged swatches of the real indicator scale.
const swatches = [
  'oklch(0.58 0.21 27)',
  'oklch(0.64 0.2 38)',
  'oklch(0.72 0.17 55)',
  'oklch(0.8 0.16 75)',
  'oklch(0.86 0.16 98)',
  'oklch(0.84 0.17 118)',
  'oklch(0.74 0.17 142)',
  'oklch(0.68 0.14 162)',
  'oklch(0.63 0.11 192)',
  'oklch(0.58 0.12 228)',
  'oklch(0.51 0.14 262)',
  'oklch(0.47 0.16 290)',
  'oklch(0.46 0.17 310)',
  'oklch(0.43 0.16 322)',
]

useMotionScope(
  strip,
  ({ gsap, ScrollTrigger, reduced }, root) => {
    // Two opposed translations clip the strip without animating clip-path on every frame.
    const mask = root.querySelector<HTMLElement>('.mask')!
    const scale = root.querySelector<HTMLElement>('.scale')!
    const setMask = gsap.quickSetter(mask, 'xPercent')
    const setScale = gsap.quickSetter(scale, 'xPercent')
    const show = (progress: number) => {
      setMask((progress - 1) * 100)
      setScale((1 - progress) * 100)
    }
    show(0)
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => show(self.progress) })
    if (reduced) return

    // A route change sends the four lesson flames across the strip. It decorates; it never waits.
    const sweep = () =>
      gsap.fromTo(
        root.querySelectorAll('.band'),
        { xPercent: -100 },
        { xPercent: 100, duration: 0.75, ease: 'power3.inOut', stagger: 0.07, overwrite: true },
      )
    return router.beforeEach((to, from) => {
      if (to.path !== from.path) sweep()
    })
  },
  { reduced: true },
)
</script>

<template>
  <div ref="strip" class="indicator" aria-hidden="true">
    <div class="mask">
      <div class="scale">
        <i v-for="(swatch, i) in swatches" :key="i" :style="{ background: swatch }" />
      </div>
    </div>
    <div class="sweep">
      <i class="band" data-lesson="10" />
      <i class="band" data-lesson="11" />
      <i class="band" data-lesson="12" />
      <i class="band" data-lesson="13" />
    </div>
  </div>
</template>

<style scoped>
.indicator {
  position: fixed;
  inset: 0 0 auto;
  z-index: 90;
  height: 3px;
  overflow: hidden;
  pointer-events: none;
}

.mask,
.scale,
.sweep {
  position: absolute;
  inset: 0;
}

.mask {
  overflow: hidden;
  transform: translateX(-100%);
}

.scale {
  display: flex;
  transform: translateX(100%);
}

.scale i {
  flex: 1;
}

.band {
  position: absolute;
  inset: 0;
  background: var(--flame);
  transform: translateX(-100%);
}
</style>
