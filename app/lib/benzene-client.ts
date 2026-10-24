import type { BenzeneFromWorker, BenzeneOptions, BenzeneToWorker, RGB } from './benzene-scene'

/** The page's view of the benzene scene, whether it draws in a worker or on the main thread. */
export interface BenzeneHandle {
  isWebGPU: boolean
  isSoftware: boolean
  offThread: boolean
  /** Draw one frame. In a worker, frames requested while one is in flight are merged. */
  frame: (deltaSeconds: number) => void
  resize: (width: number, height: number) => void
  setPointer: (x: number, y: number) => void
  setReveal: (value: number) => void
  /** Re-read --ink and --accent after a theme change. */
  syncColors: () => void
  /** Worker round trips in ms for the first frames, for the performance governor. */
  drawTimes: number[]
  dispose: () => void
}

/** The worker could not draw (no OffscreenCanvas WebGL/WebGPU); the canvas it took is spent. */
export class OffThreadFailed extends Error {}

/** Resolve any CSS colour (oklch included) to sRGB through a 1px canvas. */
function cssColor(value: string): RGB {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!ctx) return [0, 0, 0]
  ctx.fillStyle = value
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return [r! / 255, g! / 255, b! / 255]
}

function themeColors(): [RGB, RGB] {
  const styles = getComputedStyle(document.documentElement)
  return [cssColor(styles.getPropertyValue('--ink').trim()), cssColor(styles.getPropertyValue('--accent').trim())]
}

export function canDrawOffThread(canvas: HTMLCanvasElement) {
  return typeof Worker !== 'undefined' && typeof canvas.transferControlToOffscreen === 'function'
}

/** Parse and run three.js in a module worker, paced by the page's ticker. */
export function startInWorker(canvas: HTMLCanvasElement, options: Omit<BenzeneOptions, 'onLost'>, onLost: () => void) {
  const worker = new Worker(new URL('./benzene-worker.ts', import.meta.url), { type: 'module' })
  const offscreen = canvas.transferControlToOffscreen()
  const send = (message: BenzeneToWorker, transfer: Transferable[] = []) => worker.postMessage(message, transfer)

  let pending = false
  let wanted = false
  let owed = 0
  let sentAt = 0
  let reveal = 0
  let pointer: [number, number] = [0, 0]
  const drawTimes: number[] = []
  const flush = () => {
    pending = true
    wanted = false
    sentAt = performance.now()
    send({ type: 'frame', delta: owed, reveal, pointer })
    owed = 0
  }

  return new Promise<BenzeneHandle>((resolve, reject) => {
    const fail = (reason: string) => {
      worker.terminate()
      reject(new OffThreadFailed(reason))
    }
    worker.onerror = (event) => {
      event.preventDefault()
      fail(event.message)
    }
    worker.onmessage = ({ data }: MessageEvent<BenzeneFromWorker>) => {
      if (data.type === 'drawn') {
        pending = false
        if (drawTimes.length < 12) drawTimes.push(performance.now() - sentAt)
        if (wanted) flush()
      } else if (data.type === 'ready') {
        const syncColors = () => {
          const [ink, accent] = themeColors()
          send({ type: 'colors', ink, accent })
        }
        syncColors()
        resolve({
          isWebGPU: data.isWebGPU,
          isSoftware: data.isSoftware,
          offThread: true,
          frame(delta) {
            owed += delta
            wanted = true
            if (!pending) flush()
          },
          resize: (width, height) => send({ type: 'resize', width, height }),
          setPointer: (x, y) => (pointer = [x, y]),
          setReveal: (value) => (reveal = value),
          syncColors,
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
export async function startOnMainThread(canvas: HTMLCanvasElement, options: BenzeneOptions): Promise<BenzeneHandle> {
  const { createBenzeneScene } = await import('./benzene-scene')
  const scene = await createBenzeneScene(canvas, options)
  const syncColors = () => scene.setColors(...themeColors())
  syncColors()
  return {
    isWebGPU: scene.isWebGPU,
    isSoftware: scene.isSoftware,
    offThread: false,
    frame: (delta) => scene.render(delta),
    resize: scene.resize,
    setPointer: scene.setPointer,
    setReveal: scene.setReveal,
    syncColors,
    drawTimes: [],
    dispose: scene.dispose,
  }
}
