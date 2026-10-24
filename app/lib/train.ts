/**
 * The home page's separation train (COMMIT-SHEET §10): shared timing, and the geometry of the glass
 * measured from the sections it runs between. Every stage keys its reaction to the same front line,
 * so the liquid in the gutter and the section it feeds move together without any component calling
 * another; the burette's drops are the one exception, announced as `rx:drop` events on the document.
 */

/** The liquid front sits this far down the viewport; a stage reacts when its anchor crosses it. */
export const FRONT_LINE = 0.62

/** ScrollTrigger position string for "this point of the element crosses the front line". */
export const atFront = (edge: 'top' | 'center' | 'bottom' = 'top', offset = 0) =>
  `${edge}${offset ? `+=${Math.round(offset)}` : ''} ${Math.round(FRONT_LINE * 100)}%`

/** Seconds a drop takes to fall from the burette tip to the flask. */
export const DROP_FALL = 0.5

/** How far into a strip its feed joins it: the strip's origin, a little below its top edge. */
export const feedDepth = (stripHeight: number) => Math.min(stripHeight / 2, 60)

export const LESSONS = [10, 11, 12, 13] as const

/** Detail of the `rx:drop` event: drop `index` of `total` has landed in the flask. */
export interface DropDetail {
  index: number
  total: number
}

export interface Span {
  s0: number
  s1: number
}

export interface Pipe extends Span {
  id: string
  x0: number
  y0: number
  x1: number
  y1: number
  color: string
  main: boolean
}

export interface Vessel extends Span {
  x: number
  top: number
  bottom: number
  w: number
}

/** The detector's chart recorder in the right gutter: one peak per lesson, drawn as its fraction comes off. */
export interface Recorder extends Span {
  left: number
  top: number
  width: number
  height: number
  base: number
  trace: string
  grid: string
  peaks: { n: number; d: string }[]
  /** Pen deflection at each pixel down the paper. */
  signal: Float32Array
}

export interface Layout {
  W: number
  H: number
  wide: boolean
  tube: number
  lw: number
  pipes: Pipe[]
  column: Vessel
  /** Each lesson's band travels down the column until its own fraction starts to elute. */
  bands: Span[]
  burette: Vessel
  flask: { x: number; top: number; w: number; h: number }
  drops: number[]
  outlet: { x: number; y: number }
  recorder: Recorder | null
  /** The still: the free gutter beside the A–Z, where the pot boils. */
  boil: { left: number; width: number; top: number; bottom: number } | null
}

const INK = 'var(--ink)'
const TITRANT = 'var(--ink-secondary)'
const flame = (n: number) => `var(--flame-${n}-mark)`
const r1 = (v: number) => Math.round(v * 10) / 10

export function measureTrain(home: HTMLElement): Layout | null {
  const homeBox = home.getBoundingClientRect()
  const rel = (el: Element | null) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { left: r.left - homeBox.left, right: r.right - homeBox.left, top: r.top - homeBox.top, bottom: r.bottom - homeBox.top, height: r.height }
  }
  const marquee = rel(home.querySelector('.marquee'))
  const az = rel(home.querySelector('section.az'))
  const letters = rel(home.querySelector('.letters'))
  const lanes = rel(home.querySelector('.lanes-section'))
  const ledgerHead = rel(home.querySelector('.ledger-section .section-head'))
  const stripEls = [...home.querySelectorAll('.strip-body')]
  const strips = stripEls.map(rel)
  const rows = [...home.querySelectorAll('.ledger-section tbody tr, .ledger-section tfoot tr')].map(rel)
  if (!marquee || !az || !letters || !lanes || !ledgerHead || strips.length !== LESSONS.length || !rows.length) return null

  const W = homeBox.width
  const H = homeBox.height
  const contentLeft = letters.left
  const contentRight = letters.right
  const gutter = Math.min(contentLeft, W - contentRight)
  const wide = gutter >= 64
  const tube = wide ? 11 : 7
  const lw = wide ? 5 : 3
  const xL = contentLeft / 2
  const xR = (W + contentRight) / 2

  // Scroll position at which a home-relative y reaches the front line.
  const homeTop = homeBox.top + scrollY
  const vh = innerHeight
  const at = (y: number) => homeTop + y - FRONT_LINE * vh

  const pipes: Pipe[] = []
  const main: Span[] = []
  // Windows run in sequence along the main path; a horizontal run takes its own stretch of scroll.
  const chain = (s0: number, s1: number) => {
    const prev = main[main.length - 1]
    const start = prev ? Math.max(s0, prev.s1) : s0
    const span = { s0: start, s1: Math.max(s1, start + 1) }
    main.push(span)
    return span
  }
  const vertical = (id: string, x: number, y0: number, y1: number, color: string) => {
    const span = chain(at(y0), at(y1))
    pipes.push({ id, x0: x, y0, x1: x, y1, color, ...span, main: true })
    return span
  }
  const horizontal = (id: string, y: number, x0: number, x1: number, color: string) => {
    const span = chain(at(y), at(y) + Math.min(0.2 * vh, Math.abs(x1 - x0) * 0.3))
    pipes.push({ id, x0, y0: y, x1, y1: y, color, ...span, main: true })
  }

  const outlet = { x: xL, y: marquee.bottom }
  const colTop = az.bottom + (wide ? 20 : 12)
  const colBottom = strips[0]!.top - (wide ? 18 : 12)
  vertical('distillate', xL, outlet.y, colTop, INK)
  const colSpan = chain(at(colTop), at(colBottom))
  const column: Vessel = { x: xL, top: colTop, bottom: colBottom, w: wide ? 26 : 11, ...colSpan }

  // Fractions elute in lesson order down the gutter; each turns into its own strip at the origin.
  const bands: Span[] = []
  const feeds: number[] = []
  let y = colBottom
  strips.forEach((strip, i) => {
    const n = LESSONS[i]!
    const mid = strip!.top + feedDepth(strip!.height)
    const elute = vertical(`elute-${n}`, xL, y, mid, flame(n))
    bands.push({ s0: column.s0, s1: elute.s0 })
    const s = at(mid)
    pipes.push({ id: `feed-${n}`, x0: xL, y0: mid, x1: contentLeft, y1: mid, color: flame(n), s0: s, s1: s + 0.06 * vh, main: false })
    feeds.push(mid)
    y = mid
  })

  const seam = lanes.bottom
  vertical('titrant-down', xL, y, seam, TITRANT)
  horizontal('titrant-across', seam, xL, xR, TITRANT)
  const bTop = ledgerHead.top
  const bBottom = rows[0]!.top - (wide ? 14 : 10)
  vertical('titrant-in', xR, seam, bTop, TITRANT)
  const bSpan = chain(at(bTop), at(bTop + (bBottom - bTop) * 0.6))
  const burette: Vessel = { x: xR, top: bTop, bottom: bBottom, w: wide ? 14 : 8, ...bSpan }

  // One drop per ledger row, released as that row reaches the front line, never before the burette is charged.
  let previous = burette.s1
  const drops = rows.map((row) => (previous = Math.max(at(row!.top + row!.height / 2), previous + 1)))
  const fw = wide ? 40 : 13
  const flask = { x: xR, top: rows[rows.length - 1]!.bottom + (wide ? 14 : 8), w: fw, h: fw * 1.15 }

  const counts = stripEls.map((el) => el.querySelectorAll('.spot').length)
  const recorder = wide ? chart(strips.map((s) => s!), feeds, counts, contentRight, W, at) : null

  // The last rows never climb to the front line before the page ends: squeeze the tail of the run
  // into the scroll that is left, keeping its order, so the endpoint is reached at the foot of the page.
  const end = document.documentElement.scrollHeight - vh - 8
  const last = drops[drops.length - 1]!
  if (last > end) {
    const knee = Math.max(0, Math.min(end - 0.5 * vh, burette.s0))
    const fit = (s: number) => (s <= knee ? s : knee + ((s - knee) * (end - knee)) / (last - knee))
    for (const span of [...pipes, ...bands, column, burette, ...(recorder ? [recorder] : [])]) {
      span.s0 = fit(span.s0)
      span.s1 = fit(span.s1)
    }
    drops.forEach((s, i) => (drops[i] = fit(s)))
  }

  const boilLeft = contentRight + 16
  const boil = wide && W - 16 - boilLeft >= 40 ? { left: boilLeft, width: W - 16 - boilLeft, top: az.top + 24, bottom: az.bottom - 24 } : null

  return { W, H, wide, tube, lw, pipes, column, bands, burette, flask, drops, outlet, recorder, boil }
}

/**
 * The chart recorder: a baseline down the right gutter beside the strips, one Gaussian peak per lesson
 * level with its feed, its height from the lesson's number of terms. The paper runs with the scroll, so
 * the pen writes at the front line.
 */
function chart(
  strips: { top: number; bottom: number; height: number }[],
  feeds: number[],
  counts: number[],
  contentRight: number,
  W: number,
  at: (y: number) => number,
): Recorder | null {
  const left = contentRight + 20
  const width = W - 14 - left
  if (width < 40) return null
  const top = strips[0]!.top - 48
  const height = strips[strips.length - 1]!.bottom + 24 - top
  const base = 4
  const reach = width - base - 6
  const most = Math.max(...counts, 1)
  const peaks = feeds.map((y, i) => ({
    n: LESSONS[i]!,
    centre: y - top,
    sigma: Math.max(12, Math.min(48, strips[i]!.height * 0.14)),
    height: reach * (0.38 + 0.62 * Math.sqrt(counts[i]! / most)),
  }))

  const signal = new Float32Array(Math.ceil(height) + 1)
  for (let y = 0; y < signal.length; y++) {
    let v = 0
    for (const p of peaks) v += p.height * Math.exp(-((y - p.centre) ** 2) / (2 * p.sigma ** 2))
    signal[y] = v
  }
  let trace = `M${base} 0`
  for (let y = 2; y < signal.length; y += 2) trace += `L${r1(base + signal[y]!)} ${y}`
  const peakPaths = peaks.map((p) => {
    const from = Math.max(0, Math.floor(p.centre - 3 * p.sigma))
    const to = Math.min(signal.length - 1, Math.ceil(p.centre + 3 * p.sigma))
    let d = `M${base} ${from}`
    for (let y = from; y <= to; y += 2) d += `L${r1(base + p.height * Math.exp(-((y - p.centre) ** 2) / (2 * p.sigma ** 2)))} ${y}`
    return { n: p.n, d: `${d}L${base} ${to}Z` }
  })
  let grid = ''
  for (let y = 24; y < height; y += 24) grid += `M${base} ${y}h${width - base}`
  for (const x of [base + reach / 3, base + (2 * reach) / 3, base + reach]) grid += `M${r1(x)} 0v${Math.round(height)}`

  return { left, top, width, height, base, trace, grid, peaks: peakPaths, signal, s0: at(top), s1: at(top + height) }
}
