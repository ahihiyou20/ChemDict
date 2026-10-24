<script setup lang="ts">
const route = useRoute()
const { lessons, entryOfSense } = useLexicon()

const index = lessons.findIndex((lesson) => String(lesson.number) === String(route.params.n))
const lesson = lessons[index]
if (!lesson) {
  throw createError({ statusCode: 404, statusMessage: 'Không có bài này trong từ điển', fatal: true })
}
const previous = lessons[index - 1]
const next = lessons[index + 1]

const root = ref<HTMLElement | null>(null)

// The lesson's numeral stands behind the title in outline and fills with the lesson's flame.
// The term table itself never waits.
useMotionScope(root, ({ gsap }, el) => {
  const fill = el.querySelector('.numeral .fill')
  if (fill && revealPre(fill)) {
    gsap.fromTo(fill, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, delay: 0.1, ease: 'power3.inOut', clearProps: 'clipPath' })
  }
  const flame = el.querySelector('.lesson-flame')
  if (flame && revealPre(flame)) {
    gsap.from(flame.children, { scaleX: 0, transformOrigin: '0% 50%', duration: 0.5, ease: 'power3.out', stagger: 0.08, delay: 0.2 })
  }
})

useSeoMeta({
  title: `${lesson.title}: ${lesson.name}`,
  description: lesson.senses.length
    ? `Thuật ngữ Hóa học ${lesson.title}: ${lesson.senses.map((sense) => sense.vi).join(', ')}.`
    : `${lesson.title} chưa có thuật ngữ.`,
})
</script>

<template>
  <div v-if="lesson" ref="root" class="lesson" :data-lesson="lesson.number">
    <header class="wrap lesson-head">
      <p class="numeral" aria-hidden="true">
        <span class="outline">{{ lesson.number }}</span>
        <span class="fill" data-pre>{{ lesson.number }}</span>
      </p>
      <p class="label crumbs">
        <NuxtLink to="/">Từ điển</NuxtLink>
        <span aria-hidden="true">/</span>
        <span>{{ lesson.title }}</span>
      </p>
      <h1 class="lesson-title">{{ lesson.title }}</h1>
      <p class="lesson-name">{{ lesson.name }}</p>
      <p class="lede">{{ lesson.senses.length }} thuật ngữ</p>
      <p class="lesson-flame" aria-hidden="true" data-pre><i /><i /><i /></p>
    </header>

    <div class="wrap">
      <table v-if="lesson.senses.length" class="terms">
        <caption class="visually-hidden">Thuật ngữ {{ lesson.title }}</caption>
        <thead>
          <tr>
            <th scope="col" class="num">#</th>
            <th scope="col">Tiếng Việt</th>
            <th scope="col">Tiếng Anh</th>
            <th scope="col">Phiên âm</th>
            <th scope="col">Loại từ</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(sense, i) in lesson.senses" :key="sense.id">
            <td class="num mono">{{ i + 1 }}</td>
            <td class="vi" lang="vi">
              <NuxtLink :to="`/tu/${entryOfSense(sense.id).slug}`">{{ sense.vi }}</NuxtLink>
            </td>
            <td class="en" lang="en">{{ sense.en }}</td>
            <td class="mono ipa" lang="en">
              <span class="ipa-cell">{{ sense.ipa }}<SpeakButton v-if="sense.en" :text="sense.en" :id="sense.id" /></span>
            </td>
            <td class="pos">{{ sense.pos }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">
        Chưa có thuật ngữ.
      </p>
    </div>

    <nav class="wrap pager" aria-label="Bài khác">
      <NuxtLink v-if="previous" :to="`/bai/${previous.number}`" class="pager-link">
        <span class="label">Bài trước</span>
        <span class="pager-title">{{ previous.title }}</span>
      </NuxtLink>
      <span v-else />
      <NuxtLink v-if="next" :to="`/bai/${next.number}`" class="pager-link to-next">
        <span class="label">Bài sau</span>
        <span class="pager-title">{{ next.title }}</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<style scoped>
.lesson-head {
  position: relative;
  display: grid;
  gap: var(--s3);
  padding-top: clamp(40px, 7vw, 96px);
  padding-bottom: clamp(32px, 5vw, 56px);
}

/* Structural overlap: the lesson numeral hangs behind the title on the right. */
.numeral {
  position: absolute;
  right: var(--gutter);
  bottom: clamp(8px, 2vw, 24px);
  z-index: -1;
  font-size: clamp(7rem, 22vw, 17rem);
  font-weight: 600;
  line-height: 0.8;
  letter-spacing: -0.04em;
  font-variation-settings: 'opsz' 72;
  pointer-events: none;
}

.numeral .outline {
  color: transparent;
  -webkit-text-stroke: 1.5px var(--flame-mark);
}

.numeral .fill {
  position: absolute;
  inset: 0;
  color: color-mix(in oklch, var(--flame) 60%, transparent);
}

.lesson {
  position: relative;
  isolation: isolate;
}

.lesson-flame {
  display: flex;
  gap: 6px;
  width: min(100%, 220px);
  height: 6px;
  margin-top: var(--s2);
}

.lesson-flame i {
  flex: 1;
  border-radius: 1px;
  background: var(--flame-mark);
}

.lesson-flame i:last-child {
  background: var(--accent);
}

.crumbs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.crumbs a {
  position: relative;
  text-decoration: none;
}

.crumbs a::after {
  content: '';
  position: absolute;
  inset: -14px -6px;
}

.lesson-title {
  font-size: clamp(2.75rem, 7vw, 6rem);
  font-weight: 500;
  letter-spacing: -0.03em;
  font-variation-settings: 'opsz' 72;
}

.lesson-name {
  max-width: 32ch;
  font-size: clamp(1.25rem, 2.2vw, 1.75rem);
  line-height: 1.25;
  font-variation-settings: 'opsz' 36;
}

.lede {
  color: var(--ink-secondary);
}

.terms {
  width: 100%;
  border-collapse: collapse;
}

th {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--ink-secondary);
  text-align: left;
  padding: var(--s2) var(--s4) var(--s2) 0;
  border-bottom: 1px solid var(--ink-secondary);
}

td {
  padding: var(--s3) var(--s4) var(--s3) 0;
  border-bottom: 1px solid var(--hairline);
  vertical-align: baseline;
}

.num {
  width: 3rem;
  color: var(--ink-secondary);
}

.mono {
  font-family: var(--font-mono);
  font-size: 0.875rem;
}

.vi {
  font-size: 1.1875rem;
}

.vi a {
  display: inline-block;
  padding-block: 8px;
  margin-block: -8px;
  text-decoration-color: var(--flame-mark);
  text-decoration-thickness: 2px;
  transition: color var(--t-press) var(--ease-out), transform var(--t-peak) var(--ease-out);
}

.vi a:hover {
  transform: translateX(4px);
}

.terms tbody tr {
  transition: background-color var(--t-press) var(--ease-out);
}

.terms tbody tr:hover {
  background: color-mix(in oklch, var(--flame) 12%, transparent);
}

.en {
  font-size: 1.0625rem;
}

.pos {
  font-style: italic;
  color: var(--ink-secondary);
}

.empty {
  max-width: 60ch;
  padding: var(--s10) var(--s6);
  border: 1px dashed var(--hairline-strong);
  border-radius: 6px;
  color: var(--ink-secondary);
}

.pager {
  display: flex;
  justify-content: space-between;
  gap: var(--s6);
  padding-top: var(--s16);
  padding-bottom: var(--s12);
}

.pager-link {
  display: grid;
  gap: var(--s1);
  min-height: 44px;
  text-decoration: none;
}

.pager-link.to-next {
  text-align: right;
}

.pager-title {
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  font-weight: 500;
  transition: color var(--t-press) var(--ease-out);
}

.pager-link:hover .pager-title {
  color: var(--accent);
}

@media (max-width: 760px) {
  thead {
    display: none;
  }

  .terms tr {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr);
    gap: 2px var(--s3);
    padding: var(--s3) 0;
    border-bottom: 1px solid var(--hairline);
  }

  .terms td {
    padding: 0;
    border: 0;
  }

  .terms td:not(.num) {
    grid-column: 2;
  }

  .num {
    grid-row: 1 / span 4;
    width: auto;
  }
}

.ipa-cell {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
}
</style>
