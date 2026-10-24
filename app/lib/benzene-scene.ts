import * as THREE from 'three/webgpu'
import { instancedBufferAttribute, mix, sin, smoothstep, time, uniform, uv, vec3, float } from 'three/tsl'

/**
 * Procedural electron-density cloud of benzene (C6H6): σ density around the ring atoms and
 * bonds in ink, the delocalised π system as two rings above and below the plane in the accent.
 * Rendered as instanced point sprites on a transparent canvas; one canvas per page.
 */

const C_RADIUS = 1.39 // Å, C–C ring
const H_RADIUS = 2.48 // Å, C–H hydrogens
const DISTANCE = 9.4
const TILT = -0.82

/** Deterministic PRNG so every visit draws the same molecule. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Cloud {
  positions: Float32Array
  meta: Float32Array // seed, kind (0 σ, 1 π)
  count: number
}

function buildCloud(scale: number): Cloud {
  const rand = mulberry32(0xc6c6)
  const gauss = () => {
    const u = Math.max(rand(), 1e-7)
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
  }
  const points: number[] = []
  const meta: number[] = []
  const push = (x: number, y: number, z: number, kind: number) => {
    points.push(x, y, z)
    meta.push(rand(), kind)
  }
  const n = (count: number) => Math.round(count * scale)

  const ring = Array.from({ length: 6 }, (_, k) => {
    const a = (k * Math.PI) / 3
    return {
      c: [Math.cos(a) * C_RADIUS, Math.sin(a) * C_RADIUS] as const,
      h: [Math.cos(a) * H_RADIUS, Math.sin(a) * H_RADIUS] as const,
    }
  })

  for (const [i, atom] of ring.entries()) {
    for (let j = 0; j < n(560); j++) push(atom.c[0] + gauss() * 0.2, atom.c[1] + gauss() * 0.2, gauss() * 0.17, 0)
    for (let j = 0; j < n(170); j++) push(atom.h[0] + gauss() * 0.15, atom.h[1] + gauss() * 0.15, gauss() * 0.13, 0)
    const next = ring[(i + 1) % 6]!.c
    for (let j = 0; j < n(180); j++) {
      const t = rand()
      push(atom.c[0] + (next[0] - atom.c[0]) * t + gauss() * 0.09, atom.c[1] + (next[1] - atom.c[1]) * t + gauss() * 0.09, gauss() * 0.08, 0)
    }
    for (let j = 0; j < n(110); j++) {
      const t = rand()
      push(atom.c[0] + (atom.h[0] - atom.c[0]) * t + gauss() * 0.07, atom.c[1] + (atom.h[1] - atom.c[1]) * t + gauss() * 0.07, gauss() * 0.06, 0)
    }
  }

  // Delocalised π electrons: a torus above and one below the ring plane.
  for (const side of [1, -1]) {
    for (let j = 0; j < n(1700); j++) {
      const a = rand() * Math.PI * 2
      const r = C_RADIUS + gauss() * 0.26
      push(Math.cos(a) * r, Math.sin(a) * r, side * (0.78 + Math.abs(gauss()) * 0.16), 1)
    }
  }

  return { positions: new Float32Array(points), meta: new Float32Array(meta), count: points.length / 3 }
}

/** Resolve any CSS colour (oklch included) to sRGB through a 1px canvas. */
function cssColor(value: string, target: THREE.Color) {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!ctx) return target
  ctx.fillStyle = value
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return target.setRGB(r! / 255, g! / 255, b! / 255, THREE.SRGBColorSpace)
}

/**
 * True when the GPU is emulated on the CPU (SwiftShader, llvmpipe, WARP, fallback adapters),
 * where an animated cloud would cost the whole page its frame rate.
 */
function isSoftwareRenderer(backend: unknown): boolean {
  const software = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i
  const { gl, device } = backend as {
    gl?: WebGL2RenderingContext | null
    device?: { adapterInfo?: { isFallbackAdapter?: boolean; description?: string; device?: string } } | null
  }
  if (gl) {
    const debug = gl.getExtension('WEBGL_debug_renderer_info')
    return software.test(String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER)))
  }
  const info = device?.adapterInfo
  return Boolean(info?.isFallbackAdapter) || software.test(`${info?.description ?? ''} ${info?.device ?? ''}`)
}

export interface BenzeneScene {
  isWebGPU: boolean
  /** CPU-emulated GPU: draw one still frame instead of animating. */
  isSoftware: boolean
  render: (deltaSeconds: number) => void
  resize: (width: number, height: number) => void
  setPointer: (x: number, y: number) => void
  setReveal: (value: number) => void
  syncColors: () => void
  dispose: () => void
}

export async function createBenzeneScene(
  canvas: HTMLCanvasElement,
  options: { still: boolean; onLost: () => void },
): Promise<BenzeneScene> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  // A lost GPU device leaves a dead canvas; hand control back so the hero can drop it.
  renderer.onDeviceLost = () => options.onLost()
  // Mandatory: wait for device negotiation before any render or capability check.
  await renderer.init()

  const isWebGPU = Boolean((renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend)
  const isSoftware = isSoftwareRenderer(renderer.backend)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSoftware ? 1 : isWebGPU ? 2 : 1.5))
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
  camera.position.set(0, 0, DISTANCE)

  // Graceful degradation: the WebGL2 fallback draws about half the points.
  const cloud = buildCloud(isWebGPU ? 1 : 0.7)
  const position = instancedBufferAttribute<'vec3'>(new THREE.InstancedBufferAttribute(cloud.positions, 3))
  const meta = instancedBufferAttribute<'vec2'>(new THREE.InstancedBufferAttribute(cloud.meta, 2))
  const seed = meta.x
  const kind = meta.y

  const ink = uniform(new THREE.Color())
  const accent = uniform(new THREE.Color())
  const reveal = uniform(0)

  const material = new THREE.PointsNodeMaterial({ transparent: true, depthWrite: false, sizeAttenuation: false })
  // π points breathe along the ring normal; σ points stay put.
  const breath = options.still ? float(0) : sin(time.mul(0.9).add(seed.mul(6.2832))).mul(0.05)
  material.positionNode = position.add(vec3(0, 0, breath.mul(kind)))
  material.sizeNode = mix(float(1.7), float(2.3), kind)
  material.colorNode = mix(ink, accent, kind)
  const disc = smoothstep(0.5, 0.2, uv().sub(0.5).length())
  material.opacityNode = disc.mul(mix(float(0.62), float(0.9), kind)).mul(reveal)

  const sprites = new THREE.Sprite(material)
  sprites.count = cloud.count
  sprites.frustumCulled = false

  // Outer group tilts the ring towards the viewer; inner group spins it about its own axis.
  const tilt = new THREE.Group()
  const spin = new THREE.Group()
  tilt.rotation.set(TILT, 0, 0.18)
  spin.add(sprites)
  tilt.add(spin)
  scene.add(tilt)

  const pointer = { x: 0, y: 0 }
  const syncColors = () => {
    const styles = getComputedStyle(document.documentElement)
    cssColor(styles.getPropertyValue('--ink').trim(), ink.value as THREE.Color)
    cssColor(styles.getPropertyValue('--accent').trim(), accent.value as THREE.Color)
  }
  syncColors()

  return {
    isWebGPU,
    isSoftware,
    render(delta) {
      if (!options.still) {
        spin.rotation.z += delta * 0.12
        tilt.rotation.x += (TILT + pointer.y * 0.16 - tilt.rotation.x) * Math.min(1, delta * 3)
        tilt.rotation.y += (pointer.x * 0.22 - tilt.rotation.y) * Math.min(1, delta * 3)
      }
      renderer.render(scene, camera)
    },
    resize(width, height) {
      if (!width || !height) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      // Keep the whole molecule in frame on narrow, tall boxes.
      camera.position.z = camera.aspect < 1 ? DISTANCE / camera.aspect : DISTANCE
      camera.updateProjectionMatrix()
    },
    setPointer(x, y) {
      pointer.x = x
      pointer.y = y
    },
    setReveal(value) {
      reveal.value = value
    },
    syncColors,
    dispose() {
      material.dispose()
      renderer.dispose()
    },
  }
}
