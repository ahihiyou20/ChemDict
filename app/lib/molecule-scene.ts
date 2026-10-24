import * as THREE from 'three/webgpu'
import { atan, clamp, float, instancedBufferAttribute, mix, sin, smoothstep, step, time, uniform, uv, vec3 } from 'three/tsl'
import { ACETYLENE, BENZENE, buildClouds, buildScatter, ETHYLENE, GAS, METHANE, type PointCloud } from './molecules'

/**
 * The hero stage: electron-density clouds of Bài 10's hydrocarbons, drawn as instanced point sprites.
 * A gas condenses into benzene, then the cloud morphs through methane, ethylene and acetylene, each point
 * travelling on its own delay. One canvas per page; DOM-free, so it runs in a worker or on the main thread.
 */

const FOV = 30
/** Molecules are built to about this radius. */
const MOLECULE_RADIUS = 2.7
/** How far each cloud leans towards the viewer: benzene shows its ring, the chains show their length. */
const TILTS: Record<number, number> = { [GAS]: 0.5, [BENZENE]: 0.95, [METHANE]: 0.35, [ETHYLENE]: 0.5, [ACETYLENE]: 0.4 }

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

/** sRGB components in 0–1. */
export type RGB = [number, number, number]

export interface ScenePalette {
  /** Carbon cores. */
  core: RGB
  /** σ bonds. */
  sigma: RGB
  hydrogen: RGB
  /** π density shimmers between these two, travelling round the ring. */
  pi: RGB
  shimmer: RGB
  /** Dark grounds blend additively, so dense regions glow. */
  dark: boolean
}

/** Where the molecule sits in the canvas: centre in NDC (-1…1) and its diameter as a share of the height. */
export interface StageLayout {
  width: number
  height: number
  focus: [number, number]
  size: number
}

/** Everything one frame needs from the page. */
export interface FrameState {
  delta: number
  reveal: number
  /** Pointer in canvas NDC, and whether it is over the stage. */
  pointer: [number, number]
  pointerOn: boolean
  /** Cloud indices (see molecules.ts) and the progress from one to the other. */
  from: number
  to: number
  morph: number
  /** 0 → 1 as the hero scrolls away: the cloud scatters and fades. */
  disperse: number
}

export interface MoleculeScene {
  isWebGPU: boolean
  /** CPU-emulated GPU: draw one still frame instead of animating. */
  isSoftware: boolean
  render: (frame: FrameState) => void
  resize: (layout: StageLayout) => void
  setPalette: (palette: ScenePalette) => void
  dispose: () => void
}

export interface SceneOptions {
  still: boolean
  devicePixelRatio: number
  onLost: () => void
}

/** Messages between the page and the scene worker. */
export type SceneToWorker =
  | { type: 'init'; canvas: OffscreenCanvas; options: Omit<SceneOptions, 'onLost'> }
  | { type: 'resize'; layout: StageLayout }
  | { type: 'palette'; palette: ScenePalette }
  | { type: 'frame'; frame: FrameState }
export type SceneFromWorker =
  | { type: 'ready'; isWebGPU: boolean; isSoftware: boolean }
  | { type: 'drawn' }
  | { type: 'failed'; reason: string }
  | { type: 'lost' }

export async function createMoleculeScene(canvas: HTMLCanvasElement | OffscreenCanvas, options: SceneOptions): Promise<MoleculeScene> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  // A lost GPU device leaves a dead canvas; hand control back so the hero can drop it.
  renderer.onDeviceLost = () => options.onLost()
  // Mandatory: wait for device negotiation before any render or capability check.
  await renderer.init()

  const isWebGPU = Boolean((renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend)
  const isSoftware = isSoftwareRenderer(renderer.backend)
  renderer.setPixelRatio(Math.min(options.devicePixelRatio, isSoftware ? 1 : isWebGPU ? 2 : 1.5))
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 80)

  // Graceful degradation: the WebGL2 fallback and software GPUs draw 40% of the WebGPU budget.
  const total = isWebGPU && !isSoftware ? 60000 : 24000
  const clouds: PointCloud[] = buildClouds(total)
  const start = options.still || isSoftware ? BENZENE : 0

  const fromArray = new THREE.InstancedBufferAttribute(new Float32Array(clouds[start]!.positions), 3)
  const toArray = new THREE.InstancedBufferAttribute(new Float32Array(clouds[BENZENE]!.positions), 3)
  const kindArray = new THREE.InstancedBufferAttribute(new Float32Array(total * 2), 2)
  const writeKinds = (from: number, to: number) => {
    const data = kindArray.array as Float32Array
    const a = clouds[from]!.kinds
    const b = clouds[to]!.kinds
    for (let i = 0; i < total; i++) {
      data[i * 2] = a[i]!
      data[i * 2 + 1] = b[i]!
    }
    kindArray.needsUpdate = true
  }
  writeKinds(start, BENZENE)
  let pair: [number, number] = [start, BENZENE]

  const from = instancedBufferAttribute<'vec3'>(fromArray)
  const to = instancedBufferAttribute<'vec3'>(toArray)
  const kinds = instancedBufferAttribute<'vec2'>(kindArray)
  const scatter = instancedBufferAttribute<'vec4'>(new THREE.InstancedBufferAttribute(buildScatter(total), 4))
  const seed = scatter.x
  const direction = vec3(scatter.y, scatter.z, scatter.w)

  const uMorph = uniform(1)
  const uReveal = uniform(0)
  const uDisperse = uniform(0)
  const uRayOrigin = uniform(new THREE.Vector3(0, 0, 100))
  const uRayDirection = uniform(new THREE.Vector3(0, 0, -1))
  const uPush = uniform(0)
  const uAlpha = uniform(1)
  const uPointScale = uniform(1)
  const cCore = uniform(new THREE.Color())
  const cSigma = uniform(new THREE.Color())
  const cHydrogen = uniform(new THREE.Color())
  const cPi = uniform(new THREE.Color())
  const cShimmer = uniform(new THREE.Color())

  // Each point leaves on its own delay and is carried round a vortex mid-flight, so molecules
  // dissolve into a swirl and re-form out of it.
  const local = clamp(uMorph.mul(1.6).sub(seed.mul(0.6)), 0, 1)
  const eased = local.mul(local).mul(float(3).sub(local.mul(2)))
  const bulge = sin(local.mul(Math.PI))
  const flight = bulge.mul(seed.add(0.5)).mul(0.6)
  const drift = options.still ? float(0) : sin(time.mul(0.8).add(seed.mul(6.2832))).mul(0.035)
  const mixed = mix(from, to, eased)
  const swirl = vec3(mixed.z.negate(), 0, mixed.x).mul(bulge.mul(0.7))
  const settled = mixed.add(swirl).add(direction.mul(flight.add(drift)))

  // A fine pointer pushes electrons away from the line of sight through it.
  const rel = settled.sub(uRayOrigin)
  const perpendicular = rel.sub(uRayDirection.mul(rel.dot(uRayDirection)))
  const distance = perpendicular.length()
  const shove = smoothstep(1.5, 0, distance).mul(uPush).mul(0.9)
  const pushed = settled.add(perpendicular.div(distance.add(0.0001)).mul(shove))

  // Scrolling away scatters the cloud outwards.
  const material = new THREE.PointsNodeMaterial({ transparent: true, depthWrite: false, sizeAttenuation: false })
  material.positionNode = pushed.add(direction.mul(uDisperse.mul(seed.mul(4).add(2.5))))

  const colourOf = (kind: typeof kinds.x) => {
    // π density carries a ring current: accent and sodium yellow chase each other round the axis.
    const phase = atan(settled.z, settled.x).mul(3).sub(time.mul(options.still ? 0 : 2.1))
    const pi = mix(cPi, cShimmer, sin(phase).mul(0.5).add(0.5))
    return mix(mix(cCore, cSigma, step(0.5, kind)), mix(cHydrogen, pi, step(2.5, kind)), step(1.5, kind))
  }
  material.colorNode = mix(colourOf(kinds.x), colourOf(kinds.y), eased)
  const kindNow = mix(kinds.x, kinds.y, step(0.5, eased))
  // Sizes in px: π and hydrogen read a touch larger than the σ framework.
  const size = mix(mix(float(1.8), float(1.5), step(0.5, kindNow)), mix(float(1.9), float(2.2), step(2.5, kindNow)), step(1.5, kindNow))
  material.sizeNode = size.mul(uPointScale).mul(seed.mul(0.5).add(0.75))
  const disc = smoothstep(0.5, 0.15, uv().sub(0.5).length())
  const weight = mix(float(0.62), float(0.9), step(2.5, kindNow))
  // Points far from any molecule (the gas, a scattered exit) dim a little so the molecule stays the subject.
  const fade = float(1).sub(uDisperse.mul(0.85)).mul(float(1).sub(bulge.mul(0.2)))
  material.opacityNode = disc.mul(weight).mul(uReveal).mul(uAlpha).mul(fade)

  const sprites = new THREE.Sprite(material)
  sprites.count = total
  sprites.frustumCulled = false

  // Outer group tilts the molecule towards the viewer; inner group spins it about the vertical axis.
  const stage = new THREE.Group()
  const spin = new THREE.Group()
  stage.rotation.set(TILTS[start]!, 0, 0.12)
  spin.add(sprites)
  stage.add(spin)
  scene.add(stage)

  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const inverse = new THREE.Matrix4()
  const tip = new THREE.Vector3()
  let push = 0
  let tiltX = 0
  let tiltY = 0

  const setPair = (next: [number, number]) => {
    if (next[0] === pair[0] && next[1] === pair[1]) return
    if (next[0] !== pair[0]) {
      ;(fromArray.array as Float32Array).set(clouds[next[0]]!.positions)
      fromArray.needsUpdate = true
    }
    if (next[1] !== pair[1]) {
      ;(toArray.array as Float32Array).set(clouds[next[1]]!.positions)
      toArray.needsUpdate = true
    }
    writeKinds(next[0], next[1])
    pair = next
  }

  return {
    isWebGPU,
    isSoftware,
    render(frame) {
      setPair([frame.from, frame.to])
      uMorph.value = frame.morph
      uReveal.value = frame.reveal
      uDisperse.value = frame.disperse
      const ease = Math.min(1, frame.delta * 3)
      const m = frame.morph * frame.morph * (3 - 2 * frame.morph)
      const lean = TILTS[frame.from]! * (1 - m) + TILTS[frame.to]! * m
      if (options.still) stage.rotation.x = lean
      else {
        spin.rotation.y += frame.delta * 0.2
        tiltX += (frame.pointer[1] * -0.14 - tiltX) * ease
        tiltY += (frame.pointer[0] * 0.2 - tiltY) * ease
        stage.rotation.x = lean + tiltX
        stage.rotation.y = tiltY
        push += ((frame.pointerOn ? 1 : 0) - push) * Math.min(1, frame.delta * 4)
      }
      // The pointer's line of sight, in the spinning molecule's own coordinates.
      stage.updateMatrixWorld()
      ndc.set(frame.pointer[0], frame.pointer[1])
      raycaster.setFromCamera(ndc, camera)
      inverse.copy(spin.matrixWorld).invert()
      tip.copy(raycaster.ray.origin).add(raycaster.ray.direction)
      ;(uRayOrigin.value as THREE.Vector3).copy(raycaster.ray.origin).applyMatrix4(inverse)
      ;(uRayDirection.value as THREE.Vector3).copy(tip.applyMatrix4(inverse)).sub(uRayOrigin.value as THREE.Vector3).normalize()
      uPush.value = push
      renderer.render(scene, camera)
    },
    resize({ width, height, focus, size }) {
      if (!width || !height) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      // Pull the camera back until the molecule spans `size` of the stage height.
      const halfHeight = MOLECULE_RADIUS / size
      camera.position.set(0, 0, halfHeight / Math.tan(THREE.MathUtils.degToRad(FOV / 2)))
      camera.updateProjectionMatrix()
      camera.updateMatrixWorld()
      stage.position.set(focus[0] * halfHeight * camera.aspect, focus[1] * halfHeight, 0)
      // Points grow a little with the stage, so a large hero does not look sparse.
      uPointScale.value = Math.min(1.6, Math.max(0.9, height / 560))
    },
    setPalette(palette) {
      ;(cCore.value as THREE.Color).setRGB(...palette.core, THREE.SRGBColorSpace)
      ;(cSigma.value as THREE.Color).setRGB(...palette.sigma, THREE.SRGBColorSpace)
      ;(cHydrogen.value as THREE.Color).setRGB(...palette.hydrogen, THREE.SRGBColorSpace)
      ;(cPi.value as THREE.Color).setRGB(...palette.pi, THREE.SRGBColorSpace)
      ;(cShimmer.value as THREE.Color).setRGB(...palette.shimmer, THREE.SRGBColorSpace)
      const blending = palette.dark ? THREE.AdditiveBlending : THREE.NormalBlending
      if (material.blending !== blending) {
        material.blending = blending
        material.needsUpdate = true
      }
      uAlpha.value = palette.dark ? 0.7 : 1
    },
    dispose() {
      material.dispose()
      renderer.dispose()
    },
  }
}
