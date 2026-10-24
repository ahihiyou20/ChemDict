<script setup lang="ts">
import type { Entry, Sense } from '#shared/types/lexicon'
import { fold } from '#shared/utils/lexicon'
import { searchLexicon, warmLexiconIndex, type MatchField, type SearchHit } from '~/composables/useLexiconSearch'

const { lessons, entries, senseCount, entryOfSense } = useLexicon()
const router = useRouter()
const pendingFocus = useState('pending-search-focus', () => false)

const query = ref('')
const searched = ref('')
const hits = ref<SearchHit[]>([])
const hovered = ref<string | null>(null)
const input = ref<HTMLInputElement | null>(null)
const results = ref<HTMLOListElement | null>(null)
const instrument = ref<HTMLElement | null>(null)
/** 'armed' until the opening scan has run; CSS keeps the comb at baseline meanwhile. */
const scanState = ref<'armed' | 'done'>('armed')
const plot = ref<HTMLElement | null>(null)
const plotWidth = ref(0)

const RESULT_LIMIT = 8

interface Slot {
  sense: Sense
  entry: Entry
  index: number
}

let slotIndex = 0
const columns = lessons.map((lesson) => ({
  lesson: lesson.number,
  slots: lesson.senses.map((sense): Slot => ({ sense, entry: entryOfSense(sense.id), index: slotIndex++ })),
}))

const maxLessons = Math.max(...entries.map((entry) => entry.lessons.length))
const idlePeak = entries.reduce((best, entry) => (entry.lessons.length > best.lessons.length ? entry : best))
const isQuerying = computed(() => searched.value.length > 0)
const searchActive = useState('search-active', () => false)
watch(isQuerying, (value) => (searchActive.value = value))
const ranked = computed(() => new Map(hits.value.map((hit, rank) => [hit.entry.slug, { hit, rank }])))

function heightOf(entry: Entry): number {
  if (!isQuerying.value) {
    return 0.16 + (maxLessons > 1 ? (0.5 * (entry.lessons.length - 1)) / (maxLessons - 1) : 0)
  }
  const match = ranked.value.get(entry.slug)
  return match ? 0.08 + 0.78 * match.hit.relative : 0.035
}

const percent = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

function annotationOf(slot: Slot): { kind: 'name' | 'value' | 'hover'; text: string } | null {
  if (hovered.value === slot.sense.id) return { kind: 'hover', text: `${slot.sense.en} · ${slot.sense.vi}` }
  if (slot.entry.senses[0]!.id !== slot.sense.id) return null
  if (!isQuerying.value) {
    return slot.entry === idlePeak ? { kind: 'name', text: `${idlePeak.en} · ${idlePeak.lessons.length} bài` } : null
  }
  const match = ranked.value.get(slot.entry.slug)
  if (!match) return null
  if (match.rank === 0) return { kind: 'name', text: slot.entry.en }
  if (match.rank < 3) return { kind: 'value', text: percent.format(match.hit.relative * 100) }
  return null
}

const LABEL_CHAR_PX = 7.4 // 0.75rem mono advance, plus padding slack

/** Keep a peak label inside the plot: centre it when it fits, else hang it off the line's start or end. */
function alignOf(slot: Slot, text: string): 'start' | 'center' | 'end' {
  const width = plotWidth.value
  const position = slot.index / Math.max(senseCount - 1, 1)
  if (!width) return position < 0.18 ? 'start' : position > 0.82 ? 'end' : 'center'
  const x = slotCentres.value[slot.index] ?? position * width
  const half = (text.length * LABEL_CHAR_PX + 12) / 2
  if (x - half >= 0 && x + half <= width) return 'center'
  return x < width / 2 ? 'start' : 'end'
}

const slotCentres = ref<number[]>([])

function measure() {
  if (!plot.value) return
  const box = plot.value.getBoundingClientRect()
  plotWidth.value = box.width
  slotCentres.value = [...plot.value.querySelectorAll<HTMLElement>('.slot')].map((el) => {
    const rect = el.getBoundingClientRect()
    return rect.left - box.left + rect.width / 2
  })
}

const LABEL_GAP_PX = 44

const rawView = computed(() =>
  columns.map((column) => ({
    ...column,
    slots: column.slots.map((slot) => {
      const match = ranked.value.get(slot.entry.slug)
      const annotation = annotationOf(slot)
      return {
        ...slot,
        h: heightOf(slot.entry),
        annotation,
        align: annotation ? alignOf(slot, annotation.text) : 'center',
        state: hovered.value === slot.sense.id
          ? 'hover'
          : !isQuerying.value
            ? 'idle'
            : match
              ? match.rank === 0 ? 'peak' : 'hit'
              : 'miss',
      }
    }),
  })),
)

/** Neighbouring peaks with the same height would print their values on top of each other; keep the higher-ranked one. */
const view = computed(() => {
  const kept: number[] = []
  const ordered = rawView.value
    .flatMap((column) => column.slots)
    .filter((slot) => slot.annotation)
    .sort((a, b) => rank(a.annotation!.kind) - rank(b.annotation!.kind))
  const hidden = new Set<string>()
  for (const slot of ordered) {
    const x = slotCentres.value[slot.index] ?? 0
    if (slot.annotation!.kind === 'value' && kept.some((other) => Math.abs(other - x) < LABEL_GAP_PX)) {
      hidden.add(slot.sense.id)
    } else {
      kept.push(x)
    }
  }
  return rawView.value.map((column) => ({
    ...column,
    slots: column.slots.map((slot) => (hidden.has(slot.sense.id) ? { ...slot, annotation: null } : slot)),
  }))
})

function rank(kind: 'name' | 'value' | 'hover') {
  return kind === 'hover' ? 0 : kind === 'name' ? 1 : 2
}

const visibleHits = computed(() => hits.value.slice(0, RESULT_LIMIT))

const statusText = computed(() => {
  if (!isQuerying.value) return ''
  if (!hits.value.length) return `Không tìm thấy “${searched.value}” trong từ điển.`
  const more = hits.value.length > RESULT_LIMIT ? ` Hiện ${RESULT_LIMIT} mục khớp nhất, các mục còn lại sáng trên phổ.` : ''
  return `${hits.value.length} mục từ khớp với “${searched.value}”.${more}`
})

// Suggestions come from the data so they never point at a missing term.
const lastLesson = [...lessons].reverse().find((lesson) => lesson.senses.length)
const isomer = entries.find((entry) => entry.slug === 'isomer')
const suggestions = [
  idlePeak.en,
  lastLesson ? lastLesson.senses[0]!.vi : null,
  isomer ? fold(isomer.vi).toLowerCase() : null,
].filter((value): value is string => Boolean(value))

let searchToken = 0
let urlTimer: ReturnType<typeof setTimeout> | undefined

watch(query, async (value) => {
  const token = ++searchToken
  const found = await searchLexicon(entries, value)
  if (token !== searchToken) return
  hits.value = found
  searched.value = value.trim()

  clearTimeout(urlTimer)
  urlTimer = setTimeout(() => {
    const q = value.trim()
    if ((new URLSearchParams(window.location.search).get('q') ?? '') !== q) router.replace({ query: q ? { q } : {} })
  }, 300)
})

function open(entry: Entry) {
  navigateTo(`/tu/${entry.slug}`)
}

function clear() {
  query.value = ''
  input.value?.focus()
}

function onSubmit() {
  const top = hits.value[0]
  if (top && searched.value === query.value.trim()) open(top.entry)
}

function resultLinks(): HTMLAnchorElement[] {
  return results.value ? [...results.value.querySelectorAll<HTMLAnchorElement>('a')] : []
}

function onInputKey(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    const first = resultLinks()[0]
    if (first) {
      event.preventDefault()
      first.focus()
    }
  } else if (event.key === 'Escape' && query.value) {
    event.preventDefault()
    query.value = ''
  }
}

function onResultsKey(event: KeyboardEvent) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const links = resultLinks()
  const current = links.indexOf(document.activeElement as HTMLAnchorElement)
  if (current < 0) return
  event.preventDefault()
  const next = current + (event.key === 'ArrowDown' ? 1 : -1)
  if (next < 0) input.value?.focus()
  else links[Math.min(next, links.length - 1)]?.focus()
}

function focusSearch() {
  if (!pendingFocus.value || !input.value) return
  pendingFocus.value = false
  instrument.value?.scrollIntoView({ block: 'start' })
  input.value.focus({ preventScroll: true })
}

watch(pendingFocus, () => nextTick(focusSearch))

let revertScan: (() => void) | undefined
let resizeObserver: ResizeObserver | undefined

onMounted(async () => {
  await router.isReady()
  const initialQuery = router.currentRoute.value.query.q
  const initial = typeof initialQuery === 'string' ? initialQuery : new URLSearchParams(window.location.search).get('q')
  if (initial?.trim()) query.value = initial
  focusSearch()

  if (plot.value) {
    resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(plot.value)
    measure()
  }

  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !instrument.value) {
    scanState.value = 'done'
    return
  }

  // The one wow peak: a single scan sweeps the axis and the comb rises behind it.
  const { gsap } = await import('gsap')
  const scope = instrument.value
  const ctx = gsap.context(() => {
    const inks = gsap.utils.toArray<HTMLElement>('.ink', scope)
    const scan = scope.querySelector('.scan')
    const sweep = 1.6
    gsap
      .timeline({
        onComplete() {
          scanState.value = 'done'
          gsap.set(inks, { clearProps: 'transform' })
          gsap.set(scan, { clearProps: 'all' })
        },
      })
      .set('.scan', { autoAlpha: 1 })
      .fromTo('.scan', { xPercent: 0 }, { xPercent: 100, duration: sweep, ease: 'none' }, 0)
      .fromTo(
        inks,
        { scaleY: 0.04 },
        { scaleY: 1, duration: 0.55, ease: 'power3.out', stagger: { each: sweep / inks.length } },
        0.05,
      )
      .to('.scan', { autoAlpha: 0, duration: 0.25, ease: 'power3.out' }, sweep)
  }, scope)
  revertScan = () => ctx.revert()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  clearTimeout(urlTimer)
  revertScan?.()
})
</script>

<template>
  <div id="tra-cuu" ref="instrument" class="instrument" :data-scan="scanState">
    <form class="plate" role="search" @submit.prevent="onSubmit">
      <label for="tra-cuu-o" class="visually-hidden">Tra thuật ngữ bằng tiếng Anh hoặc tiếng Việt</label>
      <svg class="plate-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M15.5 15.5 21 21" />
      </svg>
      <input
        id="tra-cuu-o"
        ref="input"
        v-model="query"
        type="search"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        enterkeyhint="search"
        aria-describedby="tra-cuu-trang-thai"
        placeholder="alkane, đồng phân…"
        @focus="warmLexiconIndex(entries)"
        @keydown="onInputKey"
      >
      <button v-if="query" type="button" class="clear" aria-label="Xóa từ đang tra" @click="clear">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      <kbd v-else class="kbd" aria-hidden="true">/</kbd>
    </form>
    <div class="spectrum" aria-hidden="true">
      <div ref="plot" class="plot">
        <div class="grid-plane" />
        <div class="columns">
          <div
            v-for="column in view"
            :key="column.lesson"
            class="column"
            :class="{ empty: !column.slots.length }"
            :style="{ flexGrow: Math.max(column.slots.length, 5) }"
          >
            <div
              v-for="slot in column.slots"
              :key="slot.sense.id"
              class="slot"
              :class="`is-${slot.state}`"
              :style="{ '--h': slot.h }"
              @click="open(slot.entry)"
              @pointerenter="hovered = slot.sense.id"
              @pointerleave="hovered = null"
            >
              <span class="line"><span class="ink" /></span>
              <span v-if="slot.annotation" class="peak-label" :class="[`is-${slot.annotation.kind}`, `to-${slot.align}`]">
                {{ slot.annotation.text }}
              </span>
            </div>
          </div>
        </div>
        <div class="scan"><span /></div>
      </div>
      <div class="axis-x">
        <div
          v-for="column in columns"
          :key="column.lesson"
          class="tick"
          :style="{ flexGrow: Math.max(column.slots.length, 5) }"
        >
          <span class="tick-name">B{{ column.lesson }}</span>
          <span class="tick-count">{{ column.slots.length }}</span>
        </div>
      </div>
    </div>

    <div class="readout">
      <noscript>
        <p class="label">Tra cứu trực tiếp cần JavaScript. Mọi mục từ đều có trong <a href="#az-title">danh mục A–Z</a> bên dưới.</p>
      </noscript>
      <p id="tra-cuu-trang-thai" class="label status" :class="{ 'visually-hidden': !statusText || hits.length }" role="status">
        {{ statusText }}
        <a v-if="isQuerying && !hits.length" href="#az-title">Xem danh mục A–Z</a>
      </p>
      <ol v-if="visibleHits.length" ref="results" class="results" @keydown="onResultsKey">
        <li v-for="hit in visibleHits" :key="hit.entry.slug">
          <NuxtLink :to="`/tu/${hit.entry.slug}`" class="result">
            <span class="r-en" lang="en">{{ hit.entry.en }}</span>
            <span class="r-vi" lang="vi">{{ hit.entry.vi }}</span>
            <span class="r-meta">
              <span v-if="hit.entry.senses[0]!.ipa" class="r-ipa" lang="en">{{ hit.entry.senses[0]!.ipa }}</span>
            </span>
          </NuxtLink>
        </li>
      </ol>
      <p v-else-if="!isQuerying" class="suggest label">
        <button v-for="s in suggestions" :key="s" type="button" @click="query = s">{{ s }}</button>
      </p>
    </div>
  </div>
</template>

<style scoped>
.instrument {
  --plot-h: clamp(170px, 30vh, 300px);
  position: relative;
  display: grid;
  gap: 0;
  scroll-margin-top: var(--s6);
}

/* Depth tools 1 + 2: hard under-rule, soft ink shadow, inset edge highlight. */
.plate {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: var(--s3);
  min-height: 72px;
  padding: 0 var(--s4) 0 var(--s5);
  border: 1px solid var(--hairline-strong);
  border-radius: 10px;
  background: var(--ground-elevated);
  box-shadow:
    inset 0 1px 0 var(--highlight),
    0 1px 0 var(--hairline-strong),
    0 18px 30px -22px var(--shadow-ink);
  transition: border-color var(--t-press) var(--ease-out);
}

.plate:focus-within {
  border-color: var(--accent);
}

.plate-icon {
  width: 24px;
  height: 24px;
  flex: none;
  fill: none;
  stroke: var(--ink-secondary);
  stroke-width: 1.8;
  stroke-linecap: round;
}

input {
  flex: 1;
  min-width: 0;
  height: 70px;
  border: 0;
  background: transparent;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: clamp(1.25rem, 2.6vw, 1.75rem);
  font-variation-settings: 'opsz' 36;
  outline: none;
}

input::placeholder {
  color: var(--ink-secondary);
  opacity: 1;
}

input::-webkit-search-cancel-button {
  display: none;
}

.clear {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex: none;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink-secondary);
  cursor: pointer;
  transition: color var(--t-press) var(--ease-out), background-color var(--t-press) var(--ease-out);
}

.clear:hover {
  color: var(--accent);
  background: var(--accent-soft);
}

.clear svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.kbd {
  flex: none;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  padding: 2px 8px;
  border: 1px solid var(--hairline-strong);
  border-radius: 4px;
  color: var(--ink-secondary);
}

/* Without JS the suggestions and the "/" shortcut cannot work, so they stay out of the way. */
html:not(.js) .suggest,
html:not(.js) .kbd {
  display: none;
}

/* Structural overlap: the plate sits over the top edge of the spectrum. */
.spectrum {
  position: relative;
  margin-top: -36px;
  padding: calc(36px + var(--s4)) var(--s4) var(--s3);
  border: 1px solid var(--hairline);
  border-top: 0;
  border-radius: 0 0 10px 10px;
}

.plot {
  position: relative;
  height: var(--plot-h);
  overflow-x: clip;
}

/* Depth tool 3: gridlines sit on a quieter back plane. */
.grid-plane {
  position: absolute;
  inset: 0;
  opacity: 0.7;
  background-image: linear-gradient(to top, var(--hairline) 1px, transparent 1px);
  background-size: 100% 25%;
  border-bottom: 1px solid var(--hairline-strong);
}

.columns,
.axis-x {
  display: flex;
  gap: clamp(8px, 2vw, 24px);
}

.columns {
  position: absolute;
  inset: 0;
}

.column {
  display: flex;
  flex-basis: 0;
  min-width: 0;
}

.column.empty {
  background-image: repeating-linear-gradient(90deg, var(--hairline) 0 1px, transparent 1px 6px);
  background-size: 100% 1px;
  background-repeat: no-repeat;
  background-position: bottom;
}

.slot {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  height: 100%;
  cursor: pointer;
}

.line {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 2px;
  height: 100%;
  margin-left: -1px;
  color: var(--ink-secondary);
  transform-origin: bottom;
  transform: scaleY(var(--h));
  transition: transform var(--t-peak) var(--ease-out), color var(--t-press) var(--ease-out);
}

.ink {
  display: block;
  width: 100%;
  height: 100%;
  background: currentColor;
  transform-origin: bottom;
}

/* Lines wait at baseline noise for the scan; if the app never boots, the failsafe raises them. */
@media (prefers-reduced-motion: no-preference) {
  html.js .instrument[data-scan='armed'] .ink {
    transform: scaleY(0.04);
    animation: scan-failsafe 0.3s var(--ease-out) 4s forwards;
  }
}

@keyframes scan-failsafe {
  to {
    transform: none;
  }
}

.is-hit .line,
.is-peak .line {
  color: var(--accent);
}

.is-miss .line {
  color: var(--hairline-strong);
}

.is-hover .line {
  color: var(--ink);
}

.peak-label {
  position: absolute;
  left: 50%;
  bottom: 0;
  z-index: 1;
  --tx: -50%;
  padding: 1px 6px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  line-height: 1.5;
  white-space: nowrap;
  pointer-events: none;
  color: var(--ink);
  background: var(--ground);
  border-radius: 3px;
  transform: translate(var(--tx), calc(var(--h) * -1 * var(--plot-h) - 6px));
  transition: transform var(--t-peak) var(--ease-out);
}

.peak-label.to-start {
  --tx: -6px;
}

.peak-label.to-end {
  --tx: calc(-100% + 6px);
}

.peak-label.is-name {
  color: var(--accent);
  font-weight: 600;
}

.peak-label.is-value {
  color: var(--ink-secondary);
  background: transparent;
}

.peak-label.is-hover {
  z-index: 2;
  color: var(--ground);
  background: var(--ink);
}

.scan {
  position: absolute;
  inset: 0;
  visibility: hidden;
  pointer-events: none;
}

.scan span {
  position: absolute;
  top: -8px;
  bottom: -8px;
  left: 0;
  width: 2px;
  background: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-soft);
}

.axis-x {
  margin-top: var(--s2);
}

.tick {
  display: flex;
  flex-basis: 0;
  min-width: 0;
  justify-content: space-between;
  gap: var(--s1);
  padding-top: var(--s1);
  border-top: 1px solid var(--hairline-strong);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.tick-count {
  color: var(--ink-secondary);
}

.readout {
  padding-top: var(--s5);
  min-height: 72px;
}

.results {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
  gap: 0 var(--s8);
  margin: var(--s3) 0 0;
  padding: 0;
  list-style: none;
}

.result {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px var(--s4);
  padding: var(--s3) 0;
  border-bottom: 1px solid var(--hairline);
  text-decoration: none;
}

.r-en {
  font-size: 1.375rem;
  font-weight: 500;
  line-height: 1.2;
  font-variation-settings: 'opsz' 30;
  transition: color var(--t-press) var(--ease-out);
}

.result:hover .r-en,
.result:focus-visible .r-en {
  color: var(--accent);
}

.r-vi {
  grid-column: 1;
  color: var(--ink-secondary);
}

.r-meta {
  grid-column: 2;
  grid-row: 1 / span 2;
  display: grid;
  justify-items: end;
  align-content: center;
  gap: 2px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--ink-secondary);
  text-align: right;
}

.suggest {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2);
}

.suggest button {
  min-height: 44px;
  padding: 0 var(--s3);
  border: 1px solid var(--hairline-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: border-color var(--t-press) var(--ease-out), color var(--t-press) var(--ease-out);
}

.suggest button:hover {
  border-color: var(--accent);
  color: var(--accent);
}

@media (max-width: 640px) {
  .plate {
    min-height: 60px;
    padding-left: var(--s4);
  }

  input {
    height: 58px;
  }

  .kbd {
    display: none;
  }

  .spectrum {
    padding-inline: var(--s3);
  }

  .r-meta .r-ipa,
  .tick-count {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .line,
  .peak-label {
    transition: none;
  }
}
</style>
