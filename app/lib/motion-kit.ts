import type { Motion } from '~/composables/useMotion'

/**
 * Small motion devices shared by the page's components. Each takes the loaded motion layer and
 * returns a cleanup. They only move transform and opacity (COMMIT-SHEET §4).
 */

type Gsap = Motion['gsap']

// Letters of the element symbols from H to Pb: the alphabet a heading decodes through.
const SYMBOLS = 'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Fe Cu Zn Br Ag Sn I Au Hg Pb'.split(' ')
const UPPER = [...new Set(SYMBOLS.map((symbol) => symbol[0]!))]
const LOWER = [...new Set(SYMBOLS.flatMap((symbol) => [...symbol.slice(1)]))]

function noiseGlyph(original: string): string {
  if (!/\p{L}/u.test(original)) return original
  const pool = original === original.toUpperCase() && original !== original.toLowerCase() ? UPPER : LOWER
  return pool[Math.floor(Math.random() * pool.length)]!
}

/**
 * Element-symbol decode: characters appear as symbol letters and resolve left to right.
 * Every character keeps its measured width, so the line never reflows while it decodes.
 */
export function decode(gsap: Gsap, chars: HTMLElement[], vars: { duration?: number; delay?: number; onComplete?: () => void } = {}) {
  const duration = vars.duration ?? 0.9
  const originals = chars.map((char) => char.textContent ?? '')
  const widths = chars.map((char) => char.getBoundingClientRect().width)
  const count = Math.max(chars.length - 1, 1)
  const appearAt = chars.map((_, i) => 0.35 * (i / count))
  const resolveAt = chars.map((_, i) => 0.3 + 0.7 * (i / count))
  const state = { t: 0 }
  let lastStep = -1

  chars.forEach((char, i) => {
    char.style.width = `${widths[i]}px`
    char.style.textAlign = 'center'
    char.style.opacity = '0'
  })

  const restore = () => {
    chars.forEach((char, i) => {
      char.textContent = originals[i]!
      char.style.width = ''
      char.style.textAlign = ''
      char.style.opacity = ''
    })
  }

  const tween = gsap.to(state, {
    t: 1,
    duration,
    delay: vars.delay ?? 0,
    ease: 'none',
    onUpdate() {
      // Swap glyphs about twenty times a second: fast enough to read as noise, slow enough not to strobe.
      const step = Math.floor(state.t * duration * 20)
      const swap = step !== lastStep
      lastStep = step
      chars.forEach((char, i) => {
        if (state.t < appearAt[i]!) return
        char.style.opacity = ''
        if (state.t >= resolveAt[i]!) {
          if (char.textContent !== originals[i]) char.textContent = originals[i]!
        } else if (swap) {
          char.textContent = noiseGlyph(originals[i]!)
        }
      })
    },
    onComplete() {
      restore()
      vars.onComplete?.()
    },
  })

  return () => {
    tween.kill()
    restore()
  }
}

/** Pull an element towards the pointer while it hovers. Fine pointers only; the caller checks. */
export function magnetic(gsap: Gsap, el: HTMLElement, strength = 0.3, target: HTMLElement = el) {
  const xTo = gsap.quickTo(target, 'x', { duration: 0.45, ease: 'power3.out' })
  const yTo = gsap.quickTo(target, 'y', { duration: 0.45, ease: 'power3.out' })
  // Measure once on entry: the element's own movement must not feed back into the pull.
  let box = el.getBoundingClientRect()
  const enter = () => (box = el.getBoundingClientRect())
  const move = (event: PointerEvent) => {
    xTo((event.clientX - (box.left + box.width / 2)) * strength)
    yTo((event.clientY - (box.top + box.height / 2)) * strength)
  }
  const leave = () => {
    xTo(0)
    yTo(0)
  }
  el.addEventListener('pointerenter', enter)
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerleave', leave)
  return () => {
    el.removeEventListener('pointerenter', enter)
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerleave', leave)
  }
}

/** Tilt an element in 3D towards the pointer, like a tile pressed at that corner. */
export function tilt(gsap: Gsap, el: HTMLElement, degrees = 14, target: HTMLElement = el) {
  gsap.set(target, { transformPerspective: 420 })
  const rxTo = gsap.quickTo(target, 'rotationX', { duration: 0.4, ease: 'power3.out' })
  const ryTo = gsap.quickTo(target, 'rotationY', { duration: 0.4, ease: 'power3.out' })
  let box = el.getBoundingClientRect()
  const enter = () => (box = el.getBoundingClientRect())
  const move = (event: PointerEvent) => {
    const px = (event.clientX - box.left) / box.width - 0.5
    const py = (event.clientY - box.top) / box.height - 0.5
    ryTo(px * degrees * 2)
    rxTo(-py * degrees * 2)
  }
  const leave = () => {
    rxTo(0)
    ryTo(0)
  }
  el.addEventListener('pointerenter', enter)
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerleave', leave)
  return () => {
    el.removeEventListener('pointerenter', enter)
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerleave', leave)
  }
}

/** Characters near the pointer lift, like filings under a magnet. */
export function pointerLift(gsap: Gsap, area: HTMLElement, chars: HTMLElement[], vars: { radius?: number; lift?: number } = {}) {
  const radius = vars.radius ?? 150
  const lift = vars.lift ?? 22
  const setters = chars.map((char) => ({
    y: gsap.quickTo(char, 'yPercent', { duration: 0.5, ease: 'power3.out' }),
    r: gsap.quickTo(char, 'rotation', { duration: 0.5, ease: 'power3.out' }),
  }))
  // Character centres relative to the area, re-measured on entry (layout may have changed since).
  let centres: { x: number; y: number }[] = []
  const measure = () => {
    const origin = area.getBoundingClientRect()
    centres = chars.map((char) => {
      const box = char.getBoundingClientRect()
      return { x: box.left - origin.left + box.width / 2, y: box.top - origin.top + box.height / 2 }
    })
  }
  const move = (event: PointerEvent) => {
    const origin = area.getBoundingClientRect()
    const px = event.clientX - origin.left
    const py = event.clientY - origin.top
    centres.forEach((centre, i) => {
      const dx = centre.x - px
      const distance = Math.hypot(dx, centre.y - py)
      const pull = Math.max(0, 1 - distance / radius) ** 2
      setters[i]!.y(-lift * pull)
      setters[i]!.r(Math.max(-1, Math.min(1, dx / radius)) * 8 * pull)
    })
  }
  const leave = () => setters.forEach((setter) => (setter.y(0), setter.r(0)))
  area.addEventListener('pointerenter', measure)
  area.addEventListener('pointermove', move)
  area.addEventListener('pointerleave', leave)
  return () => {
    area.removeEventListener('pointerenter', measure)
    area.removeEventListener('pointermove', move)
    area.removeEventListener('pointerleave', leave)
  }
}

/** Count a number up from zero; the final value is already in the markup for no-JS readers. */
export function countUp(gsap: Gsap, el: HTMLElement, vars: gsap.TweenVars = {}) {
  const to = Number(el.textContent?.trim() ?? 0)
  if (!Number.isFinite(to) || to <= 0) return gsap.timeline()
  const state = { value: 0 }
  el.textContent = '0'
  return gsap.to(state, {
    value: to,
    duration: 1.1,
    ease: 'power2.out',
    ...vars,
    onUpdate: () => {
      el.textContent = String(Math.round(state.value))
    },
  })
}

/** Decode a heading through element symbols the first time it scrolls into view. */
export function decodeOnEnter({ gsap, ScrollTrigger, SplitText }: Motion, el: HTMLElement, start = 'top 88%') {
  const split = SplitText.create(el, { type: 'words,chars' })
  let stop: (() => void) | undefined
  const trigger = ScrollTrigger.create({
    trigger: el,
    start,
    once: true,
    onEnter: () => (stop = decode(gsap, split.chars as HTMLElement[], { onComplete: () => split.revert() })),
  })
  return () => {
    trigger.kill()
    stop?.()
    split.revert()
  }
}
