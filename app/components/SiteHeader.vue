<script setup lang="ts">
const { lessons } = useLexicon()
const route = useRoute()
const pendingFocus = useState('pending-search-focus', () => false)

const isHome = computed(() => route.path === '/')
const currentLesson = computed(() => (route.path.startsWith('/bai/') ? Number(route.params.n) : null))

function jumpToSearch() {
  pendingFocus.value = true
  if (!isHome.value) navigateTo('/')
}
</script>

<template>
  <header class="site-header">
    <div class="wrap bar">
      <NuxtLink to="/" class="brand" aria-label="ChemDict, về trang tra cứu">
        <svg class="brand-mark" viewBox="0 0 28 24" aria-hidden="true">
          <path d="M2 23V13M8 23V3M14 23V17M20 23V8M26 23V19" />
        </svg>
        <span class="brand-name">ChemDict</span>
        <span class="brand-sub">Từ điển Hóa học</span>
      </NuxtLink>

      <div class="tools">
        <button v-if="!isHome" type="button" class="jump" @click="jumpToSearch">
          Tra từ <kbd>/</kbd>
        </button>
        <nav aria-label="Bài học">
          <ul class="matrix">
            <li v-for="lesson in lessons" :key="lesson.number">
              <NuxtLink
                :to="`/bai/${lesson.number}`"
                class="cell"
                :class="{ current: currentLesson === lesson.number, empty: !lesson.senses.length }"
                :aria-label="`${lesson.title}: ${lesson.senses.length} thuật ngữ`"
              >
                <span class="cell-count" aria-hidden="true">{{ lesson.senses.length }}</span>
                <span class="cell-number" aria-hidden="true">{{ lesson.number }}</span>
                <span class="cell-name" aria-hidden="true">Bài</span>
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  position: relative;
  z-index: 2;
  border-bottom: 1px solid var(--hairline);
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s4);
  min-height: 72px;
  padding-block: var(--s3);
}

.brand {
  display: inline-flex;
  align-items: baseline;
  gap: var(--s2);
  text-decoration: none;
  min-height: 44px;
  align-items: center;
}

.brand-mark {
  width: 28px;
  height: 24px;
  flex: none;
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.4;
  stroke-linecap: round;
}

.brand-name {
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  font-variation-settings: 'opsz' 36;
}

.brand-sub {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--ink-secondary);
}

.tools {
  display: flex;
  align-items: center;
  gap: var(--s3);
}

.jump {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  min-height: 44px;
  padding: 0 var(--s3);
  border: 1px solid var(--hairline-strong);
  border-radius: 6px;
  background: var(--ground-elevated);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  cursor: pointer;
  box-shadow: inset 0 1px 0 var(--highlight);
  transition: border-color var(--t-press) var(--ease-out), color var(--t-press) var(--ease-out);
}

.jump:hover {
  border-color: var(--accent);
  color: var(--accent);
}

kbd {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 0 6px;
  border: 1px solid var(--hairline-strong);
  border-radius: 4px;
  color: var(--ink-secondary);
}

.matrix {
  display: flex;
  gap: var(--s1);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* The one place the element-cell form appears: functional lesson navigation. */
.cell {
  position: relative;
  display: grid;
  place-items: center;
  width: 48px;
  height: 52px;
  border: 1px solid var(--hairline-strong);
  border-radius: 3px;
  background: var(--ground-elevated);
  box-shadow: inset 0 1px 0 var(--highlight);
  text-decoration: none;
  transition: border-color var(--t-press) var(--ease-out), color var(--t-press) var(--ease-out), transform var(--t-press) var(--ease-out);
}

.cell:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}

.cell.current {
  border-color: var(--accent);
  color: var(--accent);
}

.cell.empty .cell-number {
  color: var(--ink-secondary);
}

.cell-count {
  position: absolute;
  top: 3px;
  left: 5px;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: var(--ink-secondary);
}

.cell-number {
  font-size: 1.375rem;
  font-weight: 600;
  line-height: 1;
  margin-top: 6px;
  font-variation-settings: 'opsz' 36;
}

.cell-name {
  position: absolute;
  bottom: 3px;
  font-family: var(--font-mono);
  font-size: 0.5625rem;
  color: var(--ink-secondary);
}

@media (max-width: 640px) {
  .brand-sub,
  .jump kbd {
    display: none;
  }

  .cell {
    width: 44px;
  }
}

@media (max-width: 420px) {
  .jump {
    display: none;
  }
}
</style>
