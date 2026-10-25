import type { DiagramName } from '#shared/types/lexicon'

/**
 * The motion of the separation plates (LabDiagram), written as a function of time: `frame(t)` returns
 * the pose of every moving part at second `t`, with no state carried between frames. The plate's
 * script applies it on the page's one ticker; the server applies `frame(0)` as a CSS variable so the
 * first painted frame is already the first frame of the motion.
 *
 * Two rules keep it physical. Nothing appears from nowhere: a bubble nucleates on the hot glass, a
 * drop gathers at a tip or on a cold surface, a dissolved particle leaves a crystal face, and anything
 * that leaves goes into liquid, through its surface, or into a crystal. Nothing passes through glass:
 * a particle is held inside the vessel's walls at its height, and a falling drop is cut off by the
 * surface it falls into. A process with an end (dissolving, extracting, eluting) plays once, then the
 * plate keeps only what keeps running: boiling, dripping, the jiggle of particles in liquid.
 */

/** A moving part's pose: where its anchor sits, its scale about the anchor, its opacity. */
export interface Pose {
  x: number
  y: number
  sx: number
  sy: number
  o: number
}

/** A moving part as drawn at rest: its key and the point its pose moves and scales it about. */
export interface Part {
  key: string
  ax: number
  ay: number
}

export interface Stage {
  /** Seconds the one-off process takes; 0 when the plate only runs steady cycles. */
  intro: number
  parts: Part[]
  frame: (t: number) => Map<string, Pose>
}

// Small helpers after Lemo-Opuscar's core/lib.js: clamped ranges and easing on 0–1.
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a))
const ss = (t: number) => {
  t = clamp(t)
  return t * t * (3 - 2 * t)
}
const eio = (t: number) => {
  t = clamp(t)
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
const eo = (t: number) => 1 - Math.pow(1 - clamp(t), 3)
const ei = (t: number) => Math.pow(clamp(t), 3)
const hash = (n: number) => {
  n = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return n - Math.floor(n)
}
const frac = (x: number) => x - Math.floor(x)
const TAU = Math.PI * 2

const pose = (x: number, y: number, s = 1, o = 1, sy = s): Pose => ({ x, y, sx: s, sy, o })

/** The CSS transform that moves a part drawn about (ax, ay) to its pose. */
export function transformOf(p: Pose, ax: number, ay: number) {
  const f = (v: number) => Math.round(v * 100) / 100
  return `translate(${f(p.x - p.sx * ax)}px, ${f(p.y - p.sy * ay)}px) scale(${f(p.sx)}, ${f(p.sy)})`
}

/** Brownian-looking wander: incommensurate sines per axis, so it never visibly repeats. */
function wander(t: number, seed: number, amp: number): [number, number] {
  const a = 0.17 + 0.2 * hash(seed)
  const b = 0.41 + 0.3 * hash(seed + 7)
  const p = TAU * hash(seed + 13)
  const q = TAU * hash(seed + 29)
  return [
    amp * (0.65 * Math.sin(TAU * a * t + p) + 0.35 * Math.sin(TAU * b * t + q)),
    amp * (0.65 * Math.sin(TAU * a * 1.13 * t + q) + 0.35 * Math.sin(TAU * b * 0.87 * t + p)),
  ]
}

/** A point at fraction `u` of the way along a polyline, by length. */
function along(pts: [number, number][]) {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]))
  const total = lens.reduce((a, b) => a + b, 0)
  return (u: number): [number, number] => {
    let d = clamp(u) * total
    for (let i = 0; i < lens.length; i++) {
      if (d <= lens[i]! || i === lens.length - 1) {
        const k = lens[i]! ? clamp(d / lens[i]!) : 0
        return [lerp(pts[i]![0], pts[i + 1]![0], k), lerp(pts[i]![1], pts[i + 1]![1], k)]
      }
      d -= lens[i]!
    }
    return pts[pts.length - 1]!
  }
}

const quad = (a: [number, number], c: [number, number], b: [number, number], u: number): [number, number] => [
  (1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * c[0] + u * u * b[0],
  (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * c[1] + u * u * b[1],
]

/** A flame's flicker about the foot of its cone. */
function flicker(t: number, x: number, y: number, seed: number): Pose {
  const sy = 1 + 0.07 * Math.sin(TAU * 1.3 * t + seed) + 0.04 * Math.sin(TAU * 3.1 * t + seed * 2)
  return pose(x, y, 1 - 0.6 * (sy - 1), 1, sy)
}

/**
 * One drop's cycle at a tip: it gathers there from nothing (scale 0), hangs, swells, lets go and falls
 * into the liquid below, which is drawn over it and so swallows it at the surface. Returns the drop's
 * pose and how long ago, in cycles, it hit the surface (for the ripple).
 */
function drip(u: number, tipX: number, tipY: number, surface: number, r: number) {
  const hangY = (s: number) => tipY + r * s
  let p: Pose
  if (u < 0.5) {
    const s = 0.95 * eo(seg(u, 0, 0.5))
    p = pose(tipX, hangY(s), s)
  } else if (u < 0.62) {
    const k = seg(u, 0.5, 0.62)
    p = pose(tipX, hangY(0.95 + 0.1 * k) + 1.5 * k, 0.95 + 0.1 * k, 1, 0.95 + 0.25 * k)
  } else {
    const k = seg(u, 0.62, 0.86)
    const y0 = hangY(1.05) + 1.5
    p = pose(tipX, lerp(y0, surface + 2 * r, ei(k)), 1, 1, lerp(1.2, 1.1, k))
  }
  return { drop: p, since: frac(u - dripHit(tipY, surface, r)) }
}

/** The point in a drip's cycle at which the drop's centre reaches the surface. */
function dripHit(tipY: number, surface: number, r: number) {
  const y0 = tipY + r * 1.05 + 1.5
  return 0.62 + 0.24 * Math.cbrt(clamp((surface - y0) / (surface + 2 * r - y0)))
}

/** A ring spreading on a surface `sec` seconds after a drop went in. */
function ripple(sec: number, x: number, y: number, span = 0.6): Pose {
  const k = seg(sec, 0, span)
  return pose(x, y, lerp(0.3, 1.6, eo(k)), sec < span ? 0.75 * (1 - k) : 0, lerp(0.3, 1.2, eo(k)))
}

/** The underside of the watch glass in the evaporation plate, a quadratic from (178,100) through 114 at its middle. */
export const watchY = (x: number) => {
  const t = (x - 178) / 124
  return 100 + 2 * t * (1 - t) * 28
}

/** The separatory funnel's walls: for a height, the inner x of the left wall (the right mirrors it about 240). */
const funnelLeft = (() => {
  const [p0, c1, c2, p3] = [
    [232, 62],
    [180, 90],
    [190, 170],
    [236, 196],
  ] as const
  const pts: [number, number][] = []
  for (let i = 0; i <= 64; i++) {
    const u = i / 64
    const v = 1 - u
    pts.push([
      v * v * v * p0[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * p3[0],
      v * v * v * p0[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * p3[1],
    ])
  }
  return (y: number) => {
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1]!
      const [x1, y1] = pts[i]!
      if (y <= y1) return lerp(x0, x1, seg(y, y0, y1))
    }
    return pts[pts.length - 1]![0]
  }
})()

/** Hold a particle of radius r inside the funnel at its height, clear of the glass. */
function inFunnel(x: number, y: number, r: number): [number, number] {
  const yy = clamp(y, 80 + r + 1, 190 - r)
  // The wall leans: test the height of the particle's widest reach towards it as well as its centre.
  const left = Math.max(funnelLeft(yy), funnelLeft(yy - r * 0.7), funnelLeft(yy + r * 0.7)) + r + 1.8
  return [clamp(x, left, 480 - left), yy]
}

// —— Distillation ————————————————————————————————————————————————————————————

const DIST_FLASK = { x: 110, y: 186, r: 43, surface: 198 }
const distFloor = (x: number) => DIST_FLASK.y + Math.sqrt(DIST_FLASK.r ** 2 - (x - DIST_FLASK.x) ** 2) - 2
const VAPOUR_PATH = along([
  [110, 197],
  [110, 116],
  [113, 110],
  [158, 124],
  [236, 149],
])
const DISTILLATE_PATH = along([
  [236, 149],
  [320, 176],
  [334, 198],
])

/** Where in its cycle a distillate drop meets the receiver's surface: its drip runs over the cycle's second half. */
const DIST_HIT = 0.5 + ((dripHit(198, 262, 2.6) - 0.35) / 0.65) * 0.5

export const DISTILLATION = {
  bubbles: [94, 104, 116, 126].map((x, i) => ({ key: `b${i}`, x, y: 210 + (i % 2) * 8 })),
  vapour: [0.2, 0.45, 0.7].map((u, i) => {
    const [x, y] = VAPOUR_PATH(u)
    return { key: `v${i}`, x, y }
  }),
  drops: [0, 1].map((i) => ({ key: `d${i}`, x: 334, y: 201 + i * 30 })),
  streaks: [1, 2, 3, 4].map((k) => ({ key: `c${k}`, x: 300 - k * 26, y: 169.5 - k * 8.4 })),
}

function distillation(t: number) {
  const out = new Map<string, Pose>()
  out.set('flame', flicker(t, 110, 272, 1))
  DISTILLATION.bubbles.forEach((b, i) => {
    const u = frac(t / 1.5 + hash(i + 3))
    const floor = distFloor(b.x)
    let p: Pose
    if (u < 0.2) {
      const s = lerp(0.25, 0.55, ss(seg(u, 0, 0.2)))
      p = pose(b.x, floor - 2.6 * s, s)
    } else if (u < 0.92) {
      const k = seg(u, 0.2, 0.92)
      const s = lerp(0.55, 1, k)
      const y = lerp(floor - 2.6 * 0.55, DIST_FLASK.surface + 1, k * k)
      p = pose(b.x + 1.6 * Math.sin(TAU * 1.5 * k + i), y, s)
    } else {
      const k = seg(u, 0.92, 1)
      p = pose(b.x + 1.6 * Math.sin(TAU * 1.5 + i), DIST_FLASK.surface + 1, 1 + 0.3 * k, 1 - k)
    }
    out.set(b.key, p)
  })
  DISTILLATION.vapour.forEach((v, i) => {
    const u = frac(t / 2.4 + i / 3)
    const [x, y] = VAPOUR_PATH(u)
    out.set(v.key, pose(x, y, 0.8 + 0.4 * u, ss(seg(u, 0, 0.1)) * (1 - ss(seg(u, 0.68, 1)))))
  })
  DISTILLATION.drops.forEach((d, i) => {
    const u = frac(t / 2.4 + i / 2)
    let p: Pose
    if (u < 0.12) {
      const [x, y] = DISTILLATE_PATH(0)
      p = pose(x, y, 0.75 * eo(seg(u, 0, 0.12)))
    } else if (u < 0.5) {
      const k = seg(u, 0.12, 0.5)
      const [x, y] = DISTILLATE_PATH(Math.pow(k, 1.6))
      p = pose(x, y, 0.75)
    } else {
      // From the adapter's tip it is an ordinary drip into the receiver.
      const { drop } = drip(lerp(0.35, 1, seg(u, 0.5, 1)), 334, 198, 262, 2.6)
      const grow = lerp(0.75, 1, seg(u, 0.5, 0.6))
      p = { ...drop, sx: Math.max(drop.sx, grow), sy: Math.max(drop.sy, grow) }
    }
    out.set(`r${i}`, ripple(frac(u - DIST_HIT) * 2.4, 334, 262))
    out.set(d.key, p)
  })
  // Coolant runs up the jacket, against the vapour, from the lower inlet to the upper outlet.
  DISTILLATION.streaks.forEach((c, i) => {
    const u = frac(t / 2.6 + i / 4)
    out.set(c.key, pose(lerp(300, 196, u), lerp(169.5, 136, u), 1, ss(seg(u, 0, 0.12)) * (1 - ss(seg(u, 0.86, 1)))))
  })
  return out
}

// —— Evaporation and condensation ———————————————————————————————————————————————

/** Drops on the cold glass, in pairs that meet at its lowest point and fall as one. */
const SIDE_DROPS = [206, 274, 222, 258]
export const EVAPORATION = {
  wisps: [212, 240, 268].map((x, i) => ({ key: `w${i}`, x, y: 188 })),
  drops: SIDE_DROPS.map((x, i) => ({ key: `g${i}`, x, y: watchY(x) + 3 })),
  centre: { key: 'g-mid', x: 240, y: watchY(240) + 3 },
}
const SURFACE_EVAP = 196

function evaporation(t: number) {
  const out = new Map<string, Pose>()
  out.set('flame', flicker(t, 240, 266, 2))
  EVAPORATION.wisps.forEach((w, i) => {
    const u = frac(t / 3 + i / 3)
    const rise = 1 - Math.pow(1 - u, 1.5)
    out.set(
      w.key,
      // It thins out as it nears the cold glass, where it condenses.
      pose(w.x + 2 * Math.sin(TAU * 0.8 * u + i), 188 + lerp(8, -12, rise), 1, ss(seg(u, 0, 0.25)) * (1 - ss(seg(u, 0.35, 0.8))), 0.85 + 0.2 * u),
    )
  })
  EVAPORATION.drops.forEach((d, i) => {
    const u = frac(t / 6 + (i < 2 ? 0 : 0.5))
    let x = d.x
    let s: number
    if (u < 0.55) s = 0.15 + 0.85 * eo(seg(u, 0, 0.55))
    else if (u < 0.8) {
      s = 1
      x = lerp(d.x, 240, eio(seg(u, 0.55, 0.8)))
    } else {
      s = 1 - ss(seg(u, 0.8, 0.86))
      x = 240
    }
    out.set(d.key, pose(x, watchY(x) + 3 * s, s))
  })
  // The gathered drop at the bottom of the glass: a pair runs into it, it swells, lets go, falls into the dish.
  const c = frac((t - 4.8) / 3 + 0.6)
  const s = 0.2 + 0.45 * ss(seg(c, 0, 0.6)) + 0.45 * ss(seg(c, 0.6, 0.72))
  const hang = watchY(240) + 3 * s
  let mid: Pose
  if (c < 0.8) mid = pose(240, hang, s)
  else {
    const k = seg(c, 0.8, 0.95)
    mid = pose(240, lerp(hang, SURFACE_EVAP + 7, ei(k)), s, 1, s * 1.12)
  }
  out.set('g-mid', mid)
  const top0 = watchY(240) + 3 * 1.1
  const hit = 0.8 + 0.15 * Math.cbrt((SURFACE_EVAP - 3.3 - top0) / (SURFACE_EVAP + 7 - top0))
  out.set('ripple', ripple(frac(c - hit) * 3, 240, SURFACE_EVAP))
  return out
}

// —— Extraction ———————————————————————————————————————————————————————————————

/** Solute particles: they start in the lower layer and most cross into the upper solvent; two stay behind. */
const SOLUTE: { from: [number, number]; to: [number, number] }[] = [
  { from: [214, 152], to: [218, 98] },
  { from: [236, 150], to: [242, 92] },
  { from: [258, 154], to: [262, 102] },
  { from: [224, 168], to: [226, 122] },
  { from: [246, 166], to: [252, 118] },
  { from: [262, 170], to: [238, 134] },
  { from: [232, 182], to: [230, 160] },
  { from: [250, 180], to: [252, 172] },
]

export const EXTRACTION = {
  solute: SOLUTE.map((p, i) => ({ key: `s${i}`, x: p.to[0], y: p.to[1] })),
}

function extraction(t: number) {
  const out = new Map<string, Pose>()
  const r = 3.2
  SOLUTE.forEach((p, i) => {
    const crosses = p.to[1] < 142
    const start = crosses ? 0.8 + 0.55 * i : 0.6
    const k = eio(seg(t, start, start + (crosses ? 1.6 : 4)))
    // Each takes its own curve across the interface, never a straight lift.
    const bend: [number, number] = [lerp(p.from[0], p.to[0], 0.5) + (i % 2 ? 9 : -9), lerp(p.from[1], p.to[1], 0.5)]
    const [bx, by] = quad(p.from, bend, p.to, k)
    const [wx, wy] = wander(t, i + 1, 2.2)
    const [x, y] = inFunnel(bx + wx, by + wy, r)
    out.set(`s${i}`, pose(x, y))
  })
  const { drop, since } = drip(frac(t / 1.9), 240, 244, 266, 2.4)
  out.set('drip', drop)
  out.set('ripple', ripple(since * 1.9, 240, 266, 0.5))
  return out
}

// —— A solution ———————————————————————————————————————————————————————————————

const SOL_CRYSTALS = [204, 222, 244, 262].map((x, i) => ({ key: `x${i}`, x, y: 258 - (i % 2) * 6 }))
const DISSOLVED: [number, number][] = [
  [200, 152],
  [226, 140],
  [276, 150],
  [212, 184],
  [258, 178],
  [288, 200],
  [198, 218],
  [248, 212],
  [276, 236],
]

export const SOLUTION = {
  crystals: SOL_CRYSTALS.map((c) => ({ ...c, ax: c.x + 6, ay: c.y + 12 })),
  dissolved: DISSOLVED.map(([x, y], i) => ({ key: `p${i}`, x, y })),
}

function solution(t: number) {
  const out = new Map<string, Pose>()
  SOL_CRYSTALS.forEach((c, k) => {
    out.set(c.key, pose(c.x + 6, c.y + 12, 1 - 0.42 * ss(seg(t, 0.3 + k * 0.3, 5.6 + k * 0.3))))
  })
  DISSOLVED.forEach(([x, y], i) => {
    const c = SOL_CRYSTALS[i % 4]!
    const from: [number, number] = [c.x + 6, c.y + 9]
    const leave = 0.4 + i * 0.45
    const k = seg(t, leave, leave + 2.8)
    // Out of the crystal's top face first, then spreading as it slows: diffusion.
    const bend: [number, number] = [from[0], lerp(from[1], y, 0.7)]
    const [bx, by] = quad(from, bend, [x, y], eo(k))
    const [wx, wy] = wander(t, i + 40, 3 * ss(k))
    out.set(`p${i}`, pose(clamp(bx + wx, 187, 293), clamp(by + wy, 135, 272), lerp(0.6, 1, ss(seg(k, 0, 0.25)))))
  })
  return out
}

// —— Crystallization ———————————————————————————————————————————————————————————

const CRYSTALS = [
  { x: 206, y: 262, s: 1, d: 0 },
  { x: 232, y: 266, s: 0.7, d: 1.2 },
  { x: 260, y: 261, s: 1.15, d: 0.6 },
  { x: 286, y: 265, s: 0.8, d: 1.8 },
]
/** Solute still in the saturated solution: most of it drifts onto a crystal and is taken up, some stays. */
const FEED: { at: [number, number]; into: number | null }[] = [
  { at: [198, 214], into: 0 },
  { at: [226, 150], into: 4 },
  { at: [262, 158], into: 4 },
  { at: [246, 226], into: 2 },
  { at: [284, 214], into: 3 },
  { at: [222, 236], into: 1 },
  { at: [204, 156], into: null },
  { at: [276, 136], into: null },
  { at: [262, 196], into: null },
  { at: [212, 196], into: null },
]

export const CRYSTALLIZATION = {
  crystals: [
    ...CRYSTALS.map((c, i) => ({ key: `h${i}`, cx: c.x, cy: c.y, r: 9 * c.s, ax: c.x, ay: c.y + 9 * c.s })),
    { key: 'h4', cx: 240, cy: 186, r: 13, ax: 240, ay: 186 },
  ],
  feed: FEED.map((f, i) => ({ key: `f${i}`, x: f.at[0], y: f.at[1] })),
}
const growth = (t: number, i: number) => {
  const d = i === 4 ? 0.3 : CRYSTALS[i]!.d * 0.5
  return 0.12 + 0.88 * eo(seg(t, d, d + 5))
}

function crystallization(t: number) {
  const out = new Map<string, Pose>()
  CRYSTALLIZATION.crystals.forEach((c, i) => out.set(c.key, pose(c.ax, c.ay, growth(t, i))))
  FEED.forEach((f, i) => {
    const [wx, wy] = wander(t, i + 60, 2.5)
    if (f.into === null) {
      out.set(`f${i}`, pose(clamp(f.at[0] + wx, 188, 292), clamp(f.at[1] + wy, 128, 268)))
      return
    }
    const c = CRYSTALLIZATION.crystals[f.into]!
    const taken = 1.6 + i * 0.8
    const k = eio(seg(t, taken - 2.4, taken))
    // It ends on the crystal's face, wherever that face has grown to by then: a crystal on the floor
    // grows about its foot, so its centre rises as it grows.
    const g = growth(taken, f.into)
    const cy = c.ay - (c.ay - c.cy) * g
    const dx = f.at[0] - c.cx
    const dy = f.at[1] - cy
    const len = Math.hypot(dx, dy) || 1
    const end: [number, number] = [c.cx + (dx / len) * c.r * g, cy + (dy / len) * c.r * g]
    const x = lerp(f.at[0], end[0], k) + wx * (1 - k)
    const y = lerp(f.at[1], end[1], k) + wy * (1 - k)
    out.set(`f${i}`, pose(x, y, 1 - ss(seg(t, taken - 0.1, taken + 0.35))))
  })
  return out
}

// —— Filtration ————————————————————————————————————————————————————————————————

/** Half the paper cone's width at a height: it runs from 88 on (196..284) to its apex at 146. */
const coneHalf = (y: number) => ((146 - y) / 58) * 44
/** Keep a particle of radius r clear of the paper: the cone's walls lean at atan(44/58). */
const inCone = (x: number, y: number, r: number): [number, number] => {
  const yy = clamp(y, 92, 146 - (r + 0.8) / 0.6)
  const room = Math.max(0, coneHalf(yy) - (r + 0.8) / 0.797)
  return [clamp(x, 240 - room, 240 + room), yy]
}
/** Residue suspended in the poured mixture, each below the falling level when it starts to sink. */
const RESIDUE: { from: [number, number]; to: [number, number] }[] = [
  { from: [238, 112], to: [240, 138] },
  { from: [226, 114], to: [237, 133] },
  { from: [254, 115], to: [243, 133] },
  { from: [222, 120], to: [234, 128] },
  { from: [242, 118], to: [240, 128] },
  { from: [258, 121], to: [246, 128] },
  { from: [230, 120], to: [237, 123] },
]

export const FILTRATION = {
  residue: RESIDUE.map((p, i) => ({ key: `q${i}`, x: p.to[0], y: p.to[1] })),
}

function filtration(t: number) {
  const out = new Map<string, Pose>()
  const level = eo(seg(t, 0, 6.5))
  out.set('cake', pose(190, 104 + 18 * level))
  out.set('filtrate', pose(196, 262 - 4 * level))
  RESIDUE.forEach((p, i) => {
    // Sinking at its settling speed, slowing only as it comes to rest on the paper or the pile.
    const k = 1 - Math.pow(1 - seg(t, 0.2 + i * 0.25, 2.8 + i * 0.3), 2)
    const [wx, wy] = wander(t, i + 80, 1.6 * (1 - k))
    const [x, y] = inCone(lerp(p.from[0], p.to[0], k) + wx, lerp(p.from[1], p.to[1], k) + wy, 3)
    out.set(`q${i}`, pose(x, y))
  })
  ;[0, 1].forEach((i) => {
    const { drop, since } = drip(frac(t / 1.8 + i / 2), 240, 210, 262 - 4 * level, 2.4)
    out.set(`d${i}`, drop)
    out.set(`r${i}`, ripple(since * 1.8, 240, 262 - 4 * level, 0.5))
  })
  return out
}

// —— Column chromatography ——————————————————————————————————————————————————————

/** Column bands at rest where they have run to, the fastest lowest and widest. */
export const CHROMATOGRAPHY = {
  bands: [10, 11, 12, 13].map((n, i) => {
    const h = 10 * (1.9 - i * 0.25)
    return { key: `band${n}`, n, h, y: 204 - i * 30 - h }
  }),
}

function chromatography(t: number) {
  const out = new Map<string, Pose>()
  // Every band runs for the same time at its own speed: one sample at the top, four bands by the end.
  const k = eio(seg(t, 0.6, 7.5))
  CHROMATOGRAPHY.bands.forEach((b) => {
    out.set(b.key, pose(228, lerp(88, b.y, k), 1, 1, lerp(10 / b.h, 1, k)))
  })
  out.set('mobile', pose(240, 86, 1, 1, lerp(1, 0.72, k)))
  const { drop } = drip(frac(t / 1.6), 240, 247, 277, 2.4)
  out.set('drip', drop)
  return out
}

// —— Separation —————————————————————————————————————————————————————————————————

const SEP_A: { from: [number, number]; to: [number, number] }[] = [
  { from: [176, 190], to: [150, 196] },
  { from: [244, 196], to: [172, 196] },
  { from: [300, 186], to: [194, 196] },
  { from: [158, 232], to: [150, 220] },
  { from: [214, 240], to: [172, 220] },
  { from: [268, 214], to: [194, 220] },
]
const SEP_B: { from: [number, number]; to: [number, number] }[] = [
  { from: [150, 198], to: [270, 196] },
  { from: [196, 212], to: [292, 196] },
  { from: [262, 182], to: [314, 196] },
  { from: [228, 218], to: [270, 220] },
  { from: [286, 240], to: [292, 220] },
  { from: [318, 214], to: [314, 220] },
]

export const SEPARATION = {
  a: SEP_A.map((p, i) => ({ key: `a${i}`, x: p.to[0], y: p.to[1] })),
  b: SEP_B.map((p, i) => ({ key: `b${i}`, x: p.to[0], y: p.to[1] })),
}

function separation(t: number) {
  const out = new Map<string, Pose>()
  const move = (list: typeof SEP_A, prefix: string, lane: number, delay: number, lo: number, hi: number) =>
    list.forEach((p, i) => {
      const k = eio(seg(t, delay + i * 0.22, delay + i * 0.22 + 2.4))
      // The two kinds pass each other in separate lanes, one high, one low.
      const bend: [number, number] = [lerp(p.from[0], p.to[0], 0.5), lerp(p.from[1], p.to[1], 0.5) + lane]
      const [bx, by] = quad(p.from, bend, p.to, k)
      const [wx, wy] = wander(t, i + (prefix === 'a' ? 100 : 120), 2.4)
      const left = lerp(146, lo, k)
      const right = lerp(334, hi, k)
      out.set(`${prefix}${i}`, pose(clamp(bx + wx, left, right), clamp(by + wy, 180, 256)))
    })
  move(SEP_A, 'a', 12, 0.5, 146, 228)
  move(SEP_B, 'b', -12, 0.7, 252, 334)
  out.set('divider', pose(240, 176, 1, 1, ss(seg(t, 3.6, 4.8))))
  return out
}

// —— The plates ———————————————————————————————————————————————————————————————

const p = (key: string, ax: number, ay: number): Part => ({ key, ax, ay })

export function stageOf(name: DiagramName): Stage {
  switch (name) {
    case 'distillation':
      return {
        intro: 0,
        parts: [
          p('flame', 110, 272),
          ...DISTILLATION.bubbles.map((b) => p(b.key, b.x, b.y)),
          ...DISTILLATION.vapour.map((v) => p(v.key, v.x, v.y)),
          ...DISTILLATION.drops.map((d, i) => [p(d.key, d.x, d.y), p(`r${i}`, 334, 262)]).flat(),
          ...DISTILLATION.streaks.map((c) => p(c.key, c.x, c.y)),
        ],
        frame: distillation,
      }
    case 'evaporation':
      return {
        intro: 0,
        parts: [
          p('flame', 240, 266),
          ...EVAPORATION.wisps.map((w) => p(w.key, w.x, w.y)),
          ...EVAPORATION.drops.map((d) => p(d.key, d.x, d.y)),
          p('g-mid', EVAPORATION.centre.x, EVAPORATION.centre.y),
          p('ripple', 240, SURFACE_EVAP),
        ],
        frame: evaporation,
      }
    case 'extraction':
      return {
        intro: 5.5,
        parts: [...EXTRACTION.solute.map((s) => p(s.key, s.x, s.y)), p('drip', 240, 246), p('ripple', 240, 266)],
        frame: extraction,
      }
    case 'solution':
      return {
        intro: 7,
        parts: [...SOLUTION.crystals.map((c) => p(c.key, c.ax, c.ay)), ...SOLUTION.dissolved.map((d) => p(d.key, d.x, d.y))],
        frame: solution,
      }
    case 'crystallization':
      return {
        intro: 7.5,
        parts: [...CRYSTALLIZATION.crystals.map((c) => p(c.key, c.ax, c.ay)), ...CRYSTALLIZATION.feed.map((f) => p(f.key, f.x, f.y))],
        frame: crystallization,
      }
    case 'filtration':
      return {
        intro: 6.5,
        parts: [
          p('cake', 190, 104),
          p('filtrate', 196, 262),
          ...FILTRATION.residue.map((q) => p(q.key, q.x, q.y)),
          p('d0', 240, 214),
          p('d1', 240, 214),
          p('r0', 240, 262),
          p('r1', 240, 262),
        ],
        frame: filtration,
      }
    case 'chromatography':
      return {
        intro: 7.5,
        parts: [...CHROMATOGRAPHY.bands.map((b) => p(b.key, 228, b.y)), p('mobile', 240, 86), p('drip', 240, 250)],
        frame: chromatography,
      }
    default:
      return {
        intro: 5,
        parts: [...SEPARATION.a.map((a) => p(a.key, a.x, a.y)), ...SEPARATION.b.map((b) => p(b.key, b.x, b.y)), p('divider', 240, 176)],
        frame: separation,
      }
  }
}
