// Aquecimento sugerido e anilhas por lado. Contas puras, sem dependências
// (nem alias "@/"): roda no aparelho sem internet e é testado direto no Node
// (tests/contas-novidades.mjs). Não grava nada e não mexe na fila de envio.

// Anilhas comuns de academia (kg), da maior para a menor.
export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25] as const

// Barras do seletor; 0 = sem barra (anilhas direto no aparelho).
export const BARS = [20, 15, 10, 0] as const
export type BarWeight = (typeof BARS)[number]
export const DEFAULT_BAR: BarWeight = 20

// Menor degrau de carga: a menor anilha dos dois lados (2 × 1,25 kg).
export const LOAD_STEP = PLATES[PLATES.length - 1] * 2

// Séries de aquecimento: % da carga de trabalho e repetições decrescentes.
export const WARMUP_STEPS = [
  { percent: 40, reps: 10 },
  { percent: 60, reps: 6 },
  { percent: 80, reps: 3 },
] as const

// Tipos de série que já são aquecimento/aproximação prescritos pelo treinador.
export const PRESCRIBED_WARMUP_TYPES = ['warmup', 'feeder']

// Contas em centésimos de kg para fugir dos erros de ponto flutuante.
const toCents = (kg: number) => Math.round(kg * 100)
const fromCents = (cents: number) => cents / 100

export function isBarWeight(value: unknown): value is BarWeight {
  return (BARS as readonly unknown[]).includes(value)
}

export type PlateResult = {
  // Carga pedida.
  target: number
  // Carga que dá para montar (igual à pedida quando exact).
  total: number
  bar: BarWeight
  // Anilhas de UM lado, da maior para a menor.
  perSide: number[]
  exact: boolean
  // A carga pedida é menor que a própria barra.
  belowBar: boolean
}

// Anilhas por lado para uma carga total, com a barra escolhida. Quando a carga
// não fecha com as anilhas, devolve a montagem mais próxima (empate: a menor).
export function platesFor(target: number, bar: BarWeight): PlateResult {
  const safeTarget = Number.isFinite(target) && target > 0 ? target : 0
  const barCents = toCents(bar)
  const smallest = toCents(PLATES[PLATES.length - 1])
  const targetCents = toCents(safeTarget)
  const belowBar = targetCents < barCents
  // Por lado, arredondado ao múltiplo mais próximo da menor anilha.
  const sideWanted = Math.max(0, (targetCents - barCents) / 2)
  let sideCents = Math.round(sideWanted / smallest) * smallest
  // Math.round sobe no empate; preferimos a carga menor (mais segura).
  if (sideCents - sideWanted === smallest / 2) sideCents -= smallest
  const perSide: number[] = []
  let rest = sideCents
  for (const plate of PLATES) {
    const plateCents = toCents(plate)
    while (rest >= plateCents) {
      perSide.push(plate)
      rest -= plateCents
    }
  }
  const totalCents = barCents + sideCents * 2
  return {
    target: safeTarget,
    total: fromCents(totalCents),
    bar,
    perSide,
    exact: totalCents === targetCents,
    belowBar,
  }
}

// Arredonda ao degrau de carga mais próximo (2,5 kg).
export function roundToStep(kg: number) {
  const step = toCents(LOAD_STEP)
  return fromCents(Math.round(toCents(kg) / step) * step)
}

export type WarmupSet = {
  percent: number
  reps: number
  load: number
  plates: PlateResult
}

// Séries de aquecimento até a carga de trabalho. Nunca abaixo da barra e
// sempre abaixo da carga de trabalho; cargas repetidas viram uma série só
// (fica a primeira, com mais repetições).
export function suggestWarmup(workingLoad: number, bar: BarWeight): WarmupSet[] {
  if (!Number.isFinite(workingLoad) || workingLoad <= 0) return []
  const sets: WarmupSet[] = []
  for (const step of WARMUP_STEPS) {
    const load = Math.max(bar, roundToStep((workingLoad * step.percent) / 100))
    if (load <= 0 || load >= workingLoad) continue
    if (sets.some((set) => set.load === load)) continue
    sets.push({ percent: step.percent, reps: step.reps, load, plates: platesFor(load, bar) })
  }
  return sets
}

type WarmupEntry = {
  type: string
  targetWeight: number | null
  previous: { weight: number } | null
}

// Carga de trabalho do exercício: a primeira série que não é aquecimento, com
// a carga-alvo do treinador ou, sem ela, a carga da última vez.
export function workingLoadOf(entries: readonly WarmupEntry[]): number | null {
  for (const entry of entries) {
    if (PRESCRIBED_WARMUP_TYPES.includes(entry.type)) continue
    const load = entry.targetWeight ?? entry.previous?.weight ?? null
    if (load !== null && Number.isFinite(load) && load > 0) return load
  }
  return null
}

export function hasPrescribedWarmup(entries: readonly { type: string }[]) {
  return entries.some((entry) => PRESCRIBED_WARMUP_TYPES.includes(entry.type))
}

// O botão "Aquecer" só aparece se o treinador não passou aquecimento nesse
// exercício e se há carga (exercício com o peso do corpo não tem).
export function canSuggestWarmup(entries: readonly WarmupEntry[]) {
  return !hasPrescribedWarmup(entries) && workingLoadOf(entries) !== null
}

const kgFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
export const formatPlateKg = (kg: number) => kgFormat.format(kg)

export function barLabel(bar: BarWeight) {
  return bar === 0 ? 'Sem barra' : `Barra de ${formatPlateKg(bar)} kg`
}

// "na barra de 20 kg: 15 + 5 de cada lado" · "só a barra de 20 kg" ·
// "sem barra: 10 de cada lado". Descreve a montagem possível (result.total).
export function describePlates(result: PlateResult) {
  const plates = result.perSide.map(formatPlateKg).join(' + ')
  if (result.bar === 0) return plates ? `sem barra: ${plates} de cada lado` : 'sem anilhas'
  const bar = `barra de ${formatPlateKg(result.bar)} kg`
  return plates ? `na ${bar}: ${plates} de cada lado` : `só a ${bar}`
}
