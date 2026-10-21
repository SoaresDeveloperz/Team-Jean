// Forma do corpo (sem three.js, para rodar também num Web Worker): as
// primitivas da escultura e a geração da malha.
import type { MuscleRegion } from '@/lib/muscles'
import { ellipsoid, roundCone, sculpt, spindle, type Primitive, type SculptMesh, type Vec3 } from './sdf'

// A figura tem 8 "cabeças" de altura (pés em y = 0); a malha sai centrada.
export const FIGURE_HEIGHT = 8

export const REGION_ORDER: MuscleRegion[] = [
  'chest',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'traps',
  'lats',
  'lowerback',
]
export const regionSlot = (region: MuscleRegion) => REGION_ORDER.indexOf(region) + 1

// ------------------------------------------------------------------ forma
type Limb = { a: Vec3; b: Vec3; r1: number; r2: number }

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

// Ponto na superfície de um membro: t ao longo do eixo, dir para fora
// (x, z no plano), inset = quanto o centro do músculo fica para dentro.
function onLimb(limb: Limb, t: number, dir: [number, number], inset: number): Vec3 {
  const axis = lerp3(limb.a, limb.b, t)
  const radius = limb.r1 + (limb.r2 - limb.r1) * t - inset
  const length = Math.hypot(dir[0], dir[1])
  return add(axis, [(dir[0] / length) * radius, 0, (dir[1] / length) * radius])
}

function figurePrimitives(): Primitive[] {
  const base: Primitive[] = []
  const muscles: Primitive[] = []
  const r = regionSlot

  // Base: tronco, cabeça e membros (fusão larga = transições orgânicas).
  base.push(ellipsoid(0, [0, 6.0, -0.02], [0.78, 0.8, 0.49], [0, 0, 0], 0.3))
  base.push(roundCone(0, [-0.82, 6.5, -0.07], [0.82, 6.5, -0.07], 0.21, 0.21, 0.3))
  base.push(ellipsoid(0, [0, 5.16, 0], [0.56, 0.64, 0.39], [0, 0, 0], 0.32))
  base.push(ellipsoid(0, [0, 4.36, -0.03], [0.66, 0.46, 0.42], [0, 0, 0], 0.3))
  base.push(roundCone(0, [0, 6.5, -0.07], [0, 7.12, -0.01], 0.21, 0.185, 0.16))
  base.push(ellipsoid(0, [0, 7.6, 0.02], [0.32, 0.42, 0.37], [0.1, 0, 0], 0.12))
  base.push(ellipsoid(0, [0, 7.3, 0.07], [0.235, 0.2, 0.26], [0, 0, 0], 0.14))

  const limbs = { upperArm: [] as Limb[], forearm: [] as Limb[], thigh: [] as Limb[], shin: [] as Limb[] }
  for (const side of [-1, 1]) {
    const upperArm: Limb = { a: [side * 0.98, 6.34, -0.03], b: [side * 1.24, 5.08, -0.02], r1: 0.19, r2: 0.13 }
    const forearm: Limb = { a: [side * 1.24, 5.08, -0.02], b: [side * 1.42, 3.98, 0.07], r1: 0.14, r2: 0.082 }
    const thigh: Limb = { a: [side * 0.39, 4.28, -0.01], b: [side * 0.35, 2.22, 0.02], r1: 0.33, r2: 0.175 }
    const shin: Limb = { a: [side * 0.35, 2.2, 0.01], b: [side * 0.33, 0.24, -0.04], r1: 0.165, r2: 0.09 }
    limbs.upperArm.push(upperArm)
    limbs.forearm.push(forearm)
    limbs.thigh.push(thigh)
    limbs.shin.push(shin)
    base.push(roundCone(0, upperArm.a, upperArm.b, upperArm.r1, upperArm.r2, 0.16))
    base.push(roundCone(0, forearm.a, forearm.b, forearm.r1, forearm.r2, 0.08))
    base.push(ellipsoid(0, [side * 1.465, 3.76, 0.1], [0.095, 0.2, 0.056], [0, 0, side * 0.08], 0.08))
    base.push(ellipsoid(0, [side * 1.41, 3.82, 0.16], [0.034, 0.1, 0.04], [-0.3, 0, side * 0.35], 0.03))
    base.push(roundCone(0, thigh.a, thigh.b, thigh.r1, thigh.r2, 0.14))
    base.push(roundCone(0, shin.a, shin.b, shin.r1, shin.r2, 0.1))
    base.push(ellipsoid(0, [side * 0.35, 2.24, 0.15], [0.1, 0.12, 0.07], [0, 0, 0], 0.05))
    base.push(ellipsoid(0, [side * 0.34, 0.13, 0.11], [0.12, 0.11, 0.3], [0, 0, 0], 0.12))
  }

  // Superfície do tronco (base) na altura y, para apoiar os músculos.
  const baseField = (x: number, y: number, z: number) => {
    let value = Infinity
    for (const primitive of base) {
      const d = primitive.distance(x, y, z)
      const k = primitive.blend
      const h = Math.max(k - Math.abs(value - d), 0) / k
      value = Math.min(value, d) - h * h * k * 0.25
    }
    return value
  }
  const surface = (x: number, y: number, side: 1 | -1) => {
    for (let z = side * 1.2; side > 0 ? z > -0.2 : z < 0.2; z -= side * 0.005) {
      if (baseField(x, y, z) <= 0) return z
    }
    return 0
  }
  // Centro de um músculo "deitado" no tronco: um pouco para dentro da superfície.
  const onTorso = (x: number, y: number, side: 1 | -1, inset: number): Vec3 => [x, y, surface(x, y, side) - side * inset]

  for (const side of [-1, 1]) {
    const s = side
    const [upperArm, forearm, thigh, shin] = [
      limbs.upperArm[s < 0 ? 0 : 1],
      limbs.forearm[s < 0 ? 0 : 1],
      limbs.thigh[s < 0 ? 0 : 1],
      limbs.shin[s < 0 ? 0 : 1],
    ]

    // Peitoral: largo, inclinado em direção ao ombro.
    muscles.push(ellipsoid(r('chest'), onTorso(s * 0.37, 6.08, 1, 0.12), [0.42, 0.27, 0.16], [0.14, s * 0.2, s * -0.14], 0.07))
    // Abdômen: 4 pares de "gomos" e os oblíquos.
    for (const y of [5.7, 5.42, 5.14, 4.86]) {
      muscles.push(ellipsoid(r('abs'), onTorso(s * 0.125, y, 1, 0.045), [0.112, 0.118, 0.06], [0, 0, 0], 0.035))
    }
    muscles.push(ellipsoid(r('abs'), onTorso(s * 0.46, 5.12, 1, 0.1), [0.14, 0.34, 0.13], [0, s * 0.55, s * 0.1], 0.06))
    // Deltoide: capuz arredondado sobre o ombro.
    muscles.push(ellipsoid(r('shoulders'), [s * 0.99, 6.42, -0.02], [0.25, 0.32, 0.27], [0, 0, s * -0.32], 0.08))

    // Braço: bíceps na frente, tríceps atrás (duas cabeças), antebraço.
    muscles.push(spindle(r('biceps'), onLimb(upperArm, 0.2, [0, 1], 0.08), onLimb(upperArm, 0.82, [0, 1], 0.07), [0.135, 0.125], 0.05))
    muscles.push(spindle(r('triceps'), onLimb(upperArm, 0.08, [0, -1], 0.07), onLimb(upperArm, 0.86, [0, -1], 0.07), [0.14, 0.13], 0.05))
    muscles.push(spindle(r('triceps'), onLimb(upperArm, 0.22, [s, -0.6], 0.06), onLimb(upperArm, 0.72, [s, -0.6], 0.06), [0.1, 0.1], 0.04))
    muscles.push(spindle(r('forearms'), onLimb(forearm, 0.05, [0, 1], 0.07), onLimb(forearm, 0.62, [0, 1], 0.05), [0.13, 0.11], 0.05))
    muscles.push(spindle(r('forearms'), onLimb(forearm, 0.05, [s, 0.4], 0.06), onLimb(forearm, 0.55, [s, 0.4], 0.05), [0.095, 0.085], 0.04))

    // Costas: trapézio (fibras de cima), dorsal em "V", eretores da lombar.
    muscles.push(spindle(r('traps'), [s * 0.1, 6.98, -0.13], [s * 0.82, 6.53, -0.09], [0.085, 0.15], 0.07))
    const latTop = onTorso(s * 0.7, 6.12, -1, 0.08)
    const latBottom = onTorso(s * 0.3, 5.0, -1, 0.05)
    muscles.push(spindle(r('lats'), latTop, latBottom, [0.29, 0.13], 0.06, s * 0.35))
    muscles.push(spindle(r('lowerback'), onTorso(s * 0.13, 5.5, -1, 0.06), onTorso(s * 0.14, 4.55, -1, 0.06), [0.1, 0.08], 0.05))
    muscles.push(ellipsoid(r('glutes'), onTorso(s * 0.31, 4.22, -1, 0.06), [0.32, 0.34, 0.2], [0, 0, s * 0.1], 0.09))

    // Coxa: quadríceps (reto, vasto lateral e medial) e posteriores.
    muscles.push(spindle(r('quads'), onLimb(thigh, 0.1, [0, 1], 0.06), onLimb(thigh, 0.8, [0, 1], 0.05), [0.17, 0.14], 0.05))
    muscles.push(spindle(r('quads'), onLimb(thigh, 0.14, [s, 0.35], 0.06), onLimb(thigh, 0.78, [s, 0.35], 0.05), [0.15, 0.14], 0.05))
    muscles.push(ellipsoid(r('quads'), onLimb(thigh, 0.82, [-s, 0.8], 0.04), [0.12, 0.19, 0.11], [0, 0, s * 0.25], 0.05))
    muscles.push(spindle(r('hamstrings'), onLimb(thigh, 0.12, [s * 0.5, -1], 0.06), onLimb(thigh, 0.82, [s * 0.5, -1], 0.05), [0.15, 0.14], 0.05))
    muscles.push(spindle(r('hamstrings'), onLimb(thigh, 0.16, [-s * 0.5, -1], 0.06), onLimb(thigh, 0.8, [-s * 0.5, -1], 0.05), [0.13, 0.12], 0.05))

    // Perna: gastrocnêmio (duas cabeças) atrás e tibial na frente.
    muscles.push(spindle(r('calves'), onLimb(shin, 0.04, [s * 0.6, -1], 0.04), onLimb(shin, 0.5, [s * 0.6, -1], 0.04), [0.12, 0.13], 0.05))
    muscles.push(spindle(r('calves'), onLimb(shin, 0.06, [-s * 0.6, -1], 0.04), onLimb(shin, 0.45, [-s * 0.6, -1], 0.04), [0.11, 0.13], 0.05))
    muscles.push(spindle(r('calves'), onLimb(shin, 0.06, [s * 0.4, 1], 0.05), onLimb(shin, 0.62, [s * 0.4, 1], 0.04), [0.06, 0.06], 0.04))
  }
  // Trapézio médio e inferior (losango nas costas).
  muscles.push(spindle(r('traps'), onTorso(0, 6.82, -1, 0.06), onTorso(0, 5.5, -1, 0.05), [0.44, 0.09], 0.07))

  return [...base, ...muscles]
}

// Grade de 4 cm: ~26 mil vértices, detalhe suficiente para o abdômen.
export function sculptFigure(): SculptMesh {
  const mesh = sculpt(figurePrimitives(), 0.04, [-1.75, -0.08, -0.8], [1.75, 8.12, 0.75])
  for (let index = 1; index < mesh.positions.length; index += 3) mesh.positions[index] -= FIGURE_HEIGHT / 2
  return mesh
}
