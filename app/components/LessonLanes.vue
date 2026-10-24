<script setup lang="ts">
import { decodeOnEnter } from '~/lib/motion-kit'

const { lessons, entryOfSense } = useLexicon()
const section = ref<HTMLElement | null>(null)

useMotionScope(section, (motion, root) => {
  const { gsap } = motion
  const stopDecode = decodeOnEnter(motion, root.querySelector<HTMLElement>('.section-title')!)

  // Each lane is a TLC plate developing under the reader's scroll: the solvent front climbs from the
  // origin and the spots rise to their places as it passes. The plates themselves never hide.
  gsap.utils.toArray<HTMLElement>('.lane', root).forEach((lane, i) => {
    const body = lane.querySelector<HTMLElement>('.lane-body')!
    const spots = lane.querySelectorAll('.spot')
    gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: body, start: 'top 88%', end: `top ${40 - (i % 4) * 4}%`, scrub: 0.6 },
      })
      .fromTo(body.querySelector('.front'), { yPercent: 100 }, { yPercent: 0, duration: 1 }, 0)
      .fromTo(spots, { y: 34, opacity: 0.18 }, { y: 0, opacity: 1, duration: 0.45, stagger: { each: 0.4 / Math.max(spots.length, 1), from: 'end' } }, 0.1)
  })
  return stopDecode
})
</script>

<template>
  <section ref="section" class="lanes-section" aria-labelledby="lanes-title">
    <div class="wrap section">
      <div class="section-head">
        <h2 id="lanes-title" class="section-title">Theo từng bài học</h2>
      </div>

      <ol class="plate">
        <li
          v-for="lesson in lessons"
          :key="lesson.number"
          class="lane"
          :class="{ empty: !lesson.senses.length }"
          :data-lesson="lesson.number"
        >
          <NuxtLink :to="`/bai/${lesson.number}`" class="lane-head">
            <span class="lane-title">{{ lesson.title }}</span>
            <span class="label">{{ lesson.senses.length }} thuật ngữ</span>
          </NuxtLink>
          <div class="lane-body">
            <div class="front" aria-hidden="true" />
            <ul v-if="lesson.senses.length" class="spots">
              <li v-for="sense in lesson.senses" :key="sense.id">
                <NuxtLink :to="`/tu/${entryOfSense(sense.id).slug}`" class="spot">
                  <span class="dot" aria-hidden="true" />
                  <span class="spot-vi" lang="vi">{{ sense.vi }}</span>
                  <span class="spot-en" lang="en">{{ sense.en }}</span>
                </NuxtLink>
              </li>
            </ul>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.plate {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--s8) var(--s6);
  margin: 0;
  padding: 0;
  list-style: none;
}

.lane {
  display: grid;
  grid-template-rows: auto 1fr;
  min-width: 0;
}

.lane-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s2);
  min-height: 44px;
  padding-bottom: var(--s3);
  text-decoration: none;
}

.lane-title {
  font-size: 1.625rem;
  font-weight: 500;
  font-variation-settings: 'opsz' 48;
  transition: color var(--t-press) var(--ease-out);
}

.lane-head:hover .lane-title {
  color: var(--flame-mark);
}

/* The plate: tinted with its lesson's flame, with a hard origin line at the foot. */
.lane-body {
  position: relative;
  min-height: 100%;
  overflow: hidden;
  padding: var(--s3) var(--s4) var(--s8);
  border: 1px solid var(--hairline-strong);
  border-radius: 4px;
  background: color-mix(in oklch, var(--flame) 9%, var(--ground-elevated));
  box-shadow: inset 0 1px 0 var(--highlight), inset 0 -3px 0 var(--flame-mark);
}

/* Solvent front: the wetted area below a dashed front line. Script lifts it from the origin. */
.front {
  position: absolute;
  inset: 0;
  border-top: 1px dashed var(--flame-mark);
  background: linear-gradient(to bottom, color-mix(in oklch, var(--flame) 22%, transparent), transparent 70%);
  pointer-events: none;
}

.spots {
  position: relative;
  margin: 0;
  padding: var(--s2) 0;
  list-style: none;
}

.spot {
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr);
  column-gap: var(--s3);
  align-items: baseline;
  min-height: 44px;
  padding: 5px 0;
  text-decoration: none;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--flame-mark);
  box-shadow: 0 0 0 0 color-mix(in oklch, var(--flame) 45%, transparent);
  align-self: center;
  transition: transform var(--t-peak) var(--ease-out), box-shadow var(--t-peak) var(--ease-out);
}

.spot:hover .dot {
  transform: scale(1.25);
  box-shadow: 0 0 0 6px color-mix(in oklch, var(--flame) 30%, transparent);
}

.spot-vi,
.spot-en {
  transition: transform var(--t-peak) var(--ease-out);
}

.spot-vi {
  font-size: 1.0625rem;
  line-height: 1.3;
}

.spot-en {
  grid-column: 2;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--ink-secondary);
}

.spot:hover .spot-vi,
.spot:hover .spot-en {
  transform: translateX(4px);
}

@media (max-width: 1080px) {
  .plate {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: var(--s8);
  }
}

@media (max-width: 640px) {
  .plate {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
