// Corpo anatômico esculpido por campo de distância: formas simples (cabeça,
// tronco, membros) fundidas suavemente e, por cima, os músculos das mesmas 13
// regiões do mapa 2D. Cada vértice sabe a que região pertence, e as cores
// mudam no shader sem recriar a malha.
import * as THREE from 'three'
import type { MuscleRegion } from '@/lib/muscles'
import type { SculptMesh } from './sdf'
import { FIGURE_HEIGHT, REGION_ORDER, sculptFigure } from './shape'

export { FIGURE_HEIGHT, REGION_ORDER, regionSlot } from './shape'
const SLOTS = REGION_ORDER.length + 1 // 0 = base

export const BASE_COLOR = new THREE.Color('#17171c')
export const IDLE_MUSCLE = new THREE.Color('#474755')
const BRAND = new THREE.Color('#34d399')

// Lado que mostra melhor cada região (0 = frente, π = costas).
export const REGION_FACING: Record<MuscleRegion, number> = {
  chest: 0,
  abs: 0,
  shoulders: 0.5,
  biceps: 0.35,
  forearms: 0.35,
  quads: 0,
  triceps: Math.PI - 0.35,
  traps: Math.PI,
  lats: Math.PI,
  lowerback: Math.PI,
  glutes: Math.PI,
  hamstrings: Math.PI,
  calves: Math.PI,
}

// A malha não muda nunca: é calculada uma vez por sessão, num Web Worker
// para não travar a tela (no próprio thread se o worker falhar).
let meshPromise: Promise<SculptMesh> | null = null
export function loadFigureMesh() {
  if (!meshPromise) {
    meshPromise = new Promise<SculptMesh>((resolve) => {
      const fallback = () => resolve(sculptFigure())
      try {
        const worker = new Worker(new URL('./sculpt.worker.ts', import.meta.url), { type: 'module' })
        worker.onmessage = (event: MessageEvent<SculptMesh>) => {
          resolve(event.data)
          worker.terminate()
        }
        worker.onerror = () => {
          worker.terminate()
          fallback()
        }
        worker.postMessage(null)
      } catch {
        fallback()
      }
    })
  }
  return meshPromise
}

// ---------------------------------------------------------------- material
export type RegionUniforms = { colors: THREE.Color[]; emissive: THREE.Color[] }

function regionMaterial(uniforms: RegionUniforms) {
  const material = new THREE.MeshPhysicalMaterial({
    roughness: 0.58,
    metalness: 0.04,
    clearcoat: 0.18,
    clearcoatRoughness: 0.6,
  })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRegionColor = { value: uniforms.colors }
    shader.uniforms.uRegionEmissive = { value: uniforms.emissive }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float regionA;
attribute float regionB;
attribute float regionWeight;
attribute float groove;
uniform vec3 uRegionColor[${SLOTS}];
uniform vec3 uRegionEmissive[${SLOTS}];
varying vec3 vRegionColor;
varying vec3 vRegionEmissive;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
int first = int(regionA + 0.5);
int second = int(regionB + 0.5);
// Sulco escuro nas divisas entre músculos; cores misturadas na borda.
float definition = mix(0.5, 1.0, groove);
vRegionColor = mix(uRegionColor[second], uRegionColor[first], regionWeight) * definition;
vRegionEmissive = mix(uRegionEmissive[second], uRegionEmissive[first], regionWeight) * mix(0.55, 1.0, groove);`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vRegionColor;
varying vec3 vRegionEmissive;`,
      )
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( vRegionColor, opacity );')
      .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = vRegionEmissive;')
  }
  return material
}

function radialTexture(inner: string, outer: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64)
    gradient.addColorStop(0, inner)
    gradient.addColorStop(1, outer)
    context.fillStyle = gradient
    context.fillRect(0, 0, 128, 128)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// --------------------------------------------------------------- montagem
export type Figure = {
  root: THREE.Group
  body: THREE.Mesh
  pedestal: THREE.Group
  dashes: THREE.Group
  uniforms: RegionUniforms
  // Centro de cada região (coordenadas da figura) para a câmera focar.
  centers: Map<MuscleRegion, THREE.Vector3>
  regionAt: (hit: THREE.Intersection) => MuscleRegion | null
  dispose: () => void
}

export function buildFigure(mesh: SculptMesh): Figure {
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(item: T) => {
    disposables.push(item)
    return item
  }

  const geometry = track(new THREE.BufferGeometry())
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
  geometry.setAttribute('regionA', new THREE.BufferAttribute(mesh.regionA, 1))
  geometry.setAttribute('regionB', new THREE.BufferAttribute(mesh.regionB, 1))
  geometry.setAttribute('regionWeight', new THREE.BufferAttribute(mesh.weights, 1))
  geometry.setAttribute('groove', new THREE.BufferAttribute(mesh.grooves, 1))
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()

  const uniforms: RegionUniforms = {
    colors: Array.from({ length: SLOTS }, (_, slot) => (slot === 0 ? BASE_COLOR.clone() : IDLE_MUSCLE.clone())),
    emissive: Array.from({ length: SLOTS }, () => new THREE.Color(0, 0, 0)),
  }
  const body = new THREE.Mesh(geometry, track(regionMaterial(uniforms)))

  const root = new THREE.Group()
  root.add(body)

  const centers = new Map<MuscleRegion, THREE.Vector3>()
  const sums = Array.from({ length: SLOTS }, () => ({ point: new THREE.Vector3(), count: 0 }))
  const positions = geometry.getAttribute('position')
  for (let index = 0; index < positions.count; index++) {
    const slot = Math.round(mesh.regionA[index])
    sums[slot].point.x += positions.getX(index)
    sums[slot].point.y += positions.getY(index)
    sums[slot].point.z += positions.getZ(index)
    sums[slot].count++
  }
  REGION_ORDER.forEach((region, index) => {
    const { point, count } = sums[index + 1]
    centers.set(region, count > 0 ? point.divideScalar(count) : new THREE.Vector3())
  })

  // Região do vértice mais perto do ponto tocado.
  const regionAt = (hit: THREE.Intersection) => {
    const face = hit.face
    if (!face) return null
    const local = body.worldToLocal(hit.point.clone())
    let best = face.a
    let bestDistance = Infinity
    for (const vertex of [face.a, face.b, face.c]) {
      const distance = local.distanceToSquared(new THREE.Vector3(positions.getX(vertex), positions.getY(vertex), positions.getZ(vertex)))
      if (distance < bestDistance) {
        bestDistance = distance
        best = vertex
      }
    }
    const slot = Math.round(mesh.regionA[best])
    return slot > 0 ? REGION_ORDER[slot - 1] : null
  }

  // ------------------------------------------------------------- pedestal
  const pedestal = new THREE.Group()
  pedestal.position.y = -FIGURE_HEIGHT / 2
  root.add(pedestal)
  const flat = (item: THREE.Mesh, y: number) => {
    item.rotation.x = -Math.PI / 2
    item.position.y = y
    pedestal.add(item)
    return item
  }
  const glowTexture = track(radialTexture('rgba(52,211,153,0.55)', 'rgba(52,211,153,0)'))
  flat(
    new THREE.Mesh(
      track(new THREE.CircleGeometry(2.3, 64)),
      track(new THREE.MeshBasicMaterial({ map: glowTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })),
    ),
    0.004,
  )
  const shadowTexture = track(radialTexture('rgba(0,0,0,0.8)', 'rgba(0,0,0,0)'))
  const shadow = flat(
    new THREE.Mesh(track(new THREE.CircleGeometry(1, 48)), track(new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }))),
    0.008,
  )
  shadow.scale.set(1.15, 0.7, 1)
  flat(
    new THREE.Mesh(
      track(new THREE.RingGeometry(1.74, 1.79, 96)),
      track(new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0.45, depthWrite: false })),
    ),
    0.01,
  )
  // Anel tracejado girando devagar (efeito de "scanner").
  const dashes = new THREE.Group()
  const dashMaterial = track(new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0.3, depthWrite: false }))
  const dashCount = 28
  for (let index = 0; index < dashCount; index++) {
    const start = (index / dashCount) * Math.PI * 2
    dashes.add(new THREE.Mesh(track(new THREE.RingGeometry(1.95, 1.99, 6, 1, start, Math.PI / dashCount)), dashMaterial))
  }
  dashes.rotation.x = -Math.PI / 2
  dashes.position.y = 0.012
  pedestal.add(dashes)

  return {
    root,
    body,
    pedestal,
    dashes,
    uniforms,
    centers,
    regionAt,
    dispose: () => {
      for (const item of disposables) item.dispose()
    },
  }
}

// "rgba(52, 211, 153, 0.86)" ou "#fb7185" → cor (linear) e intensidade (alfa).
export function parseFill(fill: string): { color: THREE.Color; intensity: number } {
  const rgba = fill.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i)
  if (rgba) {
    const [, red, green, blue, alpha] = rgba
    return {
      color: new THREE.Color().setRGB(Number(red) / 255, Number(green) / 255, Number(blue) / 255, THREE.SRGBColorSpace),
      intensity: alpha === undefined ? 1 : Math.min(1, Math.max(0, Number(alpha))),
    }
  }
  return { color: new THREE.Color(fill), intensity: 1 }
}
