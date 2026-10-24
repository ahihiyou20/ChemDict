<script setup lang="ts">
import { hostOf } from '#shared/utils/lexicon'
import { countUp, decodeOnEnter } from '~/lib/motion-kit'
import type { DropDetail } from '~/lib/train'

const { lessons, senseCount } = useLexicon()

interface Row {
  label: string
  url: string | null
  count: number
  lessons: number[]
}

interface Site {
  labels: Map<string, number>
  urls: Set<string>
  host: string | null
  count: number
  lessons: number[]
}

/**
 * One row per site. Its name is the label the sheet uses most for that site; when every label
 * is a page title ("Valence (chemistry) - Wikipedia"), the words they share name the site.
 */
function siteName(site: Site): string {
  const named = [...site.labels].filter(([label]) => label !== site.host)
  if (!named.length) return site.host ?? 'Internet'
  named.sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
  if (named[0]![1] > 1 || named.length === 1) return named[0]![0]
  const words = named.map(([label]) => label.split(/\s+[-–]\s+/))
  const shared = words[0]!.find((part) => words.every((parts) => parts.includes(part)))
  return shared ?? named[0]![0]
}

const rows = computed<Row[]>(() => {
  const bySite = new Map<string, Site>()
  for (const lesson of lessons) {
    for (const sense of lesson.senses) {
      // Senses without a citation are credited to the open web, as Vinh asked.
      const host = sense.source?.url ? hostOf(sense.source.url) : null
      const key = host ?? 'Internet'
      const site: Site = bySite.get(key) ?? { labels: new Map(), urls: new Set(), host, count: 0, lessons: [] }
      const label = sense.source?.label ?? 'Internet'
      site.labels.set(label, (site.labels.get(label) ?? 0) + 1)
      if (sense.source?.url) site.urls.add(sense.source.url)
      site.count++
      if (!site.lessons.includes(lesson.number)) site.lessons.push(lesson.number)
      bySite.set(key, site)
    }
  }
  return [...bySite.values()]
    .map((site) => ({
      label: siteName(site),
      // One page for the whole site links there; otherwise the site's home.
      url: site.urls.size === 1 ? [...site.urls][0]! : site.host ? `https://${site.host}/` : null,
      count: site.count,
      lessons: site.lessons,
    }))
    .sort((a, b) => Number(!a.url) - Number(!b.url) || b.count - a.count)
})

/**
 * The titration the ledger runs: 0.1 M acid titrated with 0.1 M base, each source adding its share of
 * the senses as volume, so the sources together reach the equivalence point and the total tips it over.
 */
const CURVE = { w: 400, h: 100, over: 1.12 }
const pH = (v: number) => {
  const excess = (0.1 - 0.1 * v) / (1 + v)
  const h = (excess + Math.sqrt(excess * excess + 4e-14)) / 2
  return Math.min(14, Math.max(0, -Math.log10(h)))
}
const curveX = (v: number) => (v / CURVE.over) * CURVE.w
const curveY = (v: number) => CURVE.h - (pH(v) / 14) * CURVE.h
const curvePath = (from: number, to: number) => {
  let d = ''
  for (let i = 0; i <= 240; i++) {
    const v = from + ((to - from) * i) / 240
    d += `${i ? 'L' : 'M'}${curveX(v).toFixed(2)} ${curveY(v).toFixed(2)}`
  }
  return d
}
// Phenolphthalein turns at pH 8.2: past that volume the line is drawn in the indicator's pink.
const TURN = (() => {
  let v = 1
  while (pH(v) < 8.2) v += 0.0005
  return v
})()
const curve = { before: curvePath(0, TURN), after: curvePath(TURN, CURVE.over), equivalence: curveX(1) }

/** Volume of base delivered once row `index` has had its drop: the running share of the senses. */
const volumes = computed(() => {
  let sum = 0
  return [...rows.value.map((row) => (sum += row.count) / senseCount), CURVE.over]
})

const section = ref<HTMLElement | null>(null)

useMotionScope(section, (motion, root) => {
  const { gsap, ScrollTrigger } = motion
  const stopDecode = decodeOnEnter(motion, root.querySelector<HTMLElement>('.section-title')!)
  // Rows are entered into the ledger one by one (CSS transitions, so no style reads), and their counts tally up.
  const counts = gsap.utils.toArray<HTMLElement>('.count', root).map((cell) => countUp(gsap, cell, { paused: true }))
  root.classList.add('armed')
  const trigger = ScrollTrigger.create({
    trigger: root.querySelector('table'),
    start: 'top 85%',
    once: true,
    onEnter: () => {
      root.classList.add('in')
      counts.forEach((count, i) => count.delay(0.2 + i * 0.09).restart(true))
    },
  })

  // When the home page's train is running, its burette titrates the ledger: each drop fills its row's
  // bar and carries the curve on to that row's volume (lib/train.ts). Elsewhere the bars fill on sight.
  const rowEls = [...root.querySelectorAll<HTMLElement>('tbody tr, tfoot tr')]
  const plot = root.querySelector<HTMLElement>('.curve')
  const frame = plot?.querySelector<HTMLElement>('.curve-frame')
  const paper = plot?.querySelector<HTMLElement>('.curve-paper')
  const tip = plot?.querySelector<HTMLElement>('.curve-tip')
  const drawn = { v: 0 }
  const draw = () => {
    if (!plot || !frame || !paper || !tip) return
    const width = plot.clientWidth
    const height = plot.clientHeight
    const x = (curveX(drawn.v) / CURVE.w) * width
    gsap.set(frame, { x: x - width })
    gsap.set(paper, { x: width - x })
    gsap.set(tip, { x, y: (curveY(drawn.v) / CURVE.h) * height, opacity: drawn.v > 0 ? 1 : 0 })
  }
  const onTrain = () => {
    if (root.classList.contains('titrating')) return
    root.classList.add('titrating')
    draw()
  }
  const onDrop = (event: Event) => {
    const { index } = (event as CustomEvent<DropDetail>).detail
    onTrain()
    rowEls[index]?.classList.add('titrated')
    gsap.to(drawn, { v: volumes.value[index] ?? CURVE.over, duration: 0.7, ease: 'power2.out', overwrite: true, onUpdate: draw })
    if (index === rowEls.length - 1) root.classList.add('turned')
  }
  document.addEventListener('rx:train', onTrain)
  document.addEventListener('rx:drop', onDrop)
  const resize = new ResizeObserver(draw)
  if (plot) resize.observe(plot)

  return () => {
    stopDecode()
    trigger.kill()
    resize.disconnect()
    document.removeEventListener('rx:train', onTrain)
    document.removeEventListener('rx:drop', onDrop)
    root.classList.remove('armed', 'in', 'titrating', 'turned')
  }
})
</script>

<template>
  <section ref="section" class="ledger-section" aria-labelledby="source-title">
    <div class="wrap section">
      <div class="section-head ledger-head">
        <h2 id="source-title" class="section-title">Một số nguồn tham khảo</h2>
        <div class="curve" aria-hidden="true">
          <svg class="axes" :viewBox="`0 0 ${CURVE.w} ${CURVE.h}`" preserveAspectRatio="none">
            <path :d="`M0 0V${CURVE.h}H${CURVE.w}`" />
            <path class="equivalence" :d="`M${curve.equivalence} 0V${CURVE.h}`" />
          </svg>
          <div class="curve-frame">
            <svg class="curve-paper" :viewBox="`0 0 ${CURVE.w} ${CURVE.h}`" preserveAspectRatio="none">
              <path class="line" :d="curve.before" />
              <path class="line past" :d="curve.after" />
            </svg>
          </div>
          <i class="curve-tip" />
          <span class="axis-label label">pH</span>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <caption class="visually-hidden">Một số nguồn tham khảo</caption>
          <thead>
            <tr>
              <th scope="col">Nguồn</th>
              <th scope="col">Liên kết</th>
              <th scope="col">Bài</th>
              <th scope="col" class="abundance"><span class="visually-hidden">Tỉ lệ</span></th>
              <th scope="col" class="num">Số thuật ngữ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, r) in rows" :key="row.label" :style="{ '--r': r }" :data-lessons="row.lessons.join(' ')">
              <td>{{ row.label }}</td>
              <td class="mono">
                <a v-if="row.url" :href="row.url" target="_blank" rel="noopener noreferrer">{{ hostOf(row.url) }}<span class="visually-hidden"> (mở thẻ mới)</span></a>
                <span v-else class="muted" aria-label="không có liên kết">—</span>
              </td>
              <td class="mono tags">
                <span v-for="n in row.lessons" :key="n" class="tag" :data-lesson="n">B{{ n }}</span>
              </td>
              <td class="abundance" aria-hidden="true">
                <span class="bar"><i :style="{ '--share': row.count / senseCount }" /></span>
              </td>
              <td class="mono num count">{{ row.count }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr :style="{ '--r': rows.length }">
              <td colspan="3">Tổng</td>
              <td class="abundance" aria-hidden="true"><span class="bar endpoint"><i style="--share: 1" /></span></td>
              <td class="mono num count">{{ senseCount }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 1rem;
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

.mono {
  font-size: 0.8125rem;
}

.num {
  text-align: right;
  padding-right: 0;
  font-variant-numeric: tabular-nums;
}

.muted {
  color: var(--ink-secondary);
}

tfoot td {
  border-bottom: 0;
  font-weight: 600;
}

/* Entrance, armed by script: each row's cells slide in one after another. */
.armed td {
  opacity: 0;
  translate: -18px 0;
}

.armed.in td {
  opacity: 1;
  translate: none;
  transition: opacity 0.55s var(--ease-out), translate 0.55s var(--ease-out);
  transition-delay: calc(var(--r) * 90ms + var(--c, 0) * 50ms);
}

/* Bars fill to their share after their row has slid in, or, on the home page, as its drop lands. */
.armed .bar i {
  transform: scaleX(0);
}

.armed.in:not(.titrating) .bar i {
  transform: scaleX(var(--share));
  transition: transform 0.9s var(--ease-out);
  transition-delay: calc(var(--r) * 90ms + 260ms);
}

.armed.titrating .titrated .bar i {
  transform: scaleX(var(--share));
}

td:nth-child(2) {
  --c: 1;
}

td:nth-child(3) {
  --c: 2;
}

td:nth-child(4) {
  --c: 3;
}

td:nth-child(5) {
  --c: 4;
}

/* The titration curve fills the head's free width; it waits for the train, drawn complete without it. */
.ledger-head {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: end;
  column-gap: clamp(var(--s8), 5vw, var(--s16));
}

.curve {
  position: relative;
  justify-self: end;
  width: min(100%, 440px);
  height: 88px;
  margin-bottom: 0.4em;
}

.curve svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.axes path {
  fill: none;
  stroke: var(--hairline-strong);
  vector-effect: non-scaling-stroke;
}

.axes .equivalence {
  stroke-dasharray: 3 4;
}

.curve-frame {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

/* The frame and the paper counter-move, so the line is uncovered without moving. */
.curve-frame,
.curve-paper {
  will-change: transform;
}

.line {
  fill: none;
  stroke: var(--ink-secondary);
  stroke-width: 1.5;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.line.past {
  stroke: var(--accent);
  stroke-width: 2;
}

.curve-tip {
  position: absolute;
  top: 0;
  left: 0;
  width: 7px;
  height: 7px;
  margin: -3.5px 0 0 -3.5px;
  border-radius: 50%;
  background: var(--ink);
  opacity: 0;
  transition: background-color 0.4s var(--ease-out);
}

.turned .curve-tip {
  background: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in oklch, var(--accent) 22%, transparent);
}

.axis-label {
  position: absolute;
  top: -4px;
  left: 8px;
  color: var(--ink-secondary);
}

@media (max-width: 860px) {
  .ledger-head {
    grid-template-columns: minmax(0, 1fr);
  }

  .curve {
    justify-self: stretch;
    width: 100%;
    height: 64px;
  }
}

/* Relative abundance, as a mass spectrum reports it: each site's share of the senses. */
.abundance {
  width: 34%;
}

.bar {
  display: block;
  height: 10px;
  border-radius: 1px;
  background: color-mix(in oklch, var(--hairline) 55%, transparent);
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  background: var(--ink-secondary);
  transform: scaleX(var(--share));
  transform-origin: 0 50%;
}

.endpoint i {
  background: var(--accent);
}

/* At the endpoint the indicator turns: every titrated bar flushes pink with the flask. */
.titrating .bar i {
  transition: transform 0.7s var(--ease-out), background-color 0.9s var(--ease-out) 0.2s;
}

.turned .bar i {
  background: var(--accent);
}

.tags {
  white-space: nowrap;
}

.tag + .tag {
  margin-left: 0.6ch;
}

.tag {
  color: var(--ink-secondary);
}

.tag::before {
  content: '';
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 0.45ch;
  border-radius: 50%;
  background: var(--flame-mark);
  vertical-align: 0.05em;
}

/* A 44px tall hit area without loosening the table rhythm. */
a {
  display: inline-block;
  padding-block: 13px;
  margin-block: -13px;
}

@media (max-width: 640px) {
  thead {
    display: none;
  }

  tr {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px var(--s4);
    padding: var(--s3) 0;
    border-bottom: 1px solid var(--hairline);
  }

  td {
    padding: 0;
    border: 0;
  }

  td:first-child {
    grid-column: 1 / -1;
  }

  tfoot tr {
    border-bottom: 0;
  }

  .abundance {
    width: auto;
    align-self: center;
  }
}
</style>
