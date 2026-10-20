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

// Músculo principal e secundários pelo nome do exercício, como nos mapas do
// Hevy. A ordem importa: variações específicas antes das genéricas.
const EXERCISE_RULES: Rule[] = [
  [/punho|wrist/, [['forearms', 1]]],
  [/encolhimento|shrug/, [['traps', 1]]],
  [/remada alta|upright/, [['shoulders', 1], ['traps', 0.7]]],
  [/crucifixo invers|crucifixo invertido|voador invertido|face ?pull|reverse fly/, [['shoulders', 1], ['traps', 0.5]]],
  [/elevacao (lateral|frontal)|lateral raise/, [['shoulders', 1]]],
  [/desenvolvimento|militar|arnold|overhead press/, [['shoulders', 1], ['triceps', 0.5]]],
  [/supino inclinado|incline/, [['chest', 1], ['shoulders', 0.6], ['triceps', 0.5]]],
  [/supino|bench|flexao de braco|push ?up/, [['chest', 1], ['triceps', 0.5], ['shoulders', 0.4]]],
  [/paralela|mergulho|\bdips?\b/, [['triceps', 1], ['chest', 0.6], ['shoulders', 0.3]]],
  [/crucifixo|crossover|voador|peck ?deck|\bfly\b/, [['chest', 1], ['shoulders', 0.3]]],
  [/pull ?over/, [['lats', 1], ['chest', 0.4]]],
  [/remada|\brow\b/, [['lats', 1], ['traps', 0.6], ['biceps', 0.4], ['lowerback', 0.2]]],
  [/puxada|barra fixa|pull ?down|pull ?up|chin ?up|graviton/, [['lats', 1], ['biceps', 0.5]]],
  [/rosca|curl\b/, [['biceps', 1], ['forearms', 0.4]]],
  [/tricep|testa|frances|kickback/, [['triceps', 1]]],
  [/stiff|romeno|romanian|\brdl\b|bom dia|good morning/, [['hamstrings', 1], ['glutes', 0.7], ['lowerback', 0.4]]],
  [/levantamento terra|deadlift|\bterra\b/, [['hamstrings', 0.8], ['glutes', 0.8], ['lowerback', 0.7], ['quads', 0.5], ['traps', 0.4]]],
  [/flexora|leg curl|nordic/, [['hamstrings', 1]]],
  [/elevacao pelvica|hip thrust|ponte|glute|abdutora|abducao/, [['glutes', 1], ['hamstrings', 0.4]]],
  [/extensora|leg extension|sissy/, [['quads', 1]]],
  [/agachamento|squat|leg ?press|hack|afundo|bulgaro|passada|avanco|lunge|step ?up/, [['quads', 1], ['glutes', 0.7], ['hamstrings', 0.3]]],
  [/panturrilha|gemeos|soleo|calf/, [['calves', 1]]],
  [/prancha|abdominal|crunch|infra|elevacao de pernas|russian|plank|sit ?up/, [['abs', 1]]],
  [/hiperextensao|lombar/, [['lowerback', 1], ['glutes', 0.4]]],
]

// Combina o grupo cadastrado com o nome do exercício. Grupo genérico
// ("Pernas", "Costas") ou vazio: o nome detalha a distribuição. Grupo
// específico ("Peito"): ele continua sendo o principal e o nome só soma os
// secundários (no máximo 0,6), respeitando a escolha do treinador.
export function regionsForExercise(
  exercise: string | null | undefined,
  muscle: string | null | undefined,
): [MuscleRegion, number][] {
  const group = regionsFor(muscle)
  if (!exercise) return group
  const text = normalize(exercise)
  const byName = EXERCISE_RULES.find(([pattern]) => pattern.test(text))?.[1] ?? []
  if (byName.length === 0) return group
  if (group.length !== 1) return byName
  const [primary] = group[0]
  return [
    [primary, 1],
    ...byName
      .filter(([region]) => region !== primary)
      .map(([region, factor]): [MuscleRegion, number] => [region, Math.min(factor, 0.6)]),
  ]
}

// exercise: nome do exercício (opcional) para detalhar principal e secundários.
export type MuscleWork = { muscle: string | null | undefined; amount: number; exercise?: string | null }

// Soma o trabalho por região (séries; músculo secundário vale metade) e
// normaliza para 0..1 em relação à região mais trabalhada.
export function muscleLoad(work: MuscleWork[]): Partial<Record<MuscleRegion, number>> {
  const totals: Partial<Record<MuscleRegion, number>> = {}
  for (const { muscle, amount, exercise } of work) {
    for (const [region, factor] of regionsForExercise(exercise, muscle)) {
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

type RecoveryEntry = { completedAt: Date; muscle: string | null | undefined; amount: number; exercise?: string | null }

// Recuperação por região (0 = acabou de treinar, 1 = recuperado), considerando
// só sessões com pelo menos 2 séries efetivas na região. Regiões recuperadas
// não aparecem no resultado.
export function computeRecovery(entries: RecoveryEntry[], now = new Date()) {
  const perSession = new Map<string, { at: Date; region: MuscleRegion; total: number }>()
  for (const { completedAt, muscle, amount, exercise } of entries) {
    for (const [region, factor] of regionsForExercise(exercise, muscle)) {
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
