import { createBenzeneScene, type BenzeneFromWorker, type BenzeneScene, type BenzeneToWorker } from './benzene-scene'

/**
 * Runs the benzene scene off the main thread: parsing three.js and drawing never block typing.
 * The page's GSAP ticker still paces it, one `frame` message per tick.
 */
// The app's TypeScript config uses the DOM lib, so describe the worker scope by hand.
const scope = self as unknown as {
  postMessage: (message: BenzeneFromWorker) => void
  onmessage: ((event: MessageEvent<BenzeneToWorker>) => void) | null
}
const post = (message: BenzeneFromWorker) => scope.postMessage(message)
let scene: BenzeneScene | undefined

scope.onmessage = async ({ data }: MessageEvent<BenzeneToWorker>) => {
  if (data.type === 'init') {
    try {
      scene = await createBenzeneScene(data.canvas, { ...data.options, onLost: () => post({ type: 'lost' }) })
      post({ type: 'ready', isWebGPU: scene.isWebGPU, isSoftware: scene.isSoftware })
    } catch (error) {
      post({ type: 'failed', reason: String(error) })
    }
    return
  }
  if (!scene) return
  if (data.type === 'resize') scene.resize(data.width, data.height)
  else if (data.type === 'colors') scene.setColors(data.ink, data.accent)
  else if (data.type === 'frame') {
    scene.setReveal(data.reveal)
    scene.setPointer(...data.pointer)
    scene.render(data.delta)
    post({ type: 'drawn' })
  }
}
