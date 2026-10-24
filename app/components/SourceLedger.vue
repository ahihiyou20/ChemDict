<script setup lang="ts">
import { hostOf } from '#shared/utils/lexicon'
import { countUp, decodeOnEnter } from '~/lib/motion-kit'

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
      const site = bySite.get(key) ?? { labels: new Map(), urls: new Set(), host, count: 0, lessons: [] }
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
  return () => {
    stopDecode()
    trigger.kill()
    root.classList.remove('armed', 'in')
  }
})
</script>

<template>
  <section ref="section" class="ledger-section" aria-labelledby="source-title">
    <div class="wrap section">
      <div class="section-head">
        <h2 id="source-title" class="section-title">Một số nguồn tham khảo</h2>
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

/* Bars fill to their share after their row has slid in. */
.armed .bar i {
  transform: scaleX(0);
}

.armed.in .bar i {
  transform: scaleX(var(--share));
  transition: transform 0.9s var(--ease-out);
  transition-delay: calc(var(--r) * 90ms + 260ms);
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
