<script setup lang="ts">
type Theme = 'auto' | 'light' | 'dark'

const STORAGE_KEY = 'chemdict-theme'
const labels: Record<Theme, string> = { auto: 'Tự động', light: 'Sáng', dark: 'Tối' }
const nextTheme: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' }

const theme = useState<Theme>('theme', () => 'auto')

onMounted(() => {
  const pinned = document.documentElement.dataset.theme
  if (pinned === 'light' || pinned === 'dark') theme.value = pinned
})

function cycle() {
  theme.value = nextTheme[theme.value]
  const root = document.documentElement
  if (theme.value === 'auto') delete root.dataset.theme
  else root.dataset.theme = theme.value
  try {
    if (theme.value === 'auto') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, theme.value)
  } catch {
    // Storage can be blocked; the choice still applies for this visit.
  }
}
</script>

<template>
  <button type="button" class="theme" :aria-label="`Giao diện: ${labels[theme]}. Bấm để đổi.`" @click="cycle">
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7" />
      <path v-if="theme !== 'light'" d="M10 3a7 7 0 0 1 0 14z" class="fill" />
      <path v-if="theme === 'auto'" d="M10 3v14" />
    </svg>
    <span>{{ labels[theme] }}</span>
  </button>
</template>

<style scoped>
.theme {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  min-height: 44px;
  min-width: 44px;
  padding: 0 var(--s3);
  border: 1px solid var(--hairline-strong);
  border-radius: 6px;
  background: transparent;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: border-color var(--t-press) var(--ease-out), color var(--t-press) var(--ease-out);
}

.theme:hover {
  border-color: var(--accent);
  color: var(--accent);
}

svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}

.fill {
  fill: currentColor;
  stroke: none;
}
</style>
