import type { FrameState, RGB, SceneFromWorker, SceneOptions, ScenePalette, SceneToWorker, StageLayout } from './molecule-scene'

/** The page's view of the molecule scene, whether it draws in a worker or on the main thread. */
export interface StageHandle {
  isWebGPU: boolean
  isSoftware: boolean
  offThread: boolean
  /** Draw one frame. In a worker, frames requested while one is in flight are merged. */
  frame: (frame: FrameState) => void
  resize: (layout: StageLayout) => void
  /** Re-read the palette after a theme change. */
  syncPalette: () => void
  /** Worker round trips in ms for the first frames, for the performance governor. */
  drawTimes: number[]
  dispose: () => void
}

/** The worker could not draw (no OffscreenCanvas WebGL/WebGPU); the canvas it took is spent. */
export class OffThreadFailed extends Error {}

/** Resolve any CSS colour (oklch included) to sRGB through a 1px canvas. */
function cssColor(ctx: CanvasRenderingContext2D, value: string): RGB {
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = value
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return [r! / 255, g! / 255, b! / 255]
}

/** The scene's colours come from the page's tokens, so both themes stay in one place (main.css). */
function readPalette(): ScenePalette {
  const styles = getComputedStyle(document.documentElement)
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!ctx) return { core: [0, 0, 0], sigma: [0, 0, 0], hydrogen: [0, 0, 0], pi: [0, 0, 0], shimmer: [0, 0, 0], dark: false }
  const token = (name: string) => cssColor(ctx, styles.getPropertyValue(name).trim())
  const ground = token('--ground')
  return {
    core: token('--ink'),
    sigma: token('--flame-12-mark'),
    hydrogen: token('--flame-11-mark'),
    pi: token('--accent'),
    shimmer: token('--flame-10-mark'),
    dark: 0.2126 * ground[0] + 0.7152 * ground[1] + 0.0722 * ground[2] < 0.4,
  }
}

export function canDrawOffThread(canvas: HTMLCanvasElement) {
  return typeof Worker !== 'undefined' && typeof canvas.transferControlToOffscreen === 'function'
}

/** Parse and run three.js in a module worker, paced by the page's ticker. */
export function startInWorker(canvas: HTMLCanvasElement, options: Omit<SceneOptions, 'onLost'>, onLost: () => void) {
  const worker = new Worker(new URL('./molecule-worker.ts', import.meta.url), { type: 'module' })
  const offscreen = canvas.transferControlToOffscreen()
  const send = (message: SceneToWorker, transfer: Transferable[] = []) => worker.postMessage(message, transfer)

  let pending = false
  let latest: FrameState | undefined
  let owed = 0
  let sentAt = 0
  const drawTimes: number[] = []
  const flush = () => {
    if (!latest) return
    pending = true
    sentAt = performance.now()
    send({ type: 'frame', frame: { ...latest, delta: owed } })
    latest = undefined
    owed = 0
  }

  return new Promise<StageHandle>((resolve, reject) => {
    const fail = (reason: string) => {
      worker.terminate()
      reject(new OffThreadFailed(reason))
    }
    worker.onerror = (event) => {
      event.preventDefault()
      fail(event.message)
    }
    worker.onmessage = ({ data }: MessageEvent<SceneFromWorker>) => {
      if (data.type === 'drawn') {
        pending = false
        if (drawTimes.length < 12) drawTimes.push(performance.now() - sentAt)
        if (latest) flush()
      } else if (data.type === 'ready') {
        const syncPalette = () => send({ type: 'palette', palette: readPalette() })
        syncPalette()
        resolve({
          isWebGPU: data.isWebGPU,
          isSoftware: data.isSoftware,
          offThread: true,
          frame(frame) {
            owed += frame.delta
            latest = frame
            if (!pending) flush()
          },
          resize: (layout) => send({ type: 'resize', layout }),
          syncPalette,
          drawTimes,
          dispose: () => worker.terminate(),
        })
      } else if (data.type === 'failed') fail(data.reason)
      else if (data.type === 'lost') onLost()
    }
    send({ type: 'init', canvas: offscreen, options }, [offscreen])
  })
}

/** Fallback for browsers without OffscreenCanvas in workers. */
export async function startOnMainThread(canvas: HTMLCanvasElement, options: SceneOptions): Promise<StageHandle> {
  const { createMoleculeScene } = await import('./molecule-scene')
  const scene = await createMoleculeScene(canvas, options)
  const syncPalette = () => scene.setPalette(readPalette())
  syncPalette()
  return {
    isWebGPU: scene.isWebGPU,
    isSoftware: scene.isSoftware,
    offThread: false,
    frame: scene.render,
    resize: scene.resize,
    syncPalette,
    drawTimes: [],
    dispose: scene.dispose,
  }
}
