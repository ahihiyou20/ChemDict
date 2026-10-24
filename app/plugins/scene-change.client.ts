/**
 * Scene change between pages (COMMIT-SHEET §10).
 *
 * `wipe`: a view transition whose wipe main.css draws as a solvent front. Its guard is the last one
 * registered (after Nuxt's payload guard and its navigation-repaint guard, which waits for a frame and
 * would stall for 100ms inside a transition, where frames are held), so the page's code and payload
 * are loaded before the old page is captured. The new snapshot is taken as soon as the route commits
 * and the new page keeps rendering live inside the transition: the screen is held for the two captures
 * only, never for the page's own work.
 *
 * `sweep`: the same flame front runs down over the new page without covering anything. It replaces the
 * wipe wherever the captures would cost a lookup time: no View Transitions API, a GPU emulated on the
 * CPU, a capture measured slower than three frames, or a "/" jump straight into typing.
 */
const STORE = 'chemdict-scene'
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i
const MAX_CAPTURE_MS = 50

export default defineNuxtPlugin(() => {
  const router = useRouter()
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const pendingFocus = useState('pending-search-focus', () => false)
  const root = document.documentElement
  const canWipe = typeof document.startViewTransition === 'function'
  let mode = canWipe ? readMode() : 'sweep'
  let running: ViewTransition | undefined

  function readMode() {
    try {
      return sessionStorage.getItem(STORE) === 'sweep' ? 'sweep' : 'wipe'
    } catch {
      return 'wipe'
    }
  }

  function demote() {
    mode = 'sweep'
    try {
      sessionStorage.setItem(STORE, 'sweep')
    } catch {
      // The choice still holds for this page's life.
    }
  }

  // Once per session, at idle: a software GPU makes every capture expensive.
  function probe() {
    if (mode !== 'wipe') return
    try {
      const gl = document.createElement('canvas').getContext('webgl')
      const info = gl?.getExtension('WEBGL_debug_renderer_info')
      const renderer = info ? String(gl!.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
      if (SOFTWARE.test(renderer)) demote()
      else sessionStorage.setItem(STORE, 'wipe')
    } catch {
      // No verdict: keep the wipe and let the capture timing decide.
    }
  }

  function sweep() {
    const front = document.createElement('div')
    front.className = 'rx-sweep'
    front.setAttribute('aria-hidden', 'true')
    front.addEventListener('animationend', () => front.remove(), { once: true })
    document.body.append(front)
  }

  function wipe(proceed: () => void) {
    let committed!: () => void
    const routed = new Promise<void>((resolve) => (committed = resolve))
    let routedAt = 0
    const stop = router.afterEach(() => {
      stop()
      nextTick(() => {
        routedAt = performance.now()
        committed()
      })
    })
    root.classList.add('rx-route')
    const started = performance.now()
    let captured = 0
    const transition = document.startViewTransition(() => {
      captured = performance.now()
      proceed()
      return routed
    })
    running = transition
    transition.ready
      .then(() => {
        // What the two captures cost; slower than three frames and the sweep takes over from now on.
        if (captured - started + (performance.now() - routedAt) > MAX_CAPTURE_MS) demote()
      })
      .catch(() => committed())
    transition.finished
      .finally(() => {
        if (running === transition) {
          running = undefined
          root.classList.remove('rx-route')
        }
      })
      .catch(() => {})
  }

  onNuxtReady(() => {
    if (canWipe && mode === 'wipe') {
      let known = false
      try {
        known = sessionStorage.getItem(STORE) !== null
      } catch {}
      if (!known) requestIdleCallback(probe, { timeout: 4000 })
    }

    router.beforeResolve((to, from) => {
      if (to.path === from.path || reduced.matches) return
      running?.skipTransition()
      if (mode === 'sweep' || pendingFocus.value) {
        const stop = router.afterEach(() => {
          stop()
          sweep()
        })
        return
      }
      return new Promise<void>((proceed) => wipe(proceed))
    })
  })
})
