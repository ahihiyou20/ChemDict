import { createMoleculeScene, type MoleculeScene, type SceneFromWorker, type SceneToWorker } from './molecule-scene'

/**
 * Runs the molecule scene off the main thread: parsing three.js and drawing never block typing.
 * The page's GSAP ticker still paces it, one `frame` message per tick.
 */
// The app's TypeScript config uses the DOM lib, so describe the worker scope by hand.
const scope = self as unknown as {
  postMessage: (message: SceneFromWorker) => void
  onmessage: ((event: MessageEvent<SceneToWorker>) => void) | null
}
const post = (message: SceneFromWorker) => scope.postMessage(message)
let scene: MoleculeScene | undefined

scope.onmessage = async ({ data }: MessageEvent<SceneToWorker>) => {
  if (data.type === 'init') {
    try {
      scene = await createMoleculeScene(data.canvas, { ...data.options, onLost: () => post({ type: 'lost' }) })
      post({ type: 'ready', isWebGPU: scene.isWebGPU, isSoftware: scene.isSoftware })
    } catch (error) {
      post({ type: 'failed', reason: String(error) })
    }
    return
  }
  if (!scene) return
  if (data.type === 'resize') scene.resize(data.layout)
  else if (data.type === 'palette') scene.setPalette(data.palette)
  else if (data.type === 'frame') {
    scene.render(data.frame)
    post({ type: 'drawn' })
  }
}
