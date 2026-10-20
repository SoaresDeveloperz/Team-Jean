// Regiões desenhadas no mapa muscular e como os grupos musculares cadastrados
// nos exercícios (texto livre, ex.: "Peito", "Pernas") se distribuem nelas.

export type MuscleRegion =
  | 'chest'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'traps'
  | 'lats'
  | 'lowerback'

export const REGION_LABELS: Record<MuscleRegion, string> = {
  chest: 'Peito',
  shoulders: 'Ombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebraços',
  abs: 'Abdômen',
  quads: 'Quadríceps',
  hamstrings: 'Posteriores',
  glutes: 'Glúteos',
  calves: 'Panturrilhas',
  traps: 'Trapézio',
  lats: 'Dorsais',
  lowerback: 'Lombar',
}

// Músculos grandes demoram mais para recuperar.
export const RECOVERY_HOURS: Record<MuscleRegion, number> = {
  chest: 72,
  lats: 72,
  quads: 72,
  hamstrings: 72,
  glutes: 72,
  lowerback: 72,
  shoulders: 48,
  traps: 48,
  biceps: 48,
  triceps: 48,
  forearms: 36,
  abs: 36,
  calves: 48,
}

type Rule = [RegExp, [MuscleRegion, number][]]

// A ordem importa: termos específicos antes dos genéricos ("perna", "costas").
const RULES: Rule[] = [
  [/lombar|eretor/, [['lowerback', 1]]],
  [/trapez/, [['traps', 1]]],
  [/dorsa|latiss/, [['lats', 1]]],
  [/costa|back/, [['lats', 1], ['traps', 0.6], ['lowerback', 0.4]]],
  [/peit|chest|peitoral/, [['chest', 1]]],
  [/ombro|delt|shoulder/, [['shoulders', 1]]],
  [/bicep/, [['biceps', 1]]],
  [/tricep/, [['triceps', 1]]],
  [/antebra|forearm/, [['forearms', 1]]],
  [/abd|core|obliq/, [['abs', 1]]],
  [/quadri/, [['quads', 1]]],
  [/posterior|isquio|hamstring/, [['hamstrings', 1]]],
  [/glut/, [['glutes', 1]]],
  [/panturr|gemeo|soleo|calf|calves/, [['calves', 1]]],
  [/perna|leg|inferior|coxa/, [['quads', 1], ['hamstrings', 0.7], ['glutes', 0.7]]],
  [/braco|arm/, [['biceps', 1], ['triceps', 1]]],
]

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function regionsFor(muscle: string | null | undefined): [MuscleRegion, number][] {
  if (!muscle) return []
  const text = normalize(muscle)
  const match = RULES.find(([pattern]) => pattern.test(text))
  return match ? match[1] : []
}

export type MuscleWork = { muscle: string | null | undefined; amount: number }

// Soma o trabalho por região (séries; músculo secundário vale metade) e
// normaliza para 0..1 em relação à região mais trabalhada.
export function muscleLoad(work: MuscleWork[]): Partial<Record<MuscleRegion, number>> {
  const totals: Partial<Record<MuscleRegion, number>> = {}
  for (const { muscle, amount } of work) {
    for (const [region, factor] of regionsFor(muscle)) {
      totals[region] = (totals[region] ?? 0) + amount * factor
    }
  }
  const max = Math.max(0, ...Object.values(totals))
  if (max === 0) return {}
  return Object.fromEntries(Object.entries(totals).map(([region, total]) => [region, total / max]))
}

// Lista de grupos secundários (coluna opcional secondary_muscle, separada por vírgula/;//).
export function splitSecondary(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return value
    .split(/[,;/]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

// Cores do mapa: esmeralda (trabalho) com opacidade pela intensidade.
export function loadFill(intensity: number) {
  const alpha = 0.28 + 0.72 * Math.min(1, Math.max(0, intensity))
  return `rgba(52, 211, 153, ${alpha.toFixed(2)})`
}

// Recuperação 0..1 (1 = recuperado). Cansado em rosa, quase pronto em âmbar.
export function recoveryFill(recovery: number) {
  if (recovery < 0.5) return '#fb7185'
  if (recovery < 0.85) return '#fbbf24'
  return null
}

type RecoveryEntry = { completedAt: Date; muscle: string | null | undefined; amount: number }

// Recuperação por região (0 = acabou de treinar, 1 = recuperado), considerando
// só sessões com pelo menos 2 séries efetivas na região. Regiões recuperadas
// não aparecem no resultado.
export function computeRecovery(entries: RecoveryEntry[], now = new Date()) {
  const perSession = new Map<string, { at: Date; region: MuscleRegion; total: number }>()
  for (const { completedAt, muscle, amount } of entries) {
    for (const [region, factor] of regionsFor(muscle)) {
      const key = `${completedAt.getTime()}|${region}`
      const current = perSession.get(key) ?? { at: completedAt, region, total: 0 }
      current.total += amount * factor
      perSession.set(key, current)
    }
  }

  const recovery: Partial<Record<MuscleRegion, number>> = {}
  for (const { at, region, total } of perSession.values()) {
    if (total < 2) continue
    const hours = (now.getTime() - at.getTime()) / 3_600_000
    const value = Math.min(1, Math.max(0, hours / RECOVERY_HOURS[region]))
    if (value < 1) recovery[region] = Math.min(recovery[region] ?? 1, value)
  }
  return recovery
}
