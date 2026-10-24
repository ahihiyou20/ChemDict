<script setup lang="ts">
import { hostOf } from '#shared/utils/lexicon'
import { magnetic, pointerLift } from '~/lib/motion-kit'

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

const article = ref<HTMLElement | null>(null)

// The entry is the lookup's answer, so nothing on it waits to appear: motion plays over content that is
// already readable. The headword's letters ripple, the flame bar burns in, and each sense's rule and
// numeral draw as the reader reaches them.
useMotionScope(article, ({ gsap, ScrollTrigger, SplitText, finePointer }, root) => {
  const cleanups: (() => void)[] = []
  const headword = root.querySelector<HTMLElement>('.headword')!
  let release: (() => void) | undefined
  const split = SplitText.create(headword, {
    type: 'words,chars',
    onSplit(self) {
      release?.()
      if (finePointer) release = pointerLift(gsap, headword, self.chars as HTMLElement[], { lift: 18 })
    },
  })
  gsap.to(split.chars, {
    keyframes: { yPercent: [0, -24, 0], rotation: [0, -4, 0], easeEach: 'sine.inOut' },
    duration: 0.75,
    stagger: 0.028,
    delay: 0.05,
  })
  const flame = root.querySelector('.entry-flame')!
  if (revealPre(flame)) {
    gsap.from(flame.children, { scaleX: 0, transformOrigin: '0% 50%', duration: 0.55, ease: 'power3.out', stagger: 0.09, delay: 0.15 })
  }

  gsap.utils.toArray<HTMLElement>('.sense', root).forEach((sense) => {
    const rule = sense.querySelector('.sense-rule')!
    const fill = sense.querySelector('.sense-number .fill')!
    // Decorations wait hidden (data-pre) so they never flash before drawing in.
    if (revealPre(rule) && revealPre(fill)) {
      gsap.set(rule, { scaleX: 0, transformOrigin: '0% 50%' })
      gsap.set(fill, { clipPath: 'inset(100% 0% 0% 0%)' })
      ScrollTrigger.create({
        trigger: sense,
        start: 'top 90%',
        once: true,
        onEnter: () => {
          gsap.to(rule, { scaleX: 1, duration: 1.1, ease: 'power3.inOut' })
          gsap.to(fill, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, delay: 0.25, ease: 'power3.inOut', clearProps: 'clipPath' })
        },
      })
    }

    // The illustration plate settles as it arrives and drifts against the scroll inside its window.
    // A plate already on screen stays put: it is part of the answer.
    const figure = sense.querySelector<HTMLElement>('.figure')
    if (!figure) return
    if (figure.getBoundingClientRect().top > window.innerHeight) {
      gsap.from(figure, { y: 36, rotation: -1.2, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: figure, start: 'top 92%', once: true } })
    }
    const image = figure.querySelector('img')
    if (image)
      gsap.fromTo(
        image,
        { yPercent: -3, scale: 1.07 },
        { yPercent: 3, scale: 1.07, ease: 'none', scrollTrigger: { trigger: figure, start: 'top bottom', end: 'bottom top', scrub: true } },
      )
  })

  // Next entry: the plate floods with the next lesson's flame and the arrow follows the pointer.
  const plate = root.querySelector<HTMLElement>('.next-plate')
  if (plate) {
    const nextSplit = SplitText.create(plate.querySelector('.next-en'), { type: 'words,chars' })
    const ripple = () =>
      gsap.fromTo(nextSplit.chars, { yPercent: 0 }, { keyframes: { yPercent: [0, -18, 0], easeEach: 'sine.inOut' }, duration: 0.5, stagger: 0.018, overwrite: true })
    plate.addEventListener('pointerenter', ripple)
    cleanups.push(() => plate.removeEventListener('pointerenter', ripple), () => nextSplit.revert())
    if (finePointer) cleanups.push(magnetic(gsap, plate, 0.5, plate.querySelector<HTMLElement>('.next-arrow')!))
  }

  return () => {
    release?.()
    split.revert()
    cleanups.forEach((cleanup) => cleanup())
  }
})
</script>

<template>
  <article v-if="entry" ref="article" class="entry">
    <header class="wrap entry-head">
      <p class="label crumbs">
        <NuxtLink to="/">Từ điển</NuxtLink>
      </p>
      <h1 class="headword" lang="en">{{ entry.en }}</h1>
      <p class="headword-vi" lang="vi">{{ viTerms.join(' · ') }}</p>
      <p class="entry-flame" aria-hidden="true" data-pre>
        <i v-for="n in entry.lessons" :key="n" :data-lesson="n" />
        <i />
      </p>
    </header>

    <ol class="wrap senses">
      <li v-for="(sense, i) in entry.senses" :key="sense.id" class="sense" :data-lesson="sense.lesson">
        <span class="sense-rule" aria-hidden="true" data-pre />
        <p class="sense-number" aria-hidden="true">
          <span class="outline">{{ i + 1 }}</span>
          <span class="fill" data-pre>{{ i + 1 }}</span>
        </p>
        <div class="sense-body">
          <p class="sense-meta">
            <span v-if="sense.ipa || sense.en" class="say">
              <span v-if="sense.ipa" class="ipa" lang="en"><span class="visually-hidden">Phiên âm: </span>{{ sense.ipa }}</span>
              <SpeakButton v-if="sense.en" :text="sense.en" :id="sense.id" />
            </span>
            <span v-if="sense.pos" class="pos">{{ sense.pos }}</span>
            <NuxtLink :to="`/bai/${sense.lesson}`" class="lesson-tag"><i class="tag-dot" aria-hidden="true" />{{ lessonTitle(sense.lesson) }}</NuxtLink>
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
            <div class="figure-window">
              <img
                :src="sense.illustration.src"
                :width="sense.illustration.width"
                :height="sense.illustration.height"
                :alt="sense.illustration.alt"
                :loading="i === 0 ? 'eager' : 'lazy'"
                decoding="async"
              >
            </div>
          </figure>
          <LabDiagram
            v-else-if="sense.illustration?.kind === 'diagram'"
            :name="sense.illustration.name"
            :en="sense.en"
            :vi="sense.vi"
            :pos="sense.pos"
          />
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
        <NuxtLink :to="`/tu/${next.slug}`" class="next-plate" :data-lesson="next.lessons[0]">
          <span class="wipe" aria-hidden="true" />
          <span class="label">Mục từ tiếp theo</span>
          <span class="next-line">
            <span class="next-en" lang="en">{{ next.en }}</span>
            <span class="next-arrow" aria-hidden="true">→</span>
          </span>
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
  /* Above the headword's split letters, so the crumb's grown hit area is not covered. */
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

/* The entry's lessons as flame bands, closed by the accent. */
.entry-flame {
  display: flex;
  gap: 6px;
  width: min(100%, 280px);
  height: 6px;
  margin-top: var(--s2);
}

.entry-flame i {
  flex: 1;
  border-radius: 1px;
  background: var(--flame-mark);
}

.senses {
  margin: 0 auto;
  list-style: none;
}

.sense {
  position: relative;
  display: grid;
  grid-template-columns: 4rem minmax(0, 1fr);
  gap: var(--s4);
  padding-block: var(--s8) var(--s10);
}

.sense-rule {
  position: absolute;
  inset: 0 0 auto;
  height: 1px;
  background: var(--ink-secondary);
}

/* Outlined numeral with a solid copy that script wipes up in the sense's lesson flame. */
.sense-number {
  position: relative;
  align-self: start;
  font-size: 3.5rem;
  font-weight: 600;
  line-height: 0.85;
  font-variation-settings: 'opsz' 72;
}

.sense-number .outline {
  color: transparent;
  -webkit-text-stroke: 1px var(--flame-mark);
}

.sense-number .fill {
  position: absolute;
  inset: 0;
  color: var(--flame-mark);
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 2px 10px 2px 8px;
  border: 1px solid var(--flame-mark);
  border-radius: 999px;
  text-decoration: none;
  color: var(--ink);
  transition: background-color var(--t-press) var(--ease-out), color var(--t-press) var(--ease-out);
}

.tag-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--flame-mark);
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
  background: var(--flame);
  color: var(--on-flame);
}

.lesson-tag:hover .tag-dot {
  background: var(--on-flame);
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

.figure-window {
  overflow: hidden;
  border-radius: 2px;
}

.figure img {
  width: 100%;
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
  position: relative;
  display: grid;
  gap: var(--s2);
  padding: var(--s6) var(--s6) var(--s8);
  margin-inline: calc(var(--s6) * -1);
  border-radius: 8px;
  overflow: hidden;
  isolation: isolate;
  text-decoration: none;
}

/* Hover floods the plate with the next entry's lesson flame, left to right. */
.wipe {
  position: absolute;
  inset: 0;
  z-index: -1;
  background: var(--flame);
  transform: scaleX(0);
  transform-origin: right;
  transition: transform 520ms var(--ease-out);
}

.next-plate:hover .wipe,
.next-plate:focus-visible .wipe {
  transform: none;
  transform-origin: left;
}

.next-plate .label,
.next-line,
.next-vi {
  transition: color var(--t-peak) var(--ease-out);
}

.next-plate:hover .label,
.next-plate:hover .next-line,
.next-plate:hover .next-vi,
.next-plate:focus-visible .label,
.next-plate:focus-visible .next-line,
.next-plate:focus-visible .next-vi {
  color: var(--on-flame);
}

.next-line {
  display: flex;
  align-items: baseline;
  gap: 0.3em;
  font-size: clamp(2.25rem, 5.5vw, 5rem);
}

.next-en {
  min-width: 0;
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.025em;
  font-variation-settings: 'opsz' 72;
  overflow-wrap: anywhere;
}

.next-arrow {
  display: inline-block;
  font-size: 0.8em;
  line-height: 1;
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
    grid-template-columns: 2.5rem minmax(0, 1fr);
    gap: var(--s2);
  }

  .sense-number {
    font-size: 2.25rem;
  }

  .next-plate {
    padding-inline: var(--gutter);
    margin-inline: calc(var(--gutter) * -1);
    border-radius: 0;
  }

  .sense-body,
  .defs {
    grid-template-columns: minmax(0, 1fr);
  }
}

</style>
