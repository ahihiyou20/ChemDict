<script setup lang="ts">
import { DROP_FALL, LESSONS, measureTrain, type DropDetail, type Layout, type Pipe } from '~/lib/train'

/**
 * The separation train (COMMIT-SHEET §10): one piece of glassware drawn through the home page's
 * gutters and section seams, run by the reader's scroll. The marquee is its condenser; the distillate
 * runs down to a chromatography column at the seam of the A–Z and the lessons, the column separates it
 * into the four lesson flames, each fraction feeds its lesson's strip while a chart recorder in the other
 * gutter writes its peak, and what is left runs across to a burette that titrates the source ledger,
 * drop by drop, to a pink endpoint. Beside the A–Z the pot boils, its bubbles rising to the condenser.
 *
 * Geometry is measured from the sections (lib/train.ts), so the glass never crosses text. Every liquid
 * moves by transform only, driven from the scroll position.
 */

const layer = ref<HTMLElement | null>(null)
const layout = shallowRef<Layout | null>(null)

const vertical = (p: Pipe) => p.x0 === p.x1

function pipeStyle(p: Pipe, lw: number) {
  return vertical(p)
    ? { left: `${p.x0 - lw / 2}px`, top: `${Math.min(p.y0, p.y1)}px`, width: `${lw}px`, height: `${Math.abs(p.y1 - p.y0)}px`, background: p.color, transformOrigin: p.y1 >= p.y0 ? '50% 0' : '50% 100%', transform: 'scaleY(0)' }
    : { left: `${Math.min(p.x0, p.x1)}px`, top: `${p.y0 - lw / 2}px`, width: `${Math.abs(p.x1 - p.x0)}px`, height: `${lw}px`, background: p.color, transformOrigin: p.x1 >= p.x0 ? '0 50%' : '100% 50%', transform: 'scaleX(0)' }
}

const box = (left: number, top: number, width: number, height: number) => ({ left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` })

/** The glass, as one path for the pipes and outlines for the vessels. */
const glass = computed(() => {
  const l = layout.value
  if (!l) return null
  const pipes = l.pipes.map((p) => `M${p.x0} ${p.y0}L${p.x1} ${p.y1}`).join('')
  const c = l.column
  const b = l.burette
  const ticks: string[] = []
  for (let y = b.top + 10, i = 0; y < b.bottom - 4; y += 8, i++) {
    const long = i % 5 === 0
    ticks.push(`M${b.x - b.w / 2 - (long ? 6 : 3)} ${y}h${long ? 6 : 3}`)
  }
  const f = l.flask
  const neck = f.w * 0.32
  const flaskPath = `M${f.x - neck / 2} ${f.top}v${f.h * 0.3}L${f.x - f.w / 2} ${f.top + f.h}H${f.x + f.w / 2}L${f.x + neck / 2} ${f.top + f.h * 0.3}V${f.top}`
  const stopcock = `M${b.x - b.w * 0.9} ${b.bottom + 3}h${b.w * 1.8}M${b.x} ${b.bottom}v7`
  return { pipes, ticks: ticks.join(''), flaskPath, stopcock, c, b }
})

const flaskClip = computed(() => {
  const f = layout.value?.flask
  if (!f) return ''
  // The liquid sits in the conical body: a trapezoid from the shoulder to the base.
  const inset = ((f.w - f.w * 0.32) / 2 / f.w) * 60
  return `polygon(${inset}% 30%, ${100 - inset}% 30%, 100% 100%, 0% 100%)`
})

/** Band height in px before scaling: the bands are drawn soft-edged at this size and scaled to their spread. */
const BAND = 40
const BUBBLES = 22

useMotionScope(
  layer,
  ({ gsap, ScrollTrigger, reduced }, root) => {
    const home = root.parentElement!
    type Point = { el: HTMLElement; x: (v: number) => void; y: (v: number) => void }
    const point = (el: HTMLElement): Point => ({ el, x: gsap.quickSetter(el, 'x', 'px') as (v: number) => void, y: gsap.quickSetter(el, 'y', 'px') as (v: number) => void })
    let setters: { scale: (value: number) => void; pipe: Pipe }[] = []
    let bands: HTMLElement[] = []
    let mixture: HTMLElement | null = null
    let wet: HTMLElement | null = null
    let front: Point | null = null
    let bubbles: Point[] = []
    let charge: HTMLElement | null = null
    let recorder: { frame: (v: number) => void; paper: (v: number) => void; pen: Point } | null = null
    let released = 0
    let scroll = 0

    const bind = () => {
      const l = layout.value
      if (!l) return
      setters = l.pipes.map((pipe) => {
        const el = root.querySelector<HTMLElement>(`[data-pipe="${pipe.id}"]`)!
        return { pipe, scale: gsap.quickSetter(el, vertical(pipe) ? 'scaleY' : 'scaleX') as (v: number) => void }
      })
      bands = [...root.querySelectorAll<HTMLElement>('.column .band')]
      mixture = root.querySelector('.column .mixture')
      wet = root.querySelector('.column .wet')
      charge = root.querySelector('.burette-liquid')
      front = point(root.querySelector<HTMLElement>('.front')!)
      bubbles = [...root.querySelectorAll<HTMLElement>('.bubble')].map(point)
      const frame = root.querySelector<HTMLElement>('.recorder')
      recorder = frame
        ? {
            frame: gsap.quickSetter(frame, 'y', 'px') as (v: number) => void,
            paper: gsap.quickSetter(frame.firstElementChild!, 'y', 'px') as (v: number) => void,
            pen: point(root.querySelector<HTMLElement>('.pen')!),
          }
        : null
    }

    const progress = (s: number, s0: number, s1: number) => gsap.utils.clamp(0, 1, (s - s0) / (s1 - s0))

    // A point a given distance back along the main path from the front.
    const along = (l: Layout, s: number, back: number): [number, number] | null => {
      const path = l.pipes.filter((p) => p.main && s > p.s0)
      for (let i = path.length - 1; i >= 0; i--) {
        const p = path[i]!
        const len = Math.hypot(p.x1 - p.x0, p.y1 - p.y0)
        const reached = len * progress(s, p.s0, p.s1)
        if (back <= reached) {
          const t = (reached - back) / (len || 1)
          return [p.x0 + (p.x1 - p.x0) * t, p.y0 + (p.y1 - p.y0) * t]
        }
        back -= reached
      }
      return null
    }

    const render = (s: number) => {
      const l = layout.value
      if (!l || !front) return
      scroll = s
      setters.forEach(({ pipe, scale }) => scale(progress(s, pipe.s0, pipe.s1)))

      // The column: the dark mixture loads at the top, the solvent wets the packing, and each flame
      // travels down at its own pace, spreading as it goes, until its own fraction leaves the outlet.
      const c = l.column
      const h = c.bottom - c.top - 4
      const p = progress(s, c.s0, c.s1)
      wet && gsap.set(wet, { scaleY: p })
      mixture && gsap.set(mixture, { opacity: s > c.s0 ? Math.max(0, 1 - p * 4) : 0 })
      bands.forEach((band, i) => {
        const q = progress(s, l.bands[i]!.s0, l.bands[i]!.s1)
        const spread = 10 + q * h * 0.12
        gsap.set(band, { y: h * 0.02 + q * h * 0.98, scaleY: spread / BAND, opacity: q >= 1 ? 0 : Math.min(1, p * 6) })
      })

      // The burette charges from the line, then gives one drop per row.
      if (charge) gsap.set(charge, { scaleY: Math.max(0, progress(s, l.burette.s0, l.burette.s1) * 0.94 - released * 0.09) })

      // The recorder: the paper is uncovered down to the front line and the pen rides the signal there.
      const r = l.recorder
      if (r && recorder) {
        const shown = progress(s, r.s0, r.s1) * r.height
        recorder.frame(shown - r.height)
        recorder.paper(r.height - shown)
        const writing = shown > 0 && shown < r.height
        recorder.pen.el.style.opacity = writing ? '1' : '0'
        if (writing) {
          recorder.pen.x(r.left + r.base + r.signal[Math.round(shown)]!)
          recorder.pen.y(r.top + shown)
        }
      }

      // The front: a drop of indicator riding the leading edge, bubbles trailing behind it.
      const lead = along(l, s, 0)
      const moving = lead && s < (l.pipes.filter((pp) => pp.main).at(-1)?.s1 ?? 0)
      front.el.style.opacity = moving ? '1' : '0'
      if (lead) {
        front.x(lead[0])
        front.y(lead[1])
      }
      bubbles.forEach((bubble, i) => {
        const at = moving ? along(l, s, 14 + i * 17) : null
        bubble.el.style.opacity = at ? String(0.85 - i * 0.2) : '0'
        if (at) {
          bubble.x(at[0] + (i % 2 ? 1.5 : -1.5))
          bubble.y(at[1])
        }
      })

      // Drops leave the burette as their rows reach the front line; each is released once.
      while (released < l.drops.length && s >= l.drops[released]!) release(l, released++)
    }

    // The flask and the endpoint are written straight to the DOM: a drop must not re-render the glass,
    // and the endpoint touches the footer alone, not a class on the whole document.
    let level = 0
    let turned = false
    let dripping = false
    const show = () => {
      const flask = root.querySelector<HTMLElement>('.flask-liquid')
      if (flask) flask.style.transform = `scaleY(${level})`
      root.classList.toggle('endpoint', turned)
      root.classList.toggle('dripping', dripping)
      document.querySelector('.site-footer')?.classList.toggle('rx-endpoint', turned)
    }

    const land = (index: number, total: number) => {
      level = Math.min(0.55, (index + 1) * 0.09)
      if (index === total - 1) turned = true
      show()
      document.dispatchEvent(new CustomEvent<DropDetail>('rx:drop', { detail: { index, total } }))
    }

    const release = (l: Layout, index: number) => {
      const b = l.burette
      const drop = document.createElement('i')
      drop.className = 'drop'
      root.append(drop)
      const surface = l.flask.top + l.flask.h * (0.85 - Math.min(0.5, (index + 1) * 0.08))
      gsap.fromTo(
        drop,
        { x: b.x, y: b.bottom + 8, scale: 0.4 },
        {
          y: surface,
          scale: 1,
          duration: DROP_FALL,
          ease: 'power2.in',
          onComplete: () => {
            drop.remove()
            land(index, l.drops.length)
          },
        },
      )
    }

    // The still: bubbles nucleate anywhere down the gutter, grow as they rise and burst. Scrolling
    // turns the heat up; the pot only boils while it is on screen.
    let boiling: gsap.core.Timeline | null = null
    let boilTrigger: ScrollTrigger | null = null
    const boil = () => {
      boiling?.kill()
      boilTrigger?.kill()
      boiling = null
      boilTrigger = null
      const pot = layout.value?.boil
      if (!pot || reduced) return
      const { random } = gsap.utils
      boiling = gsap.timeline({ paused: true })
      root.querySelectorAll<HTMLElement>('.boil i').forEach((bubble, i) => {
        const life = random(3.2, 6.4)
        const rise = gsap
          .timeline({ repeat: -1, repeatRefresh: true })
          .fromTo(
            bubble,
            { x: () => random(4, pot.width - 8), y: () => random(pot.top + 120, pot.bottom), scale: 0.4 },
            { y: `-=${random(140, 320)}`, scale: () => random(0.9, 1.5), duration: life, ease: 'sine.in' },
            0,
          )
          .fromTo(bubble, { opacity: 0 }, { opacity: 0.9, duration: 0.6, ease: 'none' }, 0)
          .to(bubble, { opacity: 0, duration: 0.35, ease: 'power1.in' }, life - 0.35)
        boiling!.add(rise, (i / BUBBLES) * 5)
      })
      boilTrigger = ScrollTrigger.create({
        trigger: home.querySelector('section.az'),
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => (self.isActive ? boiling?.play() : boiling?.pause()),
        onUpdate: (self) => {
          boiling?.timeScale(1 + Math.min(Math.abs(self.getVelocity()) / 900, 3))
          heat.restart(true)
        },
      })
      if (boilTrigger.isActive) boiling.play()
    }
    const heat = gsap.delayedCall(0.3, () => boiling && gsap.to(boiling, { timeScale: 1, duration: 1.2, ease: 'power2.out' })).pause()

    const rebuild = () => {
      const next = measureTrain(home)
      if (!next) return
      layout.value = next
      nextTick(() => {
        bind()
        boil()
        if (reduced) {
          released = next.drops.length
          level = 0.55
          turned = true
          render(Number.MAX_SAFE_INTEGER)
        } else {
          // Tell the ledger its rows are now titrated by drops rather than on sight.
          document.dispatchEvent(new CustomEvent('rx:train', { detail: { total: next.drops.length, released } }))
          released = Math.min(released, next.drops.length)
          render(scroll || scrollY)
        }
        show()
      })
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(rebuild, 120)
    })
    observer.observe(home)
    rebuild()
    document.fonts?.ready.then(rebuild)

    const trigger = reduced ? null : ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => render(self.scroll()) })
    // The condenser's outlet drips only while it is on screen.
    const outlet = reduced
      ? null
      : ScrollTrigger.create({
          trigger: home.querySelector('.marquee'),
          start: 'top bottom',
          end: 'bottom top',
          onToggle: (self) => {
            dripping = self.isActive
            root.classList.toggle('dripping', dripping)
          },
        })

    return () => {
      clearTimeout(timer)
      observer.disconnect()
      trigger?.kill()
      outlet?.kill()
      boiling?.kill()
      boilTrigger?.kill()
      heat.kill()
      document.querySelector('.site-footer')?.classList.remove('rx-endpoint')
    }
  },
  { reduced: true },
)
</script>

<template>
  <div ref="layer" class="train" :class="{ wide: layout?.wide }" aria-hidden="true">
    <template v-if="layout && glass">
      <svg class="glass" :width="layout.W" :height="layout.H" :viewBox="`0 0 ${layout.W} ${layout.H}`">
        <path class="tube" :d="glass.pipes" :stroke-width="layout.tube" />
        <path class="bore" :d="glass.pipes" :stroke-width="layout.tube - 3" />
        <rect class="vessel" :x="glass.c.x - glass.c.w / 2" :y="glass.c.top" :width="glass.c.w" :height="glass.c.bottom - glass.c.top" :rx="glass.c.w / 2" />
        <rect class="vessel" :x="glass.b.x - glass.b.w / 2" :y="glass.b.top" :width="glass.b.w" :height="glass.b.bottom - glass.b.top" :rx="glass.b.w / 2" />
        <path class="ticks" :d="glass.ticks" />
        <path class="ticks" :d="glass.stopcock" />
        <path class="vessel" :d="glass.flaskPath" />
      </svg>

      <i v-for="pipe in layout.pipes" :key="pipe.id" class="liquid" :data-pipe="pipe.id" :style="pipeStyle(pipe, layout.lw)" />

      <div class="column" :style="box(layout.column.x - layout.column.w / 2 + 2, layout.column.top + 2, layout.column.w - 4, layout.column.bottom - layout.column.top - 4)">
        <i class="wet" />
        <i class="mixture" />
        <i v-for="n in LESSONS" :key="n" class="band" :data-lesson="n" />
      </div>

      <div v-if="layout.recorder" class="recorder" :style="box(layout.recorder.left, layout.recorder.top, layout.recorder.width, layout.recorder.height)">
        <svg class="paper" :width="layout.recorder.width" :height="layout.recorder.height">
          <path class="grid" :d="layout.recorder.grid" />
          <path v-for="peak in layout.recorder.peaks" :key="peak.n" class="peak" :data-lesson="peak.n" :d="peak.d" />
          <path class="trace" :d="layout.recorder.trace" />
        </svg>
      </div>
      <i v-if="layout.recorder" class="pen" />

      <i class="burette-liquid" :style="box(layout.burette.x - layout.burette.w / 2 + 2.5, layout.burette.top + 3, layout.burette.w - 5, layout.burette.bottom - layout.burette.top - 5)" />
      <i class="flask-liquid" :style="{ ...box(layout.flask.x - layout.flask.w / 2, layout.flask.top, layout.flask.w, layout.flask.h), clipPath: flaskClip }" />

      <div v-if="layout.boil" class="boil" :style="{ left: `${layout.boil.left}px` }">
        <i v-for="n in BUBBLES" :key="n" :style="{ width: `${4 + (n % 5) * 2}px`, height: `${4 + (n % 5) * 2}px` }" />
      </div>

      <i class="outlet-drop" :style="{ left: `${layout.outlet.x}px`, top: `${layout.outlet.y}px` }" />
      <i class="front" />
      <i v-for="n in 3" :key="n" class="bubble" />
    </template>
  </div>
</template>

<style scoped>
.train {
  position: absolute;
  inset: 0 0 auto;
  z-index: 3;
  pointer-events: none;
}

.glass {
  position: absolute;
  inset: 0;
  overflow: visible;
}

.tube {
  fill: none;
  stroke: color-mix(in oklch, var(--ink) 16%, transparent);
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* The bore: the glass reads as a hollow tube with two walls. */
.bore {
  fill: none;
  stroke: var(--ground);
  stroke-opacity: 0.82;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.vessel {
  fill: color-mix(in oklch, var(--ground) 82%, transparent);
  stroke: color-mix(in oklch, var(--ink) 30%, transparent);
  stroke-width: 1;
}

.ticks {
  fill: none;
  stroke: color-mix(in oklch, var(--ink) 38%, transparent);
  stroke-width: 1;
}

.liquid {
  position: absolute;
  border-radius: 99px;
  will-change: transform;
}

.column {
  position: absolute;
  overflow: hidden;
  border-radius: 99px;
  /* Packing: the stationary phase, a fine silica grain. */
  background-image: radial-gradient(color-mix(in oklch, var(--ink) 22%, transparent) 0.7px, transparent 0.8px);
  background-size: 4px 4px;
}

.wet,
.mixture,
.band {
  position: absolute;
  inset: 0 0 auto;
  transform-origin: 50% 0;
}

.wet {
  height: 100%;
  background: color-mix(in oklch, var(--ink) 10%, transparent);
  transform: scaleY(0);
}

.mixture {
  top: 3%;
  height: 10px;
  background: var(--ink);
  opacity: 0;
}

/* A band is dense in the middle and thins at its edges; script scales it as it spreads. */
.band {
  height: 40px;
  background: linear-gradient(transparent, var(--flame-mark) 38% 62%, transparent);
  opacity: 0;
}

/* The chart recorder: the frame and the paper counter-move, so the paper is uncovered without moving. */
.recorder {
  position: absolute;
  overflow: hidden;
  will-change: transform;
}

.paper {
  display: block;
  overflow: visible;
  will-change: transform;
}

.grid {
  fill: none;
  stroke: color-mix(in oklch, var(--ink) 7%, transparent);
  stroke-width: 1;
}

.peak {
  fill: color-mix(in oklch, var(--flame) 38%, transparent);
}

.trace {
  fill: none;
  stroke: var(--ink-secondary);
  stroke-width: 1.25;
  stroke-linejoin: round;
}

.pen {
  position: absolute;
  top: 0;
  left: 0;
  width: 7px;
  height: 7px;
  margin: -3.5px 0 0 -3.5px;
  border-radius: 50%;
  background: var(--ink);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--ink) 12%, transparent);
  opacity: 0;
}

.burette-liquid {
  position: absolute;
  border-radius: 99px;
  background: var(--ink-secondary);
  opacity: 0.75;
  transform-origin: 50% 100%;
  transform: scaleY(0);
  transition: background-color 0.6s var(--ease-out);
}

.flask-liquid {
  position: absolute;
  background: var(--ink-secondary);
  opacity: 0.55;
  transform-origin: 50% 100%;
  transform: scaleY(0);
  transition:
    transform 0.4s var(--ease-out),
    background-color 0.6s var(--ease-out),
    opacity 0.6s var(--ease-out);
}

/* Endpoint: one drop too many and the indicator turns. */
.endpoint .burette-liquid,
.endpoint .flask-liquid {
  background: var(--accent);
  opacity: 0.9;
}

.front {
  position: absolute;
  top: 0;
  left: 0;
  width: 9px;
  height: 9px;
  margin: -4.5px 0 0 -4.5px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow:
    0 0 0 3px color-mix(in oklch, var(--accent) 22%, transparent),
    0 0 14px 2px color-mix(in oklch, var(--accent) 45%, transparent);
  opacity: 0;
}

.bubble {
  position: absolute;
  top: 0;
  left: 0;
  width: 5px;
  height: 5px;
  margin: -2.5px 0 0 -2.5px;
  border-radius: 50%;
  border: 1px solid var(--ground);
  opacity: 0;
}

:deep(.drop) {
  position: absolute;
  top: 0;
  left: 0;
  width: 6px;
  height: 8px;
  margin: -4px 0 0 -3px;
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  background: var(--ink-secondary);
}

.boil {
  position: absolute;
  top: 0;
}

.boil i {
  position: absolute;
  top: 0;
  left: 0;
  border: 1px solid color-mix(in oklch, var(--ink-secondary) 75%, transparent);
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, var(--highlight) 0 22%, transparent 30%);
  opacity: 0;
}

.outlet-drop {
  position: absolute;
  width: 6px;
  height: 7px;
  margin-left: -3px;
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  background: var(--ink);
  opacity: 0;
}

.dripping .outlet-drop {
  animation: outlet-drip 2.6s cubic-bezier(0.55, 0, 0.75, 0.2) infinite;
}

@keyframes outlet-drip {
  0% {
    opacity: 0;
    transform: translateY(0) scale(0.2);
  }
  55% {
    opacity: 0.9;
    transform: translateY(2px) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(26px) scale(0.8);
  }
}

.train:not(.wide) .front {
  width: 6px;
  height: 6px;
  margin: -3px 0 0 -3px;
}

.train:not(.wide) .bubble {
  display: none;
}
</style>
