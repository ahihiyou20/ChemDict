/**
 * Electron-density point clouds for the four hydrocarbons of Bài 10, plus the gas they condense from.
 * Pure geometry, no three.js and no DOM, so the scene worker can build them itself.
 *
 * Every cloud has the same number of points, shuffled, so a morph sends each point from a random place
 * in one molecule to a random place in the next: the molecule dissolves and re-forms.
 * Coordinates are ångström-proportioned, y up, then scaled so each molecule fills a similar volume.
 */

/** What a point belongs to: 0 carbon core, 1 σ bond, 2 hydrogen, 3 π system. */
export type DensityKind = 0 | 1 | 2 | 3

export interface PointCloud {
  positions: Float32Array
  kinds: Float32Array
}

/** Indices into the clouds built by buildClouds. */
export const GAS = 0
export const BENZENE = 1
export const METHANE = 2
export const ETHYLENE = 3
export const ACETYLENE = 4

type Vec3 = [number, number, number]
type Sampler = () => Vec3
interface Component {
  weight: number
  kind: DensityKind
  sample: Sampler
}

/** Deterministic PRNG so every visit draws the same molecules. */
export function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function toolkit(rand: () => number) {
  const gauss = () => {
    const u = Math.max(rand(), 1e-7)
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
  }
  /** A fuzzy atom or orbital lobe. */
  const blob = (centre: Vec3, sigma: number): Sampler => () => [
    centre[0] + gauss() * sigma,
    centre[1] + gauss() * sigma,
    centre[2] + gauss() * sigma,
  ]
  /** σ density along a bond. */
  const bond = (a: Vec3, b: Vec3, sigma: number): Sampler => () => {
    const t = rand()
    return [
      a[0] + (b[0] - a[0]) * t + gauss() * sigma,
      a[1] + (b[1] - a[1]) * t + gauss() * sigma,
      a[2] + (b[2] - a[2]) * t + gauss() * sigma,
    ]
  }
  return { gauss, blob, bond }
}

/** Spread `total` points over the components by weight, then shuffle so morphs scatter. */
function sample(components: Component[], total: number, rand: () => number, scale: number): PointCloud {
  const weightSum = components.reduce((sum, c) => sum + c.weight, 0)
  const counts = components.map((c) => Math.floor((c.weight / weightSum) * total))
  let remaining = total - counts.reduce((sum, n) => sum + n, 0)
  for (let i = 0; remaining > 0; i = (i + 1) % counts.length, remaining--) counts[i]!++

  const positions = new Float32Array(total * 3)
  const kinds = new Float32Array(total)
  const order = Array.from({ length: total }, (_, i) => i)
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  let n = 0
  components.forEach((component, c) => {
    for (let k = 0; k < counts[c]!; k++, n++) {
      const [x, y, z] = component.sample()
      const slot = order[n]!
      positions[slot * 3] = x * scale
      positions[slot * 3 + 1] = y * scale
      positions[slot * 3 + 2] = z * scale
      kinds[slot] = component.kind
    }
  })
  return { positions, kinds }
}

/** Benzene, C6H6: the ring lies in the xz plane, π density in two tori above and below it. */
function benzene(total: number): PointCloud {
  const rand = mulberry32(0xc6c6)
  const { gauss, blob, bond } = toolkit(rand)
  const C = 1.39
  const H = 2.48
  const ring = Array.from({ length: 6 }, (_, k) => {
    const a = (k * Math.PI) / 3
    return { c: [Math.cos(a) * C, 0, Math.sin(a) * C] as Vec3, h: [Math.cos(a) * H, 0, Math.sin(a) * H] as Vec3 }
  })
  const components: Component[] = []
  ring.forEach((atom, i) => {
    const next = ring[(i + 1) % 6]!.c
    components.push(
      { weight: 560, kind: 0, sample: blob(atom.c, 0.19) },
      { weight: 170, kind: 2, sample: blob(atom.h, 0.15) },
      { weight: 180, kind: 1, sample: bond(atom.c, next, 0.08) },
      { weight: 110, kind: 1, sample: bond(atom.c, atom.h, 0.06) },
    )
  })
  for (const side of [1, -1]) {
    components.push({
      weight: 1700,
      kind: 3,
      sample: () => {
        const a = rand() * Math.PI * 2
        const r = C + gauss() * 0.24
        return [Math.cos(a) * r, side * (0.74 + Math.abs(gauss()) * 0.16), Math.sin(a) * r]
      },
    })
  }
  return sample(components, total, rand, 1.0)
}

/** Methane, CH4: four C–H bonds to the corners of a tetrahedron. */
function methane(total: number): PointCloud {
  const rand = mulberry32(0xc4)
  const { blob, bond } = toolkit(rand)
  const L = 1.09 / Math.sqrt(3)
  const corners: Vec3[] = [
    [L, L, L],
    [L, -L, -L],
    [-L, L, -L],
    [-L, -L, L],
  ]
  const origin: Vec3 = [0, 0, 0]
  const components: Component[] = [{ weight: 30, kind: 0, sample: blob(origin, 0.2) }]
  for (const h of corners) {
    components.push({ weight: 11, kind: 2, sample: blob(h, 0.15) }, { weight: 6.5, kind: 1, sample: bond(origin, h, 0.075) })
  }
  return sample(components, total, rand, 1.7)
}

/** Ethylene, C2H4: planar in xz, C=C along x, the π bond as lobes above and below the plane. */
function ethylene(total: number): PointCloud {
  const rand = mulberry32(0x2404)
  const { gauss, blob, bond } = toolkit(rand)
  const cx = 0.665
  const hx = cx + 1.087 * Math.cos((58.5 * Math.PI) / 180)
  const hz = 1.087 * Math.sin((58.5 * Math.PI) / 180)
  const c1: Vec3 = [cx, 0, 0]
  const c2: Vec3 = [-cx, 0, 0]
  const hydrogens: [Vec3, Vec3][] = [
    [[hx, 0, hz], c1],
    [[hx, 0, -hz], c1],
    [[-hx, 0, hz], c2],
    [[-hx, 0, -hz], c2],
  ]
  const components: Component[] = [
    { weight: 12, kind: 0, sample: blob(c1, 0.18) },
    { weight: 12, kind: 0, sample: blob(c2, 0.18) },
    { weight: 8, kind: 1, sample: bond(c1, c2, 0.075) },
  ]
  for (const [h, c] of hydrogens) {
    components.push({ weight: 5, kind: 2, sample: blob(h, 0.14) }, { weight: 3.5, kind: 1, sample: bond(c, h, 0.06) })
  }
  for (const side of [1, -1]) {
    components.push({
      weight: 17,
      kind: 3,
      sample: () => [gauss() * 0.5, side * (0.62 + Math.abs(gauss()) * 0.2), gauss() * 0.22],
    })
  }
  return sample(components, total, rand, 1.5)
}

/** Acetylene, C2H2: linear along x; two perpendicular π bonds make a cylinder of density round C≡C. */
function acetylene(total: number): PointCloud {
  const rand = mulberry32(0x2202)
  const { gauss, blob, bond } = toolkit(rand)
  const c1: Vec3 = [0.6, 0, 0]
  const c2: Vec3 = [-0.6, 0, 0]
  const h1: Vec3 = [1.66, 0, 0]
  const h2: Vec3 = [-1.66, 0, 0]
  const components: Component[] = [
    { weight: 12, kind: 0, sample: blob(c1, 0.17) },
    { weight: 12, kind: 0, sample: blob(c2, 0.17) },
    { weight: 6, kind: 2, sample: blob(h1, 0.14) },
    { weight: 6, kind: 2, sample: blob(h2, 0.14) },
    { weight: 7, kind: 1, sample: bond(c1, c2, 0.07) },
    { weight: 4, kind: 1, sample: bond(c1, h1, 0.06) },
    { weight: 4, kind: 1, sample: bond(c2, h2, 0.06) },
    {
      weight: 49,
      kind: 3,
      sample: () => {
        const a = rand() * Math.PI * 2
        const r = 0.66 + gauss() * 0.12
        return [gauss() * 0.42, Math.cos(a) * r, Math.sin(a) * r]
      },
    },
  ]
  return sample(components, total, rand, 1.45)
}

/** A loose gas filling the stage, for the opening condensation. */
function gas(total: number): PointCloud {
  const rand = mulberry32(0x9a5)
  const positions = new Float32Array(total * 3)
  const kinds = new Float32Array(total)
  for (let i = 0; i < total; i++) {
    // Uniform in a flattened ellipsoid, denser towards the middle.
    const u = rand() * Math.PI * 2
    const v = Math.acos(2 * rand() - 1)
    const r = 7 * Math.cbrt(rand()) ** 1.4
    positions[i * 3] = Math.sin(v) * Math.cos(u) * r * 1.5
    positions[i * 3 + 1] = Math.cos(v) * r * 0.8
    positions[i * 3 + 2] = Math.sin(v) * Math.sin(u) * r
    kinds[i] = Math.floor(rand() * 4)
  }
  return { positions, kinds }
}

/** All five clouds at the same size, indexed GAS, BENZENE, METHANE, ETHYLENE, ACETYLENE. */
export function buildClouds(total: number): PointCloud[] {
  return [gas(total), benzene(total), methane(total), ethylene(total), acetylene(total)]
}

/** Per-point constants shared by every cloud: a seed and a random unit direction. */
export function buildScatter(total: number): Float32Array {
  const rand = mulberry32(0x5eed)
  const data = new Float32Array(total * 4)
  for (let i = 0; i < total; i++) {
    const u = rand() * Math.PI * 2
    const z = 2 * rand() - 1
    const s = Math.sqrt(1 - z * z)
    data[i * 4] = rand()
    data[i * 4 + 1] = Math.cos(u) * s
    data[i * 4 + 2] = Math.sin(u) * s
    data[i * 4 + 3] = z
  }
  return data
}
