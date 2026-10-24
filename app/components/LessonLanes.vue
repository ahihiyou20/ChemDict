<script setup lang="ts">
import { decodeOnEnter } from '~/lib/motion-kit'

const { lessons, entryOfSense } = useLexicon()
const section = ref<HTMLElement | null>(null)

useMotionScope(section, (motion, root) => {
  const { gsap } = motion
  const stopDecode = decodeOnEnter(motion, root.querySelector<HTMLElement>('.section-title')!)

  // Each strip is chromatography paper developing under the reader's scroll: the solvent front runs
  // from the origin on the left and the spots come up as it passes. The strips themselves never hide.
  const strips = gsap.utils.toArray<HTMLElement>('.strip-body', root).map((body) => ({
    body,
    spots: [...body.querySelectorAll<HTMLElement>('.spot')],
  }))
  // Parse every spot's transform before the first write: one style pass, not one per spot.
  strips.forEach(({ spots }) => spots.forEach((spot) => gsap.getProperty(spot, 'x')))
  strips.forEach(({ body, spots }) => {
    const develop = gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: body, start: 'top 90%', end: 'top 42%', scrub: 0.6 },
      })
      .fromTo(body.querySelector('.front'), { xPercent: -100 }, { xPercent: 0, duration: 1 }, 0)
    if (spots.length)
      develop.fromTo(spots, { x: -18, opacity: 0.18 }, { x: 0, opacity: 1, duration: 0.4, stagger: { each: 0.6 / spots.length } }, 0.05)
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

      <ol class="strips">
        <li v-for="lesson in lessons" :key="lesson.number" class="strip" :data-lesson="lesson.number">
          <NuxtLink :to="`/bai/${lesson.number}`" class="strip-head">
            <span class="strip-title">{{ lesson.title }}</span>
            <span class="strip-name">{{ lesson.name }}</span>
            <span class="label strip-count">{{ lesson.senses.length }} thuật ngữ</span>
          </NuxtLink>
          <div class="strip-body">
            <div class="front" aria-hidden="true" />
            <ul class="spots">
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
.strips {
  display: grid;
  gap: var(--s10);
  margin: 0;
  padding: 0;
  list-style: none;
}

.strip {
  display: grid;
  gap: var(--s3);
  min-width: 0;
}

.strip-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: baseline;
  column-gap: var(--s4);
  min-height: 44px;
  text-decoration: none;
}

.strip-title {
  font-size: 1.625rem;
  font-weight: 500;
  font-variation-settings: 'opsz' 48;
  transition: color var(--t-press) var(--ease-out);
}

.strip-name {
  color: var(--ink-secondary);
  font-size: 1.0625rem;
  line-height: 1.3;
}

.strip-head:hover .strip-title {
  color: var(--flame-mark);
}

/* The paper: tinted with its lesson's flame, the origin a hard rule on the left. */
.strip-body {
  position: relative;
  overflow: hidden;
  padding: var(--s4) var(--s6) var(--s4) var(--s10);
  border: 1px solid var(--hairline-strong);
  border-radius: 4px;
  background: color-mix(in oklch, var(--flame) 9%, var(--ground-elevated));
  box-shadow: inset 0 1px 0 var(--highlight), inset 3px 0 0 var(--flame-mark);
}

/* Solvent front: the wetted paper behind a dashed front. Script carries it from the origin. */
.front {
  position: absolute;
  inset: 0;
  border-right: 1px dashed var(--flame-mark);
  background: linear-gradient(to left, color-mix(in oklch, var(--flame) 24%, transparent), transparent 75%);
  pointer-events: none;
}

.spots {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: var(--s1) var(--s6);
  margin: 0;
  padding: 0;
  list-style: none;
}

.spot {
  display: grid;
  grid-template-columns: 10px auto;
  column-gap: var(--s2);
  align-items: baseline;
  min-height: 44px;
  padding: 4px 0;
  text-decoration: none;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--flame-mark);
  box-shadow: 0 0 0 0 color-mix(in oklch, var(--flame) 45%, transparent);
  align-self: center;
  transition: transform var(--t-peak) var(--ease-out), box-shadow var(--t-peak) var(--ease-out);
}

.spot:hover .dot {
  transform: scale(1.3);
  box-shadow: 0 0 0 6px color-mix(in oklch, var(--flame) 30%, transparent);
}

.spot-vi {
  font-size: 1.0625rem;
  line-height: 1.25;
}

.spot-en {
  grid-column: 2;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--ink-secondary);
}

.spot:hover .spot-vi {
  text-decoration: underline 1px var(--flame-mark);
  text-underline-offset: 3px;
}

@media (max-width: 640px) {
  .strip-head {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .strip-name {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .strip-count {
    justify-self: end;
  }

  .strip-body {
    padding: var(--s3) var(--s4) var(--s3) var(--s6);
  }

  .spots {
    column-gap: var(--s5);
  }
}
</style>
