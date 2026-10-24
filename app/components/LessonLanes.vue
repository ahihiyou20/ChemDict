<script setup lang="ts">
const { lessons, entryOfSense } = useLexicon()
const plate = ref<HTMLElement | null>(null)
let revert: (() => void) | undefined

onMounted(async () => {
  if (!plate.value || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
  gsap.registerPlugin(ScrollTrigger)
  const scope = plate.value
  // Lanes develop bottom-to-top, like a solvent front climbing a TLC plate.
  const ctx = gsap.context(() => {
    gsap.fromTo(
      '.lane-body',
      { clipPath: 'inset(100% 0% 0% 0%)' },
      {
        clipPath: 'inset(0% 0% 0% 0%)',
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.08,
        clearProps: 'clipPath',
        scrollTrigger: { trigger: scope, start: 'top 80%', once: true },
      },
    )
  }, scope)
  revert = () => ctx.revert()
})

onBeforeUnmount(() => revert?.())
</script>

<template>
  <section class="lanes-section" aria-labelledby="lanes-title">
    <div class="wrap section">
      <div class="section-head">
        <h2 id="lanes-title" class="section-title">Theo từng bài học</h2>
        <p class="section-lede">Mỗi cột là một thẻ trong bảng từ vựng, giữ đúng thứ tự các dòng.</p>
      </div>

      <ol ref="plate" class="plate">
        <li v-for="lesson in lessons" :key="lesson.number" class="lane" :class="{ empty: !lesson.senses.length }">
          <NuxtLink :to="`/bai/${lesson.number}`" class="lane-head">
            <span class="lane-title">{{ lesson.title }}</span>
            <span class="label">{{ lesson.senses.length }} thuật ngữ</span>
          </NuxtLink>
          <div class="lane-body">
            <span class="front label" aria-hidden="true">tuyến dung môi</span>
            <ul v-if="lesson.senses.length" class="spots">
              <li v-for="sense in lesson.senses" :key="sense.id">
                <NuxtLink :to="`/tu/${entryOfSense(sense.id).slug}`" class="spot">
                  <span class="dot" aria-hidden="true" />
                  <span class="spot-vi" lang="vi">{{ sense.vi }}</span>
                  <span class="spot-en" lang="en">{{ sense.en }}</span>
                </NuxtLink>
              </li>
            </ul>
            <p v-else class="lane-empty">Thẻ “{{ lesson.title }}” chưa có thuật ngữ nào trong bảng tổng hợp.</p>
            <span class="origin label" aria-hidden="true">vạch xuất phát</span>
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
  gap: var(--s4);
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
  color: var(--accent);
}

.lane-body {
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100%;
  padding: var(--s3) var(--s4);
  border: 1px solid var(--hairline-strong);
  border-radius: 4px;
  background: var(--ground-elevated);
  box-shadow: inset 0 1px 0 var(--highlight);
}

.front,
.origin {
  display: block;
  font-size: 0.6875rem;
}

.front {
  padding-bottom: var(--s2);
  border-bottom: 1px dashed var(--hairline-strong);
}

.origin {
  padding-top: var(--s2);
  border-top: 1px solid var(--ink-secondary);
}

.spots {
  margin: 0;
  padding: var(--s2) 0;
  list-style: none;
}

.spot {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  column-gap: var(--s3);
  align-items: baseline;
  min-height: 44px;
  padding: 5px 0;
  text-decoration: none;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.85;
  align-self: center;
  transition: transform var(--t-press) var(--ease-out);
}

.spot:hover .dot {
  transform: scale(1.3);
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

.spot:hover .spot-vi {
  color: var(--accent);
}

.lane-empty {
  align-self: center;
  padding: var(--s8) 0;
  color: var(--ink-secondary);
  font-style: italic;
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
