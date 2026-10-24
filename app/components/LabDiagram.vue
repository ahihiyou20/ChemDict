<script setup lang="ts">
import type { DiagramName } from '#shared/types/lexicon'

/**
 * The apparatus behind a separation term, drawn as a plate and left running (COMMIT-SHEET §10). The
 * part a term names is drawn in the indicator's pink and labelled with the term itself. Everything moves
 * by transform and opacity in CSS, only while the plate is on screen; the resting frame, which reduced
 * motion and readers without script get, is the finished state of the process.
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

const plate = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined
onMounted(() => {
  const el = plate.value
  if (!el) return
  observer = new IntersectionObserver(([record]) => el.classList.toggle('playing', record!.isIntersecting))
  observer.observe(el)
})
onBeforeUnmount(() => observer?.disconnect())

// Particle sets, so the template stays readable.
const sortedA = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 150 + (i % 3) * 22, y: 196 + Math.floor(i / 3) * 24, mx: (i * 37) % 90, my: ((i * 23) % 40) - 20 }))
const sortedB = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 270 + (i % 3) * 22, y: 196 + Math.floor(i / 3) * 24, mx: -((i * 41) % 100), my: ((i * 29) % 40) - 20 }))
const dissolved = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ x: 196 + ((i * 37) % 88), y: 150 + ((i * 53) % 100), d: i * 0.45 }))
// Column bands at rest where they have run to, the fastest lowest and widest.
const bands = [10, 11, 12, 13].map((n, i) => {
  const h = 10 * (1.9 - i * 0.25)
  return { n, h, y: 204 - i * 30 - h, travel: 104 - i * 30, tight: (10 / h).toFixed(2) }
})
const solute = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ x: 214 + (i % 4) * 16, y: 108 + Math.floor(i / 4) * 18, rise: 46 + (i % 3) * 8, d: i * 0.35 }))
const residue = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ x: i < 4 ? 231 + i * 6 : 234 + (i - 4) * 6, y: i < 4 ? 135 : 129, d: i * 0.3 }))
const crystals = [
  { x: 206, y: 262, s: 1, d: 0 },
  { x: 232, y: 266, s: 0.7, d: 1.2 },
  { x: 260, y: 261, s: 1.15, d: 0.6 },
  { x: 286, y: 265, s: 0.8, d: 1.8 },
]
/** The underside of the watch glass in the evaporation plate, a quadratic from (178,100) through 114 at its middle. */
const watchY = (x: number) => {
  const t = (x - 178) / 124
  return 100 + 2 * t * (1 - t) * 28
}
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
        <path class="flame-fire" d="M110 272c-11-10-10-24 0-36c10 12 11 26 0 36z" />
        <rect class="glass-fill" x="100" y="272" width="20" height="12" rx="2" />
        <clipPath id="dist-flask"><circle cx="110" cy="186" r="43" /></clipPath>
        <g clip-path="url(#dist-flask)">
          <rect class="liquid" x="60" y="198" width="100" height="40" />
          <circle v-for="(b, i) in [92, 106, 120, 130]" :key="i" class="a-boil" :cx="b" cy="226" r="2.6" :style="{ '--d': `${i * 0.4}s` }" />
        </g>
        <path class="tube" d="M110 143V98M110 108L160 124M320 176L334 198M184 132L180 112M296 168L300 190" />
        <path class="bore" d="M110 143V98M110 108L160 124M320 176L334 198M184 132L180 112M296 168L300 190" />
        <path class="jacket" d="M178 130L302 170" />
        <path class="jacket-bore" d="M178 130L302 170" />
        <path v-for="k in 4" :key="k" class="a-coolant" :d="`M${300 - k * 26} ${169.5 - k * 8.4}l-10 -3.2`" :style="{ '--d': `${k * 0.5}s` }" />
        <path class="tube inner" d="M150 121L320 176" />
        <path class="bore inner" d="M150 121L320 176" />
        <path class="glass" d="M104.5 142.4A44 44 0 1 0 115.5 142.4" />
        <rect class="glass-fill" x="100" y="90" width="20" height="8" rx="2" />
        <path class="thermo" d="M110 52V112" />
        <circle class="thermo-bulb" cx="110" cy="114" r="3" />
        <circle v-for="k in 3" :key="`v${k}`" class="a-vapour" cx="110" cy="176" r="2.2" :style="{ '--d': `${k * 0.8}s` }" />
        <circle v-for="k in 2" :key="`r${k}`" class="a-drip-dist" cx="320" cy="176" r="2.6" :style="{ '--d': `${k * 1.2}s` }" />
        <g :class="on('receiver')" class="part">
          <clipPath id="dist-receiver"><path d="M326 214L302 282H366L342 214Z" /></clipPath>
          <rect class="liquid part-fill" x="296" y="262" width="80" height="22" clip-path="url(#dist-receiver)" />
          <path class="glass part-line" d="M326 194V214L302 282H366L342 214V194" />
        </g>
      </g>

      <!-- Evaporation and condensation: a dish over a flame, a cold watch glass above it. -->
      <g v-else-if="name === 'evaporation'">
        <path class="glass" d="M176 284L184 216M304 284L296 216M172 216H308" />
        <path class="gauze" d="M176 213H304" />
        <path class="flame-fire" d="M240 266c-11-10-10-24 0-36c10 12 11 26 0 36z" />
        <rect class="glass-fill" x="230" y="266" width="20" height="18" rx="2" />
        <clipPath id="evap-dish"><path d="M176 180Q240 244 304 180Z" /></clipPath>
        <rect class="liquid" x="170" y="196" width="140" height="30" clip-path="url(#evap-dish)" />
        <path class="glass" d="M172 178Q240 248 308 178" />
        <g :class="on('vapour')" class="part">
          <path v-for="(x, i) in [212, 240, 268]" :key="i" class="wisp a-wisp part-line" :d="`M${x} 188c-8-10 8-18 0-28s8-18 0-28`" :style="{ '--d': `${i * 0.9}s` }" />
        </g>
        <g :class="on('cold')" class="part">
          <path class="glass part-line" d="M178 100Q240 128 302 100" />
          <rect v-for="(x, i) in [214, 236, 258]" :key="i" class="ice" :x="x" :y="92 - (i % 2) * 4" width="16" height="14" rx="2" />
          <circle v-for="(x, i) in [206, 226, 248, 270]" :key="`d${i}`" class="a-condense part-fill" :cx="x" :cy="watchY(x) + 3.5" r="3" :style="{ '--d': `${i * 0.7}s` }" />
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
        <circle v-for="(p, i) in solute" :key="i" class="particle a-extract" :cx="p.x" :cy="p.y" r="3.2" :style="{ '--rise': `${p.rise}px`, '--d': `${p.d}s` }" />
        <g :class="on('funnel')" class="part">
          <path class="glass part-line" d="M232 62C180 90 190 170 236 196V244M248 62C300 90 290 170 244 196V244M232 62V44M248 62V44" />
          <rect class="glass-fill part-line" x="229" y="30" width="22" height="14" rx="3" />
          <rect class="glass-fill part-line" x="224" y="207" width="32" height="8" rx="3" />
        </g>
        <path class="glass" d="M214 250V280Q214 284 218 284H262Q266 284 266 280V250" />
        <rect class="layer-lower" x="216" y="266" width="48" height="16" />
        <circle class="a-drip" cx="240" cy="246" r="2.4" style="--fall: 22px" />
      </g>

      <!-- A solution: solute crystals dissolving into the solvent. -->
      <g v-else-if="name === 'solution'">
        <clipPath id="sol-beaker"><path d="M182 84V268Q182 276 190 276H290Q298 276 298 268V84Z" /></clipPath>
        <rect class="liquid part-fill" :class="[on('solvent'), 'part']" x="180" y="130" width="120" height="150" clip-path="url(#sol-beaker)" />
        <path class="surface" d="M182 130H298" />
        <g :class="on('solute')" class="part">
          <rect v-for="(x, i) in [204, 222, 244, 262]" :key="i" class="crystal a-dissolve part-fill" :x="x" :y="258 - (i % 2) * 6" width="12" height="12" rx="1.5" :style="{ '--d': `${i * 0.5}s` }" />
          <circle v-for="(p, i) in dissolved" :key="`p${i}`" class="particle a-disperse part-fill" :cx="p.x" :cy="p.y" r="2.4" :style="{ '--d': `${p.d}s`, '--from': `${262 - p.y}px` }" />
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
        <polygon class="crystal a-grow" :points="hexagon(240, 186, 13)" style="--d: 0.3s" />
        <polygon v-for="(c, i) in crystals" :key="i" class="crystal a-grow" :points="hexagon(c.x, c.y, 9 * c.s)" :style="{ '--d': `${c.d}s` }" />
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
        <rect class="liquid a-drain" x="190" y="104" width="100" height="50" clip-path="url(#filt-paper)" />
        <circle v-for="(p, i) in residue" :key="i" class="residue a-settle" :cx="p.x" :cy="p.y" r="3" :style="{ '--d': `${p.d}s` }" />
        <path class="glass" d="M186 84L234 150V210M294 84L246 150V210" />
        <clipPath id="filt-flask"><path d="M230 226L198 282H282L250 226Z" /></clipPath>
        <rect class="liquid" x="196" y="262" width="90" height="22" clip-path="url(#filt-flask)" />
        <path class="glass" d="M230 206V226L198 282H282L250 226V206" />
        <circle v-for="k in 2" :key="k" class="a-drip" cx="240" cy="214" r="2.4" :style="{ '--d': `${k * 0.9}s`, '--fall': '46px' }" />
      </g>

      <!-- Column chromatography: the mobile phase runs through the packed stationary phase, bands separate. -->
      <g v-else-if="name === 'chromatography'">
        <path class="glass" d="M150 28V284M122 284H200M150 120H222" />
        <rect class="liquid part-fill" :class="[on('mobile'), 'part']" x="228" y="44" width="24" height="42" />
        <g :class="on('stationary')" class="part">
          <rect class="packing part-fill" x="228" y="86" width="24" height="132" :fill="`url(#silica-${name})`" />
        </g>
        <clipPath id="chrom-column"><rect x="228" y="86" width="24" height="132" /></clipPath>
        <g clip-path="url(#chrom-column)">
          <rect v-for="(b, i) in bands" :key="b.n" class="band a-elute" :data-lesson="b.n" x="228" :y="b.y" width="24" :height="b.h" :style="{ '--travel': `${b.travel}px`, '--tight': b.tight }" />
        </g>
        <path class="glass" d="M226 30V222L238 230V246M254 30V222L242 230V246" />
        <rect class="glass-fill" x="226" y="232" width="28" height="7" rx="3" />
        <path class="glass" v-for="(x, i) in [212, 240, 268]" :key="i" :d="`M${x - 8} 252V276Q${x - 8} 284 ${x} 284Q${x + 8} 284 ${x + 8} 276V252`" />
        <rect class="band" data-lesson="10" x="205" y="270" width="14" height="10" />
        <circle class="a-drip" cx="240" cy="248" r="2.4" style="--fall: 26px" />
      </g>

      <!-- Separation: a mixture of two kinds of particle sorting itself into two. -->
      <g v-else>
        <clipPath id="sep-trough"><path d="M132 150V262Q132 270 140 270H340Q348 270 348 262V150Z" /></clipPath>
        <rect class="liquid" x="130" y="168" width="220" height="110" clip-path="url(#sep-trough)" />
        <path class="divider a-divide" d="M240 176V264" />
        <circle v-for="(p, i) in sortedA" :key="`a${i}`" class="particle a-sort" data-lesson="10" :cx="p.x" :cy="p.y" r="6" :style="{ '--mx': `${p.mx}px`, '--my': `${p.my}px` }" />
        <rect v-for="(p, i) in sortedB" :key="`b${i}`" class="particle a-sort" data-lesson="12" :x="p.x - 5.5" :y="p.y - 5.5" width="11" height="11" rx="1.5" :style="{ '--mx': `${p.mx}px`, '--my': `${p.my}px` }" />
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
  transform-box: fill-box;
  transform-origin: 50% 100%;
}

.a-boil,
.a-vapour,
.a-drip-dist,
.a-drip,
.a-condense {
  fill: var(--wet);
  stroke: var(--flame-mark);
  stroke-width: 0.8;
}

.a-vapour {
  fill: color-mix(in oklch, var(--glass) 30%, transparent);
  stroke: none;
  opacity: 0;
}

.a-coolant {
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

/* Motion: the processes run while the plate is on screen. The resting frame is the finished one. */
@media (prefers-reduced-motion: no-preference) {
  .lab:not(.playing) * {
    animation-play-state: paused !important;
  }

  .flame-fire {
    animation: flicker 0.9s ease-in-out infinite alternate;
  }

  .a-boil {
    opacity: 0;
    animation: boil 1.6s ease-in var(--d, 0s) infinite;
  }

  .a-vapour {
    animation: vapour 2.4s linear var(--d, 0s) infinite;
  }

  .a-coolant {
    animation: coolant 2s linear var(--d, 0s) infinite;
  }

  .a-drip-dist {
    opacity: 0;
    animation: drip-dist 2.4s ease-in var(--d, 0s) infinite;
  }

  .a-drip {
    opacity: 0;
    animation: drip 1.8s ease-in var(--d, 0s) infinite;
  }

  .a-wisp {
    animation: wisp 2.7s ease-out var(--d, 0s) infinite;
  }

  .a-condense {
    transform-box: fill-box;
    transform-origin: 50% 0;
    animation: condense 2.8s ease-in var(--d, 0s) infinite;
  }

  .a-extract {
    animation: extract 5s cubic-bezier(0.65, 0, 0.35, 1) var(--d, 0s) infinite;
  }

  .a-dissolve {
    transform-box: fill-box;
    transform-origin: 50% 100%;
    animation: dissolve 6s ease-in-out var(--d, 0s) infinite;
  }

  .a-disperse {
    animation: disperse 6s ease-out var(--d, 0s) infinite;
  }

  .a-grow {
    transform-box: fill-box;
    transform-origin: center;
    animation: grow 7s cubic-bezier(0.2, 0.7, 0.3, 1) var(--d, 0s) infinite;
  }

  .a-settle {
    animation: settle 4s ease-in var(--d, 0s) infinite;
  }

  .a-drain {
    animation: drain 4s linear infinite;
  }

  .a-elute {
    transform-box: fill-box;
    transform-origin: 50% 0;
    animation: elute 8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  .a-sort {
    animation: sort 6s cubic-bezier(0.65, 0, 0.35, 1) infinite;
  }

  .a-divide {
    animation: divide 6s ease-out infinite;
  }
}

@keyframes flicker {
  to {
    transform: scale(0.92, 1.12);
  }
}

@keyframes boil {
  0% {
    opacity: 0;
    transform: translateY(0);
  }
  20% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(-28px);
  }
}

@keyframes vapour {
  0% {
    opacity: 0;
    transform: translate(0, 0);
  }
  10% {
    opacity: 1;
  }
  55% {
    transform: translate(0, -68px);
  }
  90% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(46px, -54px);
  }
}

@keyframes coolant {
  from {
    transform: translate(0, 0);
    opacity: 0;
  }
  20%,
  80% {
    opacity: 1;
  }
  to {
    transform: translate(-26px, -8.4px);
    opacity: 0;
  }
}

@keyframes drip-dist {
  0% {
    opacity: 0;
    transform: translate(0, 0);
  }
  15% {
    opacity: 1;
  }
  55% {
    transform: translate(14px, 22px);
  }
  100% {
    opacity: 1;
    transform: translate(14px, 86px);
  }
}

@keyframes drip {
  0% {
    opacity: 0;
    transform: translateY(0) scale(0.4);
  }
  30% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 1;
    transform: translateY(var(--fall, 30px));
  }
}

@keyframes wisp {
  0% {
    opacity: 0;
    transform: translateY(8px);
  }
  30% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(-34px);
  }
}

@keyframes condense {
  0% {
    transform: scale(0.2);
  }
  60% {
    transform: scale(1);
  }
  75% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(60px) scale(0.8);
    opacity: 0;
  }
}

@keyframes extract {
  0%,
  10% {
    transform: translateY(var(--rise));
  }
  55%,
  100% {
    transform: none;
  }
}

@keyframes dissolve {
  0%,
  8% {
    transform: none;
    opacity: 1;
  }
  70%,
  100% {
    transform: scale(0.35);
    opacity: 0.5;
  }
}

@keyframes disperse {
  0% {
    opacity: 0;
    transform: translateY(var(--from));
  }
  60%,
  100% {
    opacity: 1;
    transform: none;
  }
}

@keyframes grow {
  0% {
    transform: scale(0.15);
  }
  75%,
  100% {
    transform: none;
  }
}

@keyframes settle {
  0% {
    opacity: 0;
    transform: translateY(-34px);
  }
  20% {
    opacity: 1;
  }
  60%,
  100% {
    transform: none;
  }
}

@keyframes drain {
  0% {
    transform: none;
  }
  100% {
    transform: translateY(18px);
  }
}

@keyframes elute {
  0% {
    transform: translateY(calc(var(--travel) * -1)) scaleY(var(--tight));
  }
  85%,
  100% {
    transform: none;
  }
}

@keyframes sort {
  0%,
  12% {
    transform: translate(var(--mx), var(--my));
  }
  55%,
  92% {
    transform: none;
  }
  100% {
    transform: translate(var(--mx), var(--my));
  }
}

@keyframes divide {
  0%,
  40% {
    opacity: 0;
  }
  60%,
  90% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
</style>
