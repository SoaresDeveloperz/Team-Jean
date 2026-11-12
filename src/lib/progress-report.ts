// Relatório de evolução por exercício para o treinador (aba "Evolução" da ficha do aluno).
// Contas puras: roda no Node (tests/contas-evolucao.mjs), sem imports do app.

export type ReportSet = {
  session_id: string
  exercise_id: string
  weight_kg: number | null
  reps: number | null
  set_type?: string | null
}

export type ReportSession = { id: string; completed_at: string }

// Melhor série de um exercício num treino: maior carga (empate: mais repetições).
export type ExercisePoint = { sessionId: string; date: string; weight: number; reps: number }

export type ExerciseTrend = {
  exerciseId: string
  // Treino de referência: o último antes do período; sem ele, o primeiro do período.
  base: ExercisePoint
  latest: ExercisePoint
  // Pontos do gráfico: a referência e os treinos do período.
  points: ExercisePoint[]
  // 'kg' compara a carga; 'reps' compara repetições (exercício sem carga, como barra fixa).
  unit: 'kg' | 'reps'
  // Variação em % (null quando só há um registro).
  change: number | null
}

// Aquecimento e série de aproximação não contam: não é carga de trabalho.
const PREP = new Set(['warmup', 'feeder'])

export function buildTrends(sessions: ReportSession[], sets: ReportSet[], periodStart: Date): ExerciseTrend[] {
  const dateById = new Map(sessions.map((session) => [session.id, session.completed_at]))
  const best = new Map<string, Map<string, ExercisePoint>>()
  for (const set of sets) {
    const date = dateById.get(set.session_id)
    if (!date || PREP.has(set.set_type ?? '')) continue
    const weight = Number(set.weight_kg) || 0
    const reps = Number(set.reps) || 0
    if (weight <= 0 && reps <= 0) continue
    const bySession = best.get(set.exercise_id) ?? new Map<string, ExercisePoint>()
    const current = bySession.get(set.session_id)
    if (!current || weight > current.weight || (weight === current.weight && reps > current.reps)) {
      bySession.set(set.session_id, { sessionId: set.session_id, date, weight, reps })
    }
    best.set(set.exercise_id, bySession)
  }

  const start = periodStart.getTime()
  const trends: ExerciseTrend[] = []
  for (const [exerciseId, bySession] of best) {
    const all = [...bySession.values()].sort((first, second) => first.date.localeCompare(second.date))
    const inPeriod = all.filter((point) => new Date(point.date).getTime() >= start)
    if (inPeriod.length === 0) continue
    const before = all.filter((point) => new Date(point.date).getTime() < start).at(-1)
    const base = before ?? inPeriod[0]
    const latest = inPeriod[inPeriod.length - 1]
    const unit = base.weight > 0 && latest.weight > 0 ? 'kg' : 'reps'
    const from = unit === 'kg' ? base.weight : base.reps
    const to = unit === 'kg' ? latest.weight : latest.reps
    const change = base === latest || from <= 0 ? null : ((to - from) / from) * 100
    trends.push({ exerciseId, base, latest, points: before ? [before, ...inPeriod] : inPeriod, unit, change })
  }
  return trends
}

export type TrendKind = 'down' | 'up' | 'same' | 'first'

export function trendKind(trend: ExerciseTrend): TrendKind {
  if (trend.change === null) return 'first'
  // Arredonda como a tela mostra: +0,4% aparece como 0%, então é "manteve".
  const rounded = Math.round(trend.change)
  return rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'same'
}

// Quedas primeiro (pedem conversa), depois quem subiu (maior alta antes), manteve e primeiro registro.
const ORDER: Record<TrendKind, number> = { down: 0, up: 1, same: 2, first: 3 }
export function sortTrends<T extends ExerciseTrend>(trends: T[]): T[] {
  return [...trends].sort((first, second) => {
    const kind = ORDER[trendKind(first)] - ORDER[trendKind(second)]
    if (kind !== 0) return kind
    if (trendKind(first) === 'down') return (first.change ?? 0) - (second.change ?? 0)
    return (second.change ?? 0) - (first.change ?? 0)
  })
}

// "+4%", "-12%", "0%"
export function formatChange(change: number) {
  const rounded = Math.round(change)
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}
