<script setup lang="ts">
// The page's one marquee: Bài 10's terms drift past, English set solid and Vietnamese in outline.
// It repeats the A–Z index below, so it is decoration and hidden from assistive technology.
const { entries } = useLexicon()
const terms = entries.filter((entry) => entry.lessons.includes(10))

const band = ref<HTMLElement | null>(null)

useMotionScope(band, ({ gsap, ScrollTrigger }, root) => {
  const track = root.querySelector<HTMLElement>('.track')!
  const loop = gsap.to(track, { xPercent: -50, duration: 110, ease: 'none', repeat: -1, paused: true })
  // Start far into the repeats so a reversed band has room to run backwards.
  loop.totalTime(110 * 1000)
  const speed = { value: 1 }
  const skewTo = gsap.quickTo(track, 'skewX', { duration: 0.6, ease: 'power3.out' })
  let direction = 1
  let hovering = false

  const steer = (value: number, duration: number) =>
    gsap.to(speed, { value, duration, ease: 'power2.out', overwrite: true, onUpdate: () => void loop.timeScale(speed.value) })
  // Scrolling throws the band along in the scroll's direction, then it drifts back to cruising speed.
  const settle = gsap.delayedCall(0.14, () => {
    steer(hovering ? 0 : direction, 1.2)
    skewTo(0)
  }).pause()

  ScrollTrigger.create({
    trigger: root,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => (self.isActive ? loop.play() : loop.pause()),
    onUpdate: (self) => {
      const velocity = self.getVelocity()
      direction = self.direction
      if (hovering) return
      steer(direction * (1 + Math.min(Math.abs(velocity) / 140, 14)), 0.2)
      skewTo(gsap.utils.clamp(-7, 7, -velocity / 260))
      settle.restart(true)
    },
  })

  const hold = () => {
    hovering = true
    steer(0, 0.5)
  }
  const release = () => {
    hovering = false
    steer(direction, 0.8)
  }
  root.addEventListener('pointerenter', hold)
  root.addEventListener('pointerleave', release)
  return () => {
    root.removeEventListener('pointerenter', hold)
    root.removeEventListener('pointerleave', release)
  }
})
</script>

<template>
  <div ref="band" class="marquee" aria-hidden="true">
    <div class="track">
      <div v-for="copy in 2" :key="copy" class="run">
        <NuxtLink v-for="entry in terms" :key="entry.slug" :to="`/tu/${entry.slug}`" class="term" tabindex="-1" :data-lesson="entry.lessons[0]">
          <span class="en" lang="en">{{ entry.en }}</span>
          <span class="vi" lang="vi">{{ entry.vi }}</span>
          <i class="dot" />
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.marquee {
  overflow: hidden;
  padding-block: clamp(16px, 2.6vw, 32px);
  border-block: 1px solid var(--hairline);
}

.track {
  display: flex;
  width: max-content;
}

.run {
  display: flex;
  align-items: center;
  flex: none;
}

.term {
  display: inline-flex;
  align-items: center;
  gap: 0.32em;
  padding-right: 0.42em;
  font-size: clamp(2rem, 5vw, 4.25rem);
  line-height: 1.1;
  font-weight: 500;
  letter-spacing: -0.02em;
  font-variation-settings: 'opsz' 72;
  white-space: nowrap;
  text-decoration: none;
}

.en {
  color: var(--ink);
}

/* Outlined type; it takes its lesson's flame when hovered. */
.vi {
  color: transparent;
  -webkit-text-stroke: 1px var(--ink-secondary);
  transition: color var(--t-peak) var(--ease-out);
}

.term:hover .vi {
  color: var(--flame-mark);
}

.dot {
  width: 0.26em;
  height: 0.26em;
  margin-left: 0.1em;
  border-radius: 50%;
  background: var(--flame-mark);
}
</style>
