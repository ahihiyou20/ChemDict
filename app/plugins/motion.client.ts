/**
 * Boots the motion layer after hydration and keeps Lenis in step with route changes.
 * Nothing here waits on an animation: navigation and lookups always run at full speed.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()

  nuxtApp.hook('app:mounted', () => {
    loadMotion()
  })

  router.beforeEach((to, from) => {
    if (to.path === from.path) return
    // Drop any wheel inertia so the new page starts where the router puts it.
    const lenis = currentMotion()?.lenis
    if (lenis) {
      lenis.stop()
      lenis.start()
    }
    beginNavigation(
      new Promise((resolve) => {
        // The router scrolls one frame after page:loading:end; wait one frame more.
        nuxtApp.hooks.hookOnce('page:loading:end', () => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
      }),
    )
  })
})
