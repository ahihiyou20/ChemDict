<script setup lang="ts">
const route = useRoute()
const { lessons, entryOfSense } = useLexicon()

const index = lessons.findIndex((lesson) => String(lesson.number) === String(route.params.n))
const lesson = lessons[index]
if (!lesson) {
  throw createError({ statusCode: 404, statusMessage: 'Không có bài này trong bảng từ vựng', fatal: true })
}
const previous = lessons[index - 1]
const next = lessons[index + 1]

useSeoMeta({
  title: `${lesson.title}: ${lesson.senses.length} thuật ngữ`,
  description: lesson.senses.length
    ? `Thuật ngữ Hóa học ${lesson.title}: ${lesson.senses.map((sense) => sense.vi).join(', ')}.`
    : `${lesson.title} chưa có thuật ngữ trong bảng từ vựng.`,
})
</script>

<template>
  <div v-if="lesson" class="lesson">
    <header class="wrap lesson-head">
      <p class="label crumbs">
        <NuxtLink to="/">Từ điển</NuxtLink>
        <span aria-hidden="true">/</span>
        <span>Thẻ “{{ lesson.title }}” trong bảng từ vựng</span>
      </p>
      <h1 class="lesson-title">{{ lesson.title }}</h1>
      <p class="lede">{{ lesson.senses.length }} thuật ngữ, theo đúng thứ tự các dòng trong bảng.</p>
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
            <td class="mono ipa" lang="en">{{ sense.ipa }}</td>
            <td class="pos">{{ sense.pos }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">
        Thẻ “{{ lesson.title }}” trong bảng từ vựng hiện chưa có thuật ngữ nào. Trang này sẽ có nội dung khi bảng được bổ sung.
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
  display: grid;
  gap: var(--s3);
  padding-top: clamp(40px, 7vw, 96px);
  padding-bottom: clamp(32px, 5vw, 56px);
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
</style>
