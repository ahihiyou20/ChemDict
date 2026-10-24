<script setup lang="ts">
import type { SortLanguage } from '#shared/types/lexicon'
import { groupByInitial } from '#shared/utils/lexicon'

const { entries } = useLexicon()
const lang = ref<SortLanguage>('en')
const groups = computed(() => groupByInitial(entries, lang.value))
const other = computed<SortLanguage>(() => (lang.value === 'en' ? 'vi' : 'en'))
</script>

<template>
  <section class="az" aria-labelledby="az-title">
    <div class="wrap section">
      <div class="section-head az-head">
        <h2 id="az-title" class="section-title">Mọi mục từ</h2>
        <div class="sorter" role="group" aria-label="Xếp danh mục theo">
          <button type="button" :aria-pressed="lang === 'en'" @click="lang = 'en'">Tiếng Anh</button>
          <button type="button" :aria-pressed="lang === 'vi'" @click="lang = 'vi'">Tiếng Việt</button>
        </div>
      </div>

      <div class="letters">
        <section v-for="group in groups" :key="`${lang}-${group.letter}`" class="letter" :aria-label="`Vần ${group.letter}`">
          <p class="letter-mark" aria-hidden="true">{{ group.letter }}</p>
          <ul>
            <li v-for="entry in group.entries" :key="entry.slug">
              <NuxtLink :to="`/tu/${entry.slug}`" class="item">
                <span class="primary" :lang="lang">{{ entry[lang] }}</span>
                <span class="secondary" :lang="other">{{ entry[other] }}</span>
              </NuxtLink>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Hard ground cut: the index lives on the elevated surface. */
.az {
  background: var(--ground-elevated);
  border-block: 1px solid var(--hairline);
}

.az-head {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  column-gap: var(--s8);
}

.az-head .section-title,
.az-head .section-lede {
  grid-column: 1;
}

.sorter {
  grid-column: 2;
  grid-row: 1 / span 2;
  align-self: end;
  display: flex;
  align-items: center;
  gap: var(--s2);
}

.sorter button {
  min-height: 44px;
  padding: 0 var(--s4);
  border: 1px solid var(--hairline-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: background-color var(--t-press) var(--ease-out), color var(--t-press) var(--ease-out), border-color var(--t-press) var(--ease-out);
}

.sorter button:hover {
  border-color: var(--accent);
}

.sorter button[aria-pressed='true'] {
  background: var(--ink);
  border-color: var(--ink);
  color: var(--ground);
}

.letters {
  columns: 3 280px;
  column-gap: var(--s10);
}

.letter {
  display: grid;
  grid-template-columns: 2.5rem minmax(0, 1fr);
  gap: var(--s3);
  padding: var(--s3) 0 var(--s4);
  border-top: 1px solid var(--hairline-strong);
  break-inside: avoid;
}

.letter-mark {
  font-size: 2rem;
  font-weight: 500;
  line-height: 1;
  color: var(--accent);
  font-variation-settings: 'opsz' 72;
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: grid;
  padding: 6px 0;
  text-decoration: none;
  min-height: 44px;
  align-content: center;
}

.primary {
  font-size: 1.125rem;
  line-height: 1.3;
  transition: color var(--t-press) var(--ease-out);
}

.secondary {
  font-size: 0.9375rem;
  line-height: 1.35;
  color: var(--ink-secondary);
}

.item:hover .primary {
  color: var(--accent);
}

@media (max-width: 720px) {
  .az-head {
    grid-template-columns: minmax(0, 1fr);
  }

  .sorter {
    grid-column: 1;
    grid-row: auto;
    flex-wrap: wrap;
  }
}
</style>
