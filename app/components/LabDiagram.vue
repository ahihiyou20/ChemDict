<script setup lang="ts">
import type { DiagramName } from '#shared/types/lexicon'
import {
  CHROMATOGRAPHY,
  CRYSTALLIZATION,
  DISTILLATION,
  EVAPORATION,
  EXTRACTION,
  FILTRATION,
  SEPARATION,
  SOLUTION,
  stageOf,
  transformOf,
} from '~/lib/lab-motion'

/**
 * The apparatus behind a separation term, drawn as a plate and left running (COMMIT-SHEET §10). The
 * part a term names is drawn in the indicator's pink and labelled with the term itself. The motion is a
 * function of time (lib/lab-motion), applied by transform and opacity on the page's one ticker, only
 * while the plate is on screen. The resting frame, which reduced motion and readers without script get,
 * is the finished state of the process; with script, the first frame is painted from the server.
 */
const props = defineProps<{ name: DiagramName; en: string; vi: string; pos: string | null }>()

const ALT: Record<DiagramName, string> = {
  separation: 'Sơ đồ tách biệt: hỗn hợp hai loại hạt được tách riêng thành từng loại.',
  distillation: 'Sơ đồ chưng cất: bình cầu được đun nóng, hơi đi qua ống sinh hàn, ngưng tụ và chảy vào bình hứng.',
  evaporation: 'Sơ đồ bay hơi và ngưng tụ: chất lỏng trong bát sứ được đun nóng bay hơi, hơi gặp mặt kính lạnh ngưng tụ thành giọt.',
  extraction: 'Sơ đồ chiết: phễu chiết chứa hai lớp chất lỏng không trộn lẫn, chất tan chuyển từ lớp dưới lên lớp dung môi phía trên.',
  solution: 'Sơ đồ dung dịch: chất tan dạng tinh thể hòa tan dần vào dung môi trong cốc.',
  crystallization: 'Sơ đồ kết tinh: tinh thể lớn dần trong dung dịch bão hòa khi để nguội.',
  filtration: 'Sơ đồ lọc: hỗn hợp đi qua giấy lọc trong phễu, chất rắn giữ lại trên giấy, nước lọc chảy xuống bình.',
  chromatography: 'Sơ đồ sắc kí cột: dung môi (pha động) chảy qua cột nhồi (pha tĩnh), các chất tách thành từng dải và lần lượt chảy ra.',
}

/** The part of the apparatus a term names, where it names one. */
const part = computed(() => {
  const en = props.en.toLowerCase()
  const noun = props.pos?.toLowerCase().startsWith('noun') ?? false
  if (en === 'distillate') return 'receiver'
  if (en === 'evaporation' || en === 'evaporate') return 'vapour'
  if (en === 'condensation' || en === 'condense') return 'cold'
  if (en === 'separatory funnel') return 'funnel'
  if (en === 'extract' && noun) return 'extract'
  if (en === 'solvent') return 'solvent'
  if (en === 'solute') return 'solute'
  if (en === 'stationary phase') return 'stationary'
  if (en === 'mobile phase') return 'mobile'
  return null
})

/** Where the label for each part sits: the point on the part, then the label's foot. */
const LEADERS: Record<string, { x: number; y: number; lx: number; ly: number; end?: boolean }> = {
  receiver: { x: 352, y: 272, lx: 396, ly: 236 },
  vapour: { x: 262, y: 150, lx: 352, ly: 146 },
  cold: { x: 270, y: 118, lx: 352, ly: 84 },
  funnel: { x: 284, y: 112, lx: 340, ly: 76 },
  extract: { x: 270, y: 110, lx: 340, ly: 140 },
  solvent: { x: 288, y: 170, lx: 340, ly: 150 },
  solute: { x: 222, y: 252, lx: 340, ly: 236 },
  stationary: { x: 254, y: 170, lx: 316, ly: 170 },
  mobile: { x: 254, y: 66, lx: 316, ly: 58 },
}
const leader = computed(() => (part.value ? LEADERS[part.value] ?? null : null))
const on = (name: string) => ({ on: part.value === name })

const stage = computed(() => stageOf(props.name))
const anchors = computed(() => new Map(stage.value.parts.map((p) => [p.key, p])))
const first = computed(() => stage.value.frame(0))
/** The first frame, for the server to paint: CSS applies it while motion is allowed and until script takes over. */
const pre = (key: string) => {
  const p = first.value.get(key)
  const a = anchors.value.get(key)
  return p && a ? { '--pre': transformOf(p, a.ax, a.ay), '--pre-o': p.o } : undefined
}

const plate = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined
let stop: (() => void) | undefined
onMounted(async () => {
  const motion = await loadMotion()
  const el = plate.value
  if (!el || motion.reduced) return
  const { gsap } = motion
  const parts = [...el.querySelectorAll<SVGElement>('[data-mv]')].flatMap((node) => {
    const a = anchors.value.get(node.dataset.mv!)
    return a ? [{ node, a }] : []
  })
  const render = (t: number) => {
    const frame = stage.value.frame(t)
    for (const { node, a } of parts) {
      const p = frame.get(a.key)
      if (!p) continue
      node.style.transform = transformOf(p, a.ax, a.ay)
      node.style.opacity = String(Math.round(p.o * 1000) / 1000)
    }
  }
  let start = 0
  const tick = (time: number) => render(time - start)
  // Off screen the clock stops and goes back to the first frame, so the process plays again from its start.
  observer = new IntersectionObserver(([record]) => {
    if (record!.isIntersecting) {
      start = gsap.ticker.time
      gsap.ticker.add(tick)
    } else {
      gsap.ticker.remove(tick)
      render(0)
    }
  })
  observer.observe(el)
  render(0)
  stop = () => gsap.ticker.remove(tick)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  stop?.()
})

const hexagon = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 3) * k + Math.PI / 6
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
</script>

<template>
  <figure ref="plate" class="lab figure" :data-diagram="name">
    <svg viewBox="0 0 480 300" role="img" :aria-label="ALT[name]">
      <defs>
        <pattern :id="`silica-${name}`" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.1" class="grain" />
        </pattern>
      </defs>
      <path class="bench" d="M24 284H456" />

      <!-- Distillation: heat, flask, still head, Liebig condenser, receiver. -->
      <g v-if="name === 'distillation'">
        <path class="flame-fire" data-mv="flame" :style="pre('flame')" d="M110 272c-11-10-10-24 0-36c10 12 11 26 0 36z" />
        <rect class="glass-fill" x="100" y="272" width="20" height="12" rx="2" />
        <clipPath id="dist-flask"><circle cx="110" cy="186" r="43" /></clipPath>
        <g clip-path="url(#dist-flask)">
          <rect class="liquid" x="60" y="198" width="100" height="40" />
          <circle v-for="b in DISTILLATION.bubbles" :key="b.key" class="bubble" :data-mv="b.key" :style="pre(b.key)" :cx="b.x" :cy="b.y" r="2.6" />
        </g>
        <path class="tube" d="M110 143V98M110 108L160 124M320 176L334 198M184 132L180 112M296 168L300 190" />
        <path class="bore" d="M110 143V98M110 108L160 124M320 176L334 198M184 132L180 112M296 168L300 190" />
        <path class="jacket" d="M178 130L302 170" />
        <path class="jacket-bore" d="M178 130L302 170" />
        <path v-for="c in DISTILLATION.streaks" :key="c.key" class="coolant" :data-mv="c.key" :style="pre(c.key)" :d="`M${c.x} ${c.y}l-10 -3.2`" />
        <path class="tube inner" d="M150 121L320 176" />
        <path class="bore inner" d="M150 121L320 176" />
        <path class="glass" d="M104.5 142.4A44 44 0 1 0 115.5 142.4" />
        <rect class="glass-fill" x="100" y="90" width="20" height="8" rx="2" />
        <path class="thermo" d="M110 52V112" />
        <circle class="thermo-bulb" cx="110" cy="114" r="3" />
        <circle v-for="v in DISTILLATION.vapour" :key="v.key" class="vapour" :data-mv="v.key" :style="pre(v.key)" :cx="v.x" :cy="v.y" r="2.2" />
        <circle v-for="d in DISTILLATION.drops" :key="d.key" class="drop" :data-mv="d.key" :style="pre(d.key)" :cx="d.x" :cy="d.y" r="2.6" />
        <g :class="on('receiver')" class="part">
          <clipPath id="dist-receiver"><path d="M326 214L302 282H366L342 214Z" /></clipPath>
          <rect class="liquid part-fill" x="296" y="262" width="80" height="22" clip-path="url(#dist-receiver)" />
          <path class="glass part-line" d="M326 194V214L302 282H366L342 214V194" />
        </g>
        <ellipse v-for="k in 2" :key="k" class="ripple" :data-mv="`r${k - 1}`" :style="pre(`r${k - 1}`)" cx="334" cy="262" rx="5" ry="1.4" />
      </g>

      <!-- Evaporation and condensation: a dish over a flame, a cold watch glass above it. -->
      <g v-else-if="name === 'evaporation'">
        <path class="glass" d="M176 284L184 216M304 284L296 216M172 216H308" />
        <path class="gauze" d="M176 213H304" />
        <path class="flame-fire" data-mv="flame" :style="pre('flame')" d="M240 266c-11-10-10-24 0-36c10 12 11 26 0 36z" />
        <rect class="glass-fill" x="230" y="266" width="20" height="18" rx="2" />
        <g :class="on('cold')" class="part">
          <circle v-for="d in EVAPORATION.drops" :key="d.key" class="drop part-fill" :data-mv="d.key" :style="pre(d.key)" :cx="d.x" :cy="d.y" r="3" />
          <circle class="drop part-fill" data-mv="g-mid" :style="pre('g-mid')" :cx="EVAPORATION.centre.x" :cy="EVAPORATION.centre.y" r="3" />
          <path class="glass part-line" d="M178 100Q240 128 302 100" />
          <rect v-for="(x, i) in [214, 236, 258]" :key="i" class="ice" :x="x" :y="92 - (i % 2) * 4" width="16" height="14" rx="2" />
        </g>
        <clipPath id="evap-dish"><path d="M176 180Q240 244 304 180Z" /></clipPath>
        <rect class="liquid" x="170" y="196" width="140" height="30" clip-path="url(#evap-dish)" />
        <ellipse class="ripple" data-mv="ripple" :style="pre('ripple')" cx="240" cy="196" rx="5" ry="1.4" />
        <path class="glass" d="M172 178Q240 248 308 178" />
        <g :class="on('vapour')" class="part">
          <path v-for="w in EVAPORATION.wisps" :key="w.key" class="wisp part-line" :data-mv="w.key" :style="pre(w.key)" :d="`M${w.x} ${w.y}c-8-10 8-18 0-28s8-18 0-28`" />
        </g>
      </g>

      <!-- Extraction: a separatory funnel on a ring, two layers, the solute crossing into the upper one. -->
      <g v-else-if="name === 'extraction'">
        <path class="glass" d="M120 28V284M92 284H204M120 178H212" />
        <ellipse class="glass" cx="240" cy="178" rx="28" ry="4" />
        <clipPath id="extr-body"><path d="M232 62C180 90 190 170 236 196L244 196C290 170 300 90 248 62Z" /></clipPath>
        <g clip-path="url(#extr-body)">
          <rect class="layer-lower" x="180" y="142" width="120" height="60" />
          <rect class="layer-upper part-fill" :class="on('extract')" x="180" y="80" width="120" height="62" />
          <path class="interface" d="M180 142H300" />
        </g>
        <circle v-for="s in EXTRACTION.solute" :key="s.key" class="particle" :data-mv="s.key" :style="pre(s.key)" :cx="s.x" :cy="s.y" r="3.2" />
        <g :class="on('funnel')" class="part">
          <path class="glass part-line" d="M232 62C180 90 190 170 236 196V244M248 62C300 90 290 170 244 196V244M232 62V44M248 62V44" />
          <rect class="glass-fill part-line" x="229" y="30" width="22" height="14" rx="3" />
          <rect class="glass-fill part-line" x="224" y="207" width="32" height="8" rx="3" />
        </g>
        <circle class="drop" data-mv="drip" :style="pre('drip')" cx="240" cy="246" r="2.4" />
        <rect class="layer-lower" x="216" y="266" width="48" height="16" />
        <ellipse class="ripple" data-mv="ripple" :style="pre('ripple')" cx="240" cy="266" rx="5" ry="1.4" />
        <path class="glass" d="M214 250V280Q214 284 218 284H262Q266 284 266 280V250" />
      </g>

      <!-- A solution: solute crystals dissolving into the solvent. -->
      <g v-else-if="name === 'solution'">
        <clipPath id="sol-beaker"><path d="M182 84V268Q182 276 190 276H290Q298 276 298 268V84Z" /></clipPath>
        <rect class="liquid part-fill" :class="[on('solvent'), 'part']" x="180" y="130" width="120" height="150" clip-path="url(#sol-beaker)" />
        <path class="surface" d="M182 130H298" />
        <g :class="on('solute')" class="part">
          <circle v-for="d in SOLUTION.dissolved" :key="d.key" class="particle part-fill" :data-mv="d.key" :style="pre(d.key)" :cx="d.x" :cy="d.y" r="2.4" />
          <rect v-for="c in SOLUTION.crystals" :key="c.key" class="crystal part-fill" :data-mv="c.key" :style="pre(c.key)" :x="c.x" :y="c.y" width="12" height="12" rx="1.5" />
        </g>
        <path class="rod" d="M264 58L218 250" />
        <path class="glass" d="M176 80L182 84V268Q182 276 190 276H290Q298 276 298 268V84L304 80" />
      </g>

      <!-- Crystallization: crystals growing from a cooling saturated solution and on a seeded thread. -->
      <g v-else-if="name === 'crystallization'">
        <clipPath id="cry-beaker"><path d="M182 84V268Q182 276 190 276H290Q298 276 298 268V84Z" /></clipPath>
        <rect class="liquid" x="180" y="122" width="120" height="160" clip-path="url(#cry-beaker)" />
        <path class="surface" d="M182 122H298" />
        <path class="rod" d="M160 72H320" />
        <path class="thread" d="M240 72V176" />
        <circle v-for="f in CRYSTALLIZATION.feed" :key="f.key" class="particle" data-lesson="12" :data-mv="f.key" :style="pre(f.key)" :cx="f.x" :cy="f.y" r="1.8" />
        <polygon v-for="c in CRYSTALLIZATION.crystals" :key="c.key" class="crystal" :data-mv="c.key" :style="pre(c.key)" :points="hexagon(c.cx, c.cy, c.r)" />
        <path class="glass" d="M176 80L182 84V268Q182 276 190 276H290Q298 276 298 268V84L304 80" />
      </g>

      <!-- Filtration: filter paper in a funnel, the residue held back, the filtrate dripping through. -->
      <g v-else-if="name === 'filtration'">
        <path class="glass" d="M120 28V284M92 284H204M120 98H192" />
        <ellipse class="glass" cx="240" cy="98" rx="48" ry="4" />
        <g :class="on('paper')" class="part">
          <path class="paper part-fill part-line" d="M196 88H284L240 146Z" />
          <path class="fold" d="M240 88V146" />
        </g>
        <clipPath id="filt-paper"><path d="M196 88H284L240 146Z" /></clipPath>
        <g clip-path="url(#filt-paper)">
          <rect class="liquid" data-mv="cake" :style="pre('cake')" x="190" y="104" width="100" height="50" />
        </g>
        <circle v-for="q in FILTRATION.residue" :key="q.key" class="residue" :data-mv="q.key" :style="pre(q.key)" :cx="q.x" :cy="q.y" r="3" />
        <path class="glass" d="M186 84L234 150V210M294 84L246 150V210" />
        <circle v-for="k in 2" :key="k" class="drop" :data-mv="`d${k - 1}`" :style="pre(`d${k - 1}`)" cx="240" cy="214" r="2.4" />
        <clipPath id="filt-flask"><path d="M230 226L198 282H282L250 226Z" /></clipPath>
        <g clip-path="url(#filt-flask)">
          <rect class="liquid" data-mv="filtrate" :style="pre('filtrate')" x="196" y="262" width="90" height="30" />
        </g>
        <ellipse v-for="k in 2" :key="k" class="ripple" :data-mv="`r${k - 1}`" :style="pre(`r${k - 1}`)" cx="240" cy="262" rx="5" ry="1.4" />
        <path class="glass" d="M230 206V226L198 282H282L250 226V206" />
      </g>

      <!-- Column chromatography: the mobile phase runs through the packed stationary phase, bands separate. -->
      <g v-else-if="name === 'chromatography'">
        <path class="glass" d="M150 28V284M122 284H200M150 120H222" />
        <rect class="liquid part-fill" :class="[on('mobile'), 'part']" data-mv="mobile" :style="pre('mobile')" x="228" y="44" width="24" height="42" />
        <g :class="on('stationary')" class="part">
          <rect class="packing part-fill" x="228" y="86" width="24" height="132" :fill="`url(#silica-${name})`" />
        </g>
        <clipPath id="chrom-column"><rect x="228" y="86" width="24" height="132" /></clipPath>
        <g clip-path="url(#chrom-column)">
          <rect v-for="b in CHROMATOGRAPHY.bands" :key="b.key" class="band" :data-lesson="b.n" :data-mv="b.key" :style="pre(b.key)" x="228" :y="b.y" width="24" :height="b.h" />
        </g>
        <path class="glass" d="M226 30V222L238 230V246M254 30V222L242 230V246" />
        <rect class="glass-fill" x="226" y="232" width="28" height="7" rx="3" />
        <circle class="drop" data-mv="drip" :style="pre('drip')" cx="240" cy="250" r="2.4" />
        <clipPath id="chrom-tube"><path d="M232 252V276Q232 284 240 284Q248 284 248 276V252Z" /></clipPath>
        <rect class="liquid" x="230" y="277" width="20" height="8" clip-path="url(#chrom-tube)" />
        <path class="glass" v-for="(x, i) in [212, 240, 268]" :key="i" :d="`M${x - 8} 252V276Q${x - 8} 284 ${x} 284Q${x + 8} 284 ${x + 8} 276V252`" />
        <rect class="band" data-lesson="10" x="205" y="270" width="14" height="10" />
      </g>

      <!-- Separation: a mixture of two kinds of particle sorting itself into two. -->
      <g v-else>
        <clipPath id="sep-trough"><path d="M132 150V262Q132 270 140 270H340Q348 270 348 262V150Z" /></clipPath>
        <rect class="liquid" x="130" y="168" width="220" height="110" clip-path="url(#sep-trough)" />
        <path class="divider" data-mv="divider" :style="pre('divider')" d="M240 176V264" />
        <circle v-for="p in SEPARATION.a" :key="p.key" class="particle" data-lesson="10" :data-mv="p.key" :style="pre(p.key)" :cx="p.x" :cy="p.y" r="6" />
        <rect v-for="p in SEPARATION.b" :key="p.key" class="particle" data-lesson="12" :data-mv="p.key" :style="pre(p.key)" :x="p.x - 5.5" :y="p.y - 5.5" width="11" height="11" rx="1.5" />
        <path class="glass" d="M126 146L132 150V262Q132 270 140 270H340Q348 270 348 262V150L354 146" />
      </g>

      <g v-if="leader" class="leader">
        <path :d="`M${leader.x} ${leader.y}L${leader.lx} ${leader.ly}H${leader.lx + 8}`" />
        <circle :cx="leader.x" :cy="leader.y" r="2.5" />
        <text :x="leader.lx + 12" :y="leader.ly + 4">{{ vi }}</text>
      </g>
    </svg>
  </figure>
</template>

<style scoped>
/* Drawn on the plate, which stays light in both themes: lines use the plate's own ink. Tints are mixed
   in oklab: in oklch the plate's faint blue hue would swing every flame towards blue. */
.lab {
  --glass: var(--plate-caption);
  --wet: color-mix(in oklab, var(--flame) 30%, var(--plate));
  --pink: var(--accent);
}

svg {
  display: block;
  width: 100%;
  height: auto;
}

.bench {
  stroke: color-mix(in oklch, var(--glass) 30%, transparent);
  stroke-width: 1;
}

.glass,
.thermo,
.gauze,
.rod,
.thread,
.fold,
.divider {
  fill: none;
  stroke: var(--glass);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.glass-fill {
  fill: var(--plate);
  stroke: var(--glass);
  stroke-width: 1.4;
}

.tube {
  fill: none;
  stroke: var(--glass);
  stroke-width: 11;
  stroke-linecap: round;
}

.bore {
  fill: none;
  stroke: var(--plate);
  stroke-width: 7.8;
  stroke-linecap: round;
}

.tube.inner {
  stroke-width: 8;
}

.bore.inner {
  stroke-width: 5;
}

/* The condenser's jacket, full of coolant. */
.jacket {
  fill: none;
  stroke: var(--glass);
  stroke-width: 28;
  stroke-linecap: round;
}

.jacket-bore {
  fill: none;
  stroke: color-mix(in oklab, var(--flame-11) 24%, var(--plate));
  stroke-width: 25;
  stroke-linecap: round;
}

.gauze {
  stroke-width: 3;
  stroke-dasharray: 2 2;
}

.rod {
  stroke-width: 4;
  stroke: color-mix(in oklch, var(--glass) 55%, transparent);
}

.thread,
.fold,
.divider {
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.thermo {
  stroke-width: 3;
}

.thermo-bulb {
  fill: var(--flame-13-mark);
}

.liquid {
  fill: var(--wet);
}

.surface,
.interface {
  stroke: var(--flame-mark);
  stroke-width: 1.2;
}

.layer-upper {
  fill: color-mix(in oklab, var(--flame-10) 32%, var(--plate));
}

.layer-lower {
  fill: color-mix(in oklab, var(--flame-11) 30%, var(--plate));
}

.particle {
  fill: var(--flame-10-mark);
}

.particle[data-lesson='12'] {
  fill: var(--flame-12-mark);
}

.crystal {
  fill: color-mix(in oklab, var(--flame-12) 40%, var(--plate));
  stroke: var(--flame-12-mark);
  stroke-width: 1.2;
}

.residue {
  fill: color-mix(in oklch, var(--glass) 70%, transparent);
}

.paper {
  fill: var(--plate);
  stroke: color-mix(in oklch, var(--glass) 60%, transparent);
  stroke-width: 1;
}

.packing {
  stroke: none;
}

.grain {
  fill: color-mix(in oklch, var(--glass) 35%, transparent);
}

.band {
  fill: var(--flame);
  opacity: 0.85;
}

.ice {
  fill: color-mix(in oklab, var(--flame-11) 14%, var(--plate));
  stroke: color-mix(in oklch, var(--flame-11-mark) 70%, transparent);
  stroke-width: 1;
}

.wisp {
  fill: none;
  stroke: color-mix(in oklch, var(--glass) 45%, transparent);
  stroke-width: 1.4;
  stroke-linecap: round;
}

.flame-fire {
  fill: var(--flame-10);
}

.bubble,
.drop {
  fill: var(--wet);
  stroke: var(--flame-mark);
  stroke-width: 0.8;
}

.vapour {
  fill: color-mix(in oklch, var(--glass) 30%, transparent);
}

/* A drop going into liquid leaves a ring on its surface. */
.ripple {
  fill: none;
  stroke: var(--flame-mark);
  stroke-width: 0.8;
  vector-effect: non-scaling-stroke;
  opacity: 0;
}

.coolant {
  stroke: var(--flame-11-mark);
  stroke-width: 1.6;
  stroke-linecap: round;
}

/* The part the term names: drawn in the indicator's pink and labelled. */
.part.on .part-line,
.part-line.on {
  stroke: var(--pink);
}

.part.on .part-fill,
.part-fill.on,
.part.on.part-fill {
  fill: color-mix(in oklab, var(--pink) 30%, var(--plate));
}

.part.on .wisp {
  stroke: var(--pink);
}

.leader path {
  fill: none;
  stroke: var(--pink);
  stroke-width: 1;
}

.leader circle {
  fill: var(--pink);
}

.leader text {
  fill: var(--glass);
  font-family: var(--font-mono);
  font-size: 13px;
}

/* Motion: poses are written as transforms about each part's anchor, in the plate's own units. Until
   script takes over, the server's first frame stands in, so the motion starts from where it is drawn. */
[data-mv] {
  transform-box: view-box;
  transform-origin: 0 0;
}

@media (prefers-reduced-motion: no-preference) {
  :global(html.js) .lab [data-mv] {
    transform: var(--pre, none);
    opacity: var(--pre-o, 1);
  }
}
</style>
