import type { MuscleRegion } from '@/lib/muscles'

// Silhueta estilizada em placas musculares, numa caixa de 100 x 212 por vista.
// Formas com mirror: true são desenhadas do lado esquerdo e espelhadas.

export type BodyShape = {
  region: MuscleRegion | null // null = parte do corpo sem músculo (cabeça, mãos...)
  d: string
  mirror?: boolean
}

function roundedRect(x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  return (
    `M${x + r},${y} h${width - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${height - 2 * r} ` +
    `a${r},${r} 0 0 1 -${r},${r} h-${width - 2 * r} a${r},${r} 0 0 1 -${r},-${r} v-${height - 2 * r} ` +
    `a${r},${r} 0 0 1 ${r},-${r} Z`
  )
}

const HEAD = 'M50,4.5 C55.6,4.5 59.2,9 59.2,15 C59.2,21.2 55.6,26.5 50,26.5 C44.4,26.5 40.8,21.2 40.8,15 C40.8,9 44.4,4.5 50,4.5 Z'
const NECK = 'M45.2,24.5 L54.8,24.5 L56.4,32.5 L43.6,32.5 Z'
const HAND = 'M16.8,119.5 C15.2,123 15.4,127.6 17.9,130.4 C20.4,131.6 23,130.2 23.6,126.8 C24.1,123.8 23.7,121.2 23.2,119.6 Z'
const FOREARM = 'M21.6,85.2 C19.2,95 17.6,106 17.4,116.6 L23.6,117 C25.6,106.4 27.6,95.6 28.6,85.8 Z'
const UPPER_ARM = 'M23.6,60.6 C21.6,67.2 21,75 21.9,82 L28.6,82.6 C30,75.2 30.6,67.2 30.2,57.6 Z'
const KNEE = 'M38.6,160.8 C40.8,159.8 45.6,159.8 47.6,161.2 C47.9,164.4 46.6,167.6 43.1,168.1 C40,167.6 38.3,164.4 38.6,160.8 Z'
const FOOT = 'M38.6,203 C38,206 39,208.6 42,209.2 L47.2,209.2 C47.7,207 47.2,204.6 46.2,203 Z'
const HIP = 'M37.6,100.6 L62.4,100.6 L60.2,108.6 C56.2,110.8 53.2,113.8 50,118.6 C46.8,113.8 43.8,110.8 39.8,108.6 Z'

export const FRONT_SHAPES: BodyShape[] = [
  { region: null, d: HEAD },
  { region: null, d: NECK },
  { region: null, d: HAND, mirror: true },
  { region: null, d: KNEE, mirror: true },
  { region: null, d: FOOT, mirror: true },
  { region: null, d: HIP },
  { region: 'traps', d: 'M43.8,29.6 L44.4,35 L35.2,37.4 C38.2,34 41,31.4 43.8,29.6 Z', mirror: true },
  {
    region: 'shoulders',
    d: 'M34.2,37.2 C27.2,37.2 22.6,42 22,49 C21.8,52.6 22.5,55.6 23.5,58.2 L30.1,55.2 C30.1,49.4 31.6,44.4 35.6,40.8 Z',
    mirror: true,
  },
  {
    region: 'chest',
    d: 'M49.2,37.6 L37.2,38.6 C33.6,41.6 32.2,47 32.6,53 C35.2,58.2 41.2,60.6 49.2,58.6 Z',
    mirror: true,
  },
  { region: 'biceps', d: UPPER_ARM, mirror: true },
  { region: 'forearms', d: FOREARM, mirror: true },
  { region: 'abs', d: roundedRect(44, 61, 5.3, 7.6, 1.6), mirror: true },
  { region: 'abs', d: roundedRect(44, 70.2, 5.3, 7.6, 1.6), mirror: true },
  { region: 'abs', d: roundedRect(44, 79.4, 5.3, 7.6, 1.6), mirror: true },
  { region: 'abs', d: roundedRect(44.4, 88.6, 4.9, 9.4, 1.6), mirror: true },
  {
    region: 'abs',
    d: 'M42.4,61.6 C38.4,63 36.4,68 36.5,75 C36.7,84 38,92 40.6,99 L42.6,98.6 Z',
    mirror: true,
  },
  {
    region: 'quads',
    d: 'M36.6,108.4 C34,120 33.5,135 35.5,150 C36.5,155 39.5,158.4 43.5,158.9 C46.5,158.9 48.5,157.4 49,155 C49.5,140 49,124 48.5,112.6 C45,111 40.6,109.4 36.6,108.4 Z',
    mirror: true,
  },
  {
    region: 'calves',
    d: 'M38.6,170.2 C37,180 37.5,191 39.6,201 L45.6,201 C47.6,191 48,180 47,170.2 C44.6,169.2 41,169.2 38.6,170.2 Z',
    mirror: true,
  },
]

export const BACK_SHAPES: BodyShape[] = [
  { region: null, d: HEAD },
  { region: null, d: NECK },
  { region: null, d: HAND, mirror: true },
  { region: null, d: KNEE, mirror: true },
  { region: null, d: FOOT, mirror: true },
  {
    region: 'traps',
    d: 'M50,25.6 C47,29.6 42,32.8 34.4,37.4 C39.6,39.6 43.4,43.6 46.2,48.6 L50,57.6 L53.8,48.6 C56.6,43.6 60.4,39.6 65.6,37.4 C58,32.8 53,29.6 50,25.6 Z',
  },
  {
    region: 'shoulders',
    d: 'M33.4,38 C27,38 22.6,42.4 22,49.2 C21.8,52.6 22.5,55.6 23.5,58.2 L30.1,55.2 C30.5,49.6 32.2,45 36,41.8 Z',
    mirror: true,
  },
  {
    region: 'lats',
    d: 'M37.2,42.6 C34,49.8 33.8,59 36.2,68 C38,75 40.6,81.6 44.2,87.6 C44.8,78.4 46,68.8 48.6,60.2 C46.6,53.2 43.4,48 40,44.6 C39,43.6 38.1,42.9 37.2,42.6 Z',
    mirror: true,
  },
  {
    region: 'lowerback',
    d: 'M46.6,73.2 L49.3,70.6 L49.3,100.6 C47.4,99 46,95.4 45.6,91 C45.3,85.4 45.7,79.2 46.6,73.2 Z',
    mirror: true,
  },
  { region: 'triceps', d: UPPER_ARM, mirror: true },
  { region: 'forearms', d: FOREARM, mirror: true },
  {
    region: 'glutes',
    d: 'M37,102.4 C34.6,108.4 35,116 38.6,121 C42,124.6 46.6,124.6 49.3,121.6 L49.3,104.6 C45,103.2 40.8,102.4 37,102.4 Z',
    mirror: true,
  },
  {
    region: 'hamstrings',
    d: 'M36.6,125 C35,134.6 35.5,145.4 37.6,155 C39.2,158.6 45,159.6 48.5,157.2 C49.3,147 49.3,136.4 48.7,126.6 C45,128 40.2,127.6 36.6,125 Z',
    mirror: true,
  },
  {
    region: 'calves',
    d: 'M38.2,170 C35.6,177 36,187 39,195 C41,198 45,198 46.6,195 C48.6,187 48.8,177 47.6,170 C44.6,168.6 41.2,168.6 38.2,170 Z',
    mirror: true,
  },
  { region: null, d: 'M40.4,198.6 C40.4,200 40.6,201.2 41,202.4 L45.6,202.4 C45.9,201.2 46,200 46,198.6 Z', mirror: true },
]
