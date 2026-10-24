<script setup lang="ts">
import { magnetic, tilt } from '~/lib/motion-kit'

const { lessons } = useLexicon()
const route = useRoute()
const pendingFocus = useState('pending-search-focus', () => false)

const isHome = computed(() => route.path === '/')
const currentLesson = computed(() => (route.path.startsWith('/bai/') ? Number(route.params.n) : null))

function jumpToSearch() {
  pendingFocus.value = true
  if (!isHome.value) navigateTo('/')
}

const header = ref<HTMLElement | null>(null)
// The brand's five spectral lines, in the four lesson flames and the accent.
const bars = [
  { x: 2, top: 13, lesson: 10 },
  { x: 8, top: 3, lesson: 11 },
  { x: 14, top: 17, lesson: 12 },
  { x: 20, top: 8, lesson: 13 },
  { x: 26, top: 19, lesson: null },
]

useMotionScope(header, ({ gsap, finePointer }, root) => {
  const lines = root.querySelectorAll<SVGElement>('.brand-mark line')
  // The lines ring like an emission spectrum: once on arrival, again whenever the brand is hovered.
  const ring = () =>
    gsap.fromTo(
      lines,
      { scaleY: 1 },
      { keyframes: { scaleY: [1, 0.25, 1.15, 1], easeEach: 'sine.inOut' }, duration: 0.8, stagger: 0.06, overwrite: true },
    )
  gsap.set(lines, { transformOrigin: '50% 100%' })
  ring()
  const brand = root.querySelector<HTMLElement>('.brand')!
  brand.addEventListener('pointerenter', ring)

  // The lesson numbers turn over once inside their tiles, like a departure board settling.
  // The tiles themselves stay square to the screen, so a tap during the flip still lands.
  const cells = gsap.utils.toArray<HTMLElement>('.cell', root)
  const flaps = cells.map((cell) => [...cell.querySelectorAll<HTMLElement>('.cell-count, .cell-number')])
  gsap.set(flaps.flat(), { transformPerspective: 160 })
  flaps.forEach((flap, i) =>
    gsap.fromTo(flap, { rotationX: 0 }, {
      rotationX: 360,
      duration: 1.1,
      ease: 'power3.inOut',
      delay: 0.25 + i * 0.08,
      onComplete: () => gsap.set(flap, { rotationX: 0 }),
    }),
  )

  const cleanups = finePointer
    ? cells.flatMap((cell) => [magnetic(gsap, cell, 0.22), tilt(gsap, cell, 16)])
    : []
  return () => {
    brand.removeEventListener('pointerenter', ring)
    cleanups.forEach((cleanup) => cleanup())
  }
})
</script>

<template>
  <header ref="header" class="site-header">
    <div class="wrap bar">
      <NuxtLink to="/" class="brand" aria-label="ChemDict, về trang tra cứu">
        <svg class="brand-mark" viewBox="0 0 28 24" aria-hidden="true">
          <line
            v-for="bar in bars"
            :key="bar.x"
            :x1="bar.x"
            :x2="bar.x"
            :y1="23"
            :y2="bar.top"
            :data-lesson="bar.lesson ?? undefined"
          />
        </svg>
        <span class="brand-name">ChemDict</span>
        <span class="brand-sub">Từ điển Hóa học</span>
      </NuxtLink>

      <div class="tools">
        <ThemeToggle class="header-theme" />
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
                :data-lesson="lesson.number"
                :aria-label="`${lesson.title}: ${lesson.senses.length} thuật ngữ`"
              >
                <span class="cell-fill" aria-hidden="true" />
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
  overflow: visible;
  fill: none;
  stroke-width: 2.4;
  stroke-linecap: round;
}

.brand-mark line {
  stroke: var(--flame-mark);
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

/* The one place the element-cell form appears: functional lesson navigation. Each tile burns in its lesson's flame. */
.cell {
  position: relative;
  display: grid;
  place-items: center;
  width: 48px;
  height: 52px;
  overflow: hidden;
  border: 1px solid var(--hairline-strong);
  border-radius: 3px;
  background: var(--ground-elevated);
  box-shadow: inset 0 1px 0 var(--highlight), inset 0 -3px 0 var(--flame-mark);
  text-decoration: none;
  transition: border-color var(--t-press) var(--ease-out), color var(--t-peak) var(--ease-out);
}

.cell-fill {
  position: absolute;
  inset: 0;
  background: var(--flame);
  transform: scaleY(0);
  transform-origin: bottom;
  transition: transform var(--t-peak) var(--ease-out);
}

.cell > span:not(.cell-fill) {
  transition: color var(--t-peak) var(--ease-out);
}

.cell:hover,
.cell.current {
  border-color: var(--flame-mark);
}

.cell:hover .cell-fill,
.cell.current .cell-fill {
  transform: none;
}

.cell:hover > span:not(.cell-fill),
.cell.current > span:not(.cell-fill) {
  color: var(--on-flame);
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
  /* Positioned, so it paints above the flame fill. */
  position: relative;
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

@media (max-width: 860px) {
  .header-theme {
    display: none;
  }
}

@media (max-width: 420px) {
  .jump {
    display: none;
  }
}
</style>
