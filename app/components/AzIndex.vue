<script setup lang="ts">
import type { SortLanguage } from '#shared/types/lexicon'
import { groupByInitial } from '#shared/utils/lexicon'
import { decodeOnEnter, magnetic } from '~/lib/motion-kit'
import { FRONT_LINE } from '~/lib/train'

const { entries } = useLexicon()
const lang = ref<SortLanguage>('en')
const groups = computed(() => groupByInitial(entries, lang.value))
const other = computed<SortLanguage>(() => (lang.value === 'en' ? 'vi' : 'en'))
// Initials take the four lesson flames in turn down the index.
const flameOf = (index: number) => 10 + (index % 4)

const section = ref<HTMLElement | null>(null)
let rearm: (() => void) | undefined

useMotionScope(section, (motion, root) => {
  const { gsap, finePointer } = motion
  const stopDecode = decodeOnEnter(motion, root.querySelector<HTMLElement>('.section-title')!)

  // Each letter group crystallises: a front runs down its list and the terms come out of solution
  // behind it, then its outlined initial fills with flame from the baseline. CSS transitions play it
  // from one class per group (one clip per list, not one animation per term, which cost frames on
  // slow GPUs), so arming the index reads no styles; IntersectionObservers spot the groups.
  let observers: IntersectionObserver[] = []
  const mark = (margin: string, name: string) => {
    const seen = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          if (!record.isIntersecting) continue
          record.target.classList.add(name)
          seen.unobserve(record.target)
        }
      },
      { rootMargin: `0px 0px -${margin} 0px` },
    )
    root.querySelectorAll('.letter').forEach((group) => seen.observe(group))
    return seen
  }
  const arm = (quick: boolean) => {
    observers.forEach((observer) => observer.disconnect())
    root.classList.add('armed')
    root.classList.toggle('quick', quick)
    // The terms come out as soon as their group is on screen; the initial fills when the group
    // reaches the front line the train's liquid runs at (lib/train.ts).
    observers = [mark('8%', 'in'), mark(`${Math.round((1 - FRONT_LINE) * 100)}%`, 'lit')]
  }
  arm(false)
  rearm = () => arm(true)

  const pulls = finePointer ? [...root.querySelectorAll<HTMLElement>('.sorter button')].map((button) => magnetic(gsap, button, 0.25)) : []
  return () => {
    rearm = undefined
    stopDecode()
    observers.forEach((observer) => observer.disconnect())
    root.classList.remove('armed', 'quick')
    pulls.forEach((cleanup) => cleanup())
  }
})

// Re-sorting rebuilds the groups; play the new order in quickly.
watch(lang, () => nextTick(() => rearm?.()))
</script>

<template>
  <section ref="section" class="az" aria-labelledby="az-title">
    <div class="wrap section">
      <div class="section-head az-head">
        <h2 id="az-title" class="section-title">Mọi mục từ</h2>
        <div class="sorter" role="group" aria-label="Xếp danh mục theo">
          <button type="button" :aria-pressed="lang === 'en'" @click="lang = 'en'">Tiếng Anh</button>
          <button type="button" :aria-pressed="lang === 'vi'" @click="lang = 'vi'">Tiếng Việt</button>
        </div>
      </div>

      <div class="letters">
        <section
          v-for="(group, g) in groups"
          :key="`${lang}-${group.letter}`"
          class="letter"
          :aria-label="`Vần ${group.letter}`"
        >
          <p class="letter-mark" aria-hidden="true" :data-lesson="flameOf(g)">
            <span class="outline">{{ group.letter }}</span>
            <span class="fill">{{ group.letter }}</span>
          </p>
          <ul>
            <li v-for="entry in group.entries" :key="entry.slug">
              <NuxtLink :to="`/tu/${entry.slug}`" class="item" :data-lesson="entry.lessons[0]">
                <i class="dot" aria-hidden="true" />
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
  grid-template-columns: 3rem minmax(0, 1fr);
  gap: var(--s3);
  padding: var(--s3) 0 var(--s4);
  border-top: 1px solid var(--hairline-strong);
  break-inside: avoid;
}

/* Outlined initial with a solid copy on top; script wipes the solid copy up from the baseline. */
.letter-mark {
  position: relative;
  font-size: 2.75rem;
  font-weight: 600;
  line-height: 0.9;
  font-variation-settings: 'opsz' 72;
}

.letter-mark .outline {
  color: transparent;
  -webkit-text-stroke: 1px var(--flame-mark);
}

.letter-mark .fill {
  position: absolute;
  inset: 0;
  color: var(--flame-mark);
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  position: relative;
  display: grid;
  padding: 6px 0;
  text-decoration: none;
  min-height: 44px;
  align-content: center;
}

/* Hover: the term steps aside for its lesson's flame dot. */
.dot {
  position: absolute;
  left: 0;
  top: calc(6px + 0.65em);
  width: 8px;
  height: 8px;
  margin-top: -4px;
  border-radius: 50%;
  background: var(--flame-mark);
  transform: scale(0);
  transition: transform var(--t-peak) var(--ease-out);
}

.primary,
.secondary {
  transition: transform var(--t-peak) var(--ease-out), color var(--t-press) var(--ease-out);
}

.primary {
  font-size: 1.125rem;
  line-height: 1.3;
}

.secondary {
  font-size: 0.9375rem;
  line-height: 1.35;
  color: var(--ink-secondary);
  transition-delay: 30ms;
}

/* Entrance, armed by script so readers without it see the index as is. */
.armed .letter .fill {
  clip-path: inset(100% 0% 0% 0%);
}

.armed .letter ul {
  clip-path: inset(0 -24px 100% -24px);
  translate: 0 14px;
}

.armed.quick .letter ul {
  translate: 0 6px;
}

.armed .letter.lit .fill {
  clip-path: inset(0% 0% 0% 0%);
  transition: clip-path 0.9s cubic-bezier(0.65, 0, 0.35, 1);
}

/* The list's front runs a little behind its initial, ending past the box so nothing stays clipped. */
.armed .letter.in ul {
  clip-path: inset(-12px -24px -12px -24px);
  translate: none;
  transition:
    clip-path 0.8s cubic-bezier(0.65, 0, 0.35, 1) 0.2s,
    translate 0.8s var(--ease-out) 0.2s;
}

.armed.quick .letter.lit .fill {
  transition-duration: 0.45s;
}

.armed.quick .letter.in ul {
  transition-duration: 0.4s;
  transition-delay: 0s;
}

.item:hover .dot,
.item:focus-visible .dot {
  transform: none;
}

.item:hover .primary,
.item:hover .secondary,
.item:focus-visible .primary,
.item:focus-visible .secondary {
  transform: translateX(16px);
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
