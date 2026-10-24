<script setup lang="ts">
import { hostOf } from '#shared/utils/lexicon'

const route = useRoute()
const { lessons, sortedEn, entryBySlug } = useLexicon()

const entry = entryBySlug(String(route.params.slug))
if (!entry) {
  throw createError({ statusCode: 404, statusMessage: 'Không có mục từ này trong từ điển', fatal: true })
}

const position = sortedEn.indexOf(entry)
const next = sortedEn[(position + 1) % sortedEn.length]!
const previous = sortedEn[(position - 1 + sortedEn.length) % sortedEn.length]!
const viTerms = [...new Set(entry.senses.map((sense) => sense.vi))]
const lessonTitle = (n: number) => lessons.find((lesson) => lesson.number === n)?.title ?? `Bài ${n}`
const firstDefinition = entry.senses.find((sense) => sense.defVi)?.defVi ?? ''

useSeoMeta({
  title: `${entry.en} – ${viTerms.join(', ')}`,
  description: `${entry.en} (${viTerms.join(', ')}): ${firstDefinition}`,
  ogTitle: `${entry.en} – ${viTerms.join(', ')} · ChemDict`,
  ogDescription: firstDefinition,
})

const headword = ref<HTMLElement | null>(null)
let revert: (() => void) | undefined

onMounted(async () => {
  if (!headword.value || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const [{ gsap }, { SplitText }] = await Promise.all([import('gsap'), import('gsap/SplitText')])
  gsap.registerPlugin(SplitText)
  const target = headword.value
  const ctx = gsap.context(() => {
    SplitText.create(target, {
      type: 'lines,words',
      mask: 'lines',
      autoSplit: true,
      onSplit(self) {
        return gsap.from(self.lines, { yPercent: 105, duration: 0.9, stagger: 0.06, ease: 'power3.out' })
      },
    })
  })
  revert = () => ctx.revert()
})

onBeforeUnmount(() => revert?.())
</script>

<template>
  <article v-if="entry" class="entry">
    <header class="wrap entry-head">
      <p class="label crumbs">
        <NuxtLink to="/">Từ điển</NuxtLink>
      </p>
      <h1 ref="headword" class="headword" lang="en">{{ entry.en }}</h1>
      <p class="headword-vi" lang="vi">{{ viTerms.join(' · ') }}</p>
    </header>

    <ol class="wrap senses">
      <li v-for="(sense, i) in entry.senses" :key="sense.id" class="sense">
        <p class="sense-number" aria-hidden="true">{{ i + 1 }}</p>
        <div class="sense-body">
          <p class="sense-meta">
            <span v-if="sense.ipa || sense.en" class="say">
              <span v-if="sense.ipa" class="ipa" lang="en"><span class="visually-hidden">Phiên âm: </span>{{ sense.ipa }}</span>
              <SpeakButton v-if="sense.en" :text="sense.en" :id="sense.id" />
            </span>
            <span v-if="sense.pos" class="pos">{{ sense.pos }}</span>
            <NuxtLink :to="`/bai/${sense.lesson}`" class="lesson-tag">{{ lessonTitle(sense.lesson) }}</NuxtLink>
          </p>
          <p v-if="viTerms.length > 1" class="sense-term" lang="vi">{{ sense.vi }}</p>

          <div class="defs">
            <div class="def" lang="vi">
              <p class="def-lang label" aria-label="Tiếng Việt">VI</p>
              <p v-if="sense.defVi" class="def-text"><ChemText :text="sense.defVi" /></p>
              <p v-else class="def-text muted">Chưa có định nghĩa tiếng Việt.</p>
            </div>
            <div class="def" lang="en">
              <p class="def-lang label" lang="vi" aria-label="Tiếng Anh">EN</p>
              <p v-if="sense.defEn" class="def-text"><ChemText :text="sense.defEn" /></p>
              <p v-else class="def-text muted" lang="vi">Chưa có định nghĩa tiếng Anh.</p>
            </div>
          </div>

          <figure v-if="sense.illustration?.kind === 'image'" class="figure">
            <img
              :src="sense.illustration.src"
              :width="sense.illustration.width"
              :height="sense.illustration.height"
              :alt="sense.illustration.alt"
              :loading="i === 0 ? 'eager' : 'lazy'"
              decoding="async"
            >
          </figure>
          <div v-else-if="sense.illustration?.kind === 'text'" class="example">
            <p class="label">Minh họa</p>
            <p class="example-text"><ChemText :text="sense.illustration.text" /></p>
          </div>

          <p class="citation label">
            <span>Nguồn:</span>
            <a v-if="sense.source?.url" :href="sense.source.url" target="_blank" rel="noopener noreferrer">
              {{ sense.source.label }}<span v-if="sense.source.label !== hostOf(sense.source.url)" class="host"> ({{ hostOf(sense.source.url) }})</span><span aria-hidden="true"> ↗</span><span class="visually-hidden"> (mở thẻ mới)</span>
            </a>
            <span v-else-if="sense.source">{{ sense.source.label }}</span>
            <span v-else>Internet</span>
          </p>
        </div>
      </li>
    </ol>

    <nav class="next" aria-label="Mục từ kế tiếp">
      <div class="wrap next-inner">
        <NuxtLink :to="`/tu/${next.slug}`" class="next-plate">
          <span class="label">Mục từ tiếp theo</span>
          <span class="next-en" lang="en">{{ next.en }}</span>
          <span class="next-vi" lang="vi">{{ next.vi }}</span>
        </NuxtLink>
        <NuxtLink :to="`/tu/${previous.slug}`" class="previous label">← {{ previous.en }}</NuxtLink>
      </div>
    </nav>
  </article>
</template>

<style scoped>
.entry-head {
  display: grid;
  gap: var(--s3);
  padding-top: clamp(40px, 7vw, 96px);
  padding-bottom: clamp(32px, 5vw, 64px);
}

.crumbs {
  position: relative;
  /* Above the headword's line masks, so the crumb's grown hit area is not covered. */
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.crumbs a {
  text-decoration: none;
}

.headword {
  font-size: clamp(2.6rem, 6.4vw, 6rem);
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.025em;
  font-variation-settings: 'opsz' 72;
  overflow-wrap: anywhere;
}

.headword-vi {
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  line-height: 1.15;
  color: var(--ink-secondary);
  font-variation-settings: 'opsz' 48;
}

.senses {
  margin: 0 auto;
  list-style: none;
}

.sense {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
  gap: var(--s4);
  padding-block: var(--s8) var(--s10);
  border-top: 1px solid var(--ink-secondary);
}

.sense-number {
  font-family: var(--font-mono);
  font-size: 1.5rem;
  line-height: 1;
  color: var(--accent);
}

.sense-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--s6) clamp(24px, 4vw, 56px);
  align-items: start;
}

.sense-meta,
.sense-term,
.citation {
  grid-column: 1 / -1;
}

.sense-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2) var(--s4);
}

.say {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
}

.ipa {
  font-family: var(--font-mono);
  font-size: 1.0625rem;
  color: var(--ink);
}

.pos {
  font-style: italic;
  color: var(--ink-secondary);
}

.lesson-tag {
  position: relative;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 2px 8px;
  border: 1px solid var(--hairline-strong);
  border-radius: 999px;
  text-decoration: none;
  color: var(--ink-secondary);
  transition: border-color var(--t-press) var(--ease-out), color var(--t-press) var(--ease-out);
}

/* Grow small hit areas to at least 44px tall without changing their drawn size. */
.lesson-tag::after,
.crumbs a::after,
.citation a::after {
  content: '';
  position: absolute;
  inset: -14px -6px;
}

.crumbs a {
  position: relative;
}

.lesson-tag:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.sense-term {
  font-size: 1.25rem;
}

.defs {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--s6) clamp(24px, 4vw, 56px);
}

.figure + .citation,
.example + .citation {
  margin-top: 0;
}

.def {
  display: grid;
  gap: var(--s2);
  align-content: start;
}

.def-text {
  max-width: 65ch;
  font-size: clamp(1.125rem, 1.6vw, 1.3125rem);
  line-height: 1.5;
}

.muted {
  color: var(--ink-secondary);
  font-style: italic;
}

/* Structural overlap: on wide screens the plate hangs into the right margin. */
.figure {
  grid-column: 1 / -1;
  justify-self: start;
  width: min(100%, 560px);
  margin: 0;
  padding: var(--s3);
  border: 1px solid var(--hairline-strong);
  border-radius: 6px;
  background: var(--plate);
  box-shadow: 0 1px 0 var(--hairline-strong), 0 24px 40px -30px var(--shadow-ink);
}

.figure img {
  width: 100%;
  border-radius: 2px;
}

.example {
  grid-column: 1 / -1;
  justify-self: start;
  display: grid;
  gap: var(--s1);
  padding: var(--s4) var(--s5);
  border: 1px solid var(--hairline-strong);
  border-radius: 6px;
  background: var(--ground-elevated);
}

.example-text {
  font-family: var(--font-mono);
  font-size: 1.0625rem;
}

.citation {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s1) var(--s2);
  padding-top: var(--s4);
  border-top: 1px dashed var(--hairline-strong);
}

.citation a {
  position: relative;
  color: var(--accent);
}

.host {
  color: var(--ink-secondary);
}

.next {
  margin-top: var(--s12);
  border-top: 1px solid var(--hairline);
  background: var(--ground-elevated);
}

.next-inner {
  display: grid;
  gap: var(--s4);
  padding-block: clamp(48px, 8vw, 112px);
}

.next-plate {
  display: grid;
  gap: var(--s2);
  text-decoration: none;
}

.next-en {
  font-size: clamp(2.25rem, 5.5vw, 5rem);
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.025em;
  font-variation-settings: 'opsz' 72;
  overflow-wrap: anywhere;
  transition: color var(--t-press) var(--ease-out), transform var(--t-press) var(--ease-out);
}

.next-plate:hover .next-en {
  color: var(--accent);
  transform: translateX(6px);
}

.next-vi {
  font-size: 1.375rem;
  color: var(--ink-secondary);
}

.previous {
  justify-self: start;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}

@media (min-width: 1200px) {
  .figure {
    margin-right: calc(var(--gutter) * -1);
  }
}

@media (max-width: 760px) {
  .sense {
    grid-template-columns: 1.75rem minmax(0, 1fr);
    gap: var(--s2);
  }

  .sense-body,
  .defs {
    grid-template-columns: minmax(0, 1fr);
  }
}

</style>
