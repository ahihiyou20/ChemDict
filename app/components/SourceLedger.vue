<script setup lang="ts">
import { hostOf } from '#shared/utils/lexicon'

const { lessons, senseCount } = useLexicon()

interface Row {
  label: string
  url: string | null
  count: number
  lessons: number[]
}

const rows = computed(() => {
  const byKey = new Map<string, Row>()
  for (const lesson of lessons) {
    for (const sense of lesson.senses) {
      // Senses without a citation are credited to the open web, as Vinh asked.
      const label = sense.source?.label ?? 'Internet'
      const url = sense.source?.url ?? null
      const key = `${label}|${url}`
      const row = byKey.get(key) ?? { label, url, count: 0, lessons: [] }
      row.count++
      if (!row.lessons.includes(lesson.number)) row.lessons.push(lesson.number)
      byKey.set(key, row)
    }
  }
  // Rows without a citation go last so the cited sources lead the ledger.
  return [...byKey.values()].sort((a, b) => Number(!a.url) - Number(!b.url) || b.count - a.count)
})
</script>

<template>
  <section class="ledger-section" aria-labelledby="source-title">
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
              <th scope="col" class="num">Số thuật ngữ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="`${row.label}|${row.url}`">
              <td>{{ row.label }}</td>
              <td class="mono">
                <a v-if="row.url" :href="row.url" target="_blank" rel="noopener noreferrer">{{ hostOf(row.url) }}<span class="visually-hidden"> (mở thẻ mới)</span></a>
                <span v-else class="muted" aria-label="không có liên kết">—</span>
              </td>
              <td class="mono">{{ row.lessons.map((n) => `B${n}`).join(', ') }}</td>
              <td class="mono num">{{ row.count }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3">Tổng</td>
              <td class="mono num">{{ senseCount }}</td>
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
}

.muted {
  color: var(--ink-secondary);
}

tfoot td {
  border-bottom: 0;
  font-weight: 600;
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
}
</style>
