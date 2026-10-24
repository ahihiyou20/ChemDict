import type Lenis from 'lenis'
import type { Ref } from 'vue'

/**
 * The page's one motion layer: GSAP (ScrollTrigger, SplitText) and Lenis, loaded once after hydration.
 * Lenis is driven by GSAP's ticker, so the page runs a single animation loop (COMMIT-SHEET §9).
 */
export interface Motion {
  gsap: typeof import('gsap')['gsap']
  ScrollTrigger: typeof import('gsap/ScrollTrigger')['ScrollTrigger']
  SplitText: typeof import('gsap/SplitText')['SplitText']
  /** Null under reduced motion: the page keeps native scrolling. */
  lenis: Lenis | null
  reduced: boolean
  /** A mouse or trackpad: hover effects that follow the pointer only run here. */
  finePointer: boolean
}

let loading: Promise<Motion> | undefined
let ready: Motion | undefined
/** Resolves once a route change has rendered and the router has reset the scroll position. */
let settling: Promise<void> | undefined

export function loadMotion(): Promise<Motion> {
  loading ??= boot()
  return loading
}

/** The motion layer if it has already loaded, for code that must not wait. */
export function currentMotion(): Motion | undefined {
  return ready
}

export function beginNavigation(settled: Promise<void>) {
  settling = settled.then(() => {
    settling = undefined
    ready?.ScrollTrigger.refresh()
  })
}

async function boot(): Promise<Motion> {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const [{ gsap }, { ScrollTrigger }, { SplitText }, lenisModule] = await Promise.all([
    import('gsap'),
    import('gsap/ScrollTrigger'),
    import('gsap/SplitText'),
    reduced ? null : import('lenis'),
  ])
  gsap.registerPlugin(ScrollTrigger, SplitText)

  let lenis: Lenis | null = null
  if (lenisModule) {
    lenis = new lenisModule.default({
      autoRaf: false,
      lerp: 0.1,
      wheelMultiplier: 0.9,
      stopInertiaOnNavigate: true,
      prevent: (node) => node.hasAttribute('data-lenis-prevent'),
    })
    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add((time) => lenis?.raf(time * 1000))
    gsap.ticker.lagSmoothing(0)
  }

  // Trigger positions move once fonts and images settle.
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true })
  document.fonts?.ready.then(() => ScrollTrigger.refresh())

  ready = { gsap, ScrollTrigger, SplitText, lenis, reduced, finePointer: matchMedia('(pointer: fine)').matches }
  return ready
}

/** Run `setup` inside a gsap.context scoped to `scope` once motion is ready; everything it made is killed on unmount. */
export function useMotionScope(
  scope: Ref<HTMLElement | null>,
  setup: (motion: Motion, root: HTMLElement) => void | (() => void),
  options: { reduced?: boolean } = {},
) {
  let revert: (() => void) | undefined
  let disposed = false

  onMounted(async () => {
    const motion = await loadMotion()
    // After a route change, wait until the new page sits at its final scroll position,
    // so triggers above the fold fire now and the rest wait for the reader.
    if (settling) await settling
    const root = scope.value
    if (disposed || !root) return
    if (motion.reduced && !options.reduced) {
      revealPre(root)
      return
    }
    let cleanup: void | (() => void)
    const ctx = motion.gsap.context(() => {
      cleanup = setup(motion, root)
    }, root)
    revert = () => {
      cleanup?.()
      // Kill, not revert: the scope's DOM is about to be discarded, so restoring split text and
      // inline styles would only spend layout work while the next page (a lookup) is mounting.
      ctx.kill()
    }
  })

  onBeforeUnmount(() => {
    disposed = true
    revert?.()
  })
}

/**
 * Hand a pre-hidden element (data-pre) over to script. Returns false when the CSS failsafe has already
 * shown it, in which case the caller skips its entrance rather than hiding visible content again.
 */
export function revealPre(el: Element): boolean {
  if (!el.hasAttribute('data-pre')) return true
  const waiting = getComputedStyle(el).opacity === '0'
  el.removeAttribute('data-pre')
  return waiting
}
