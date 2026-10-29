// Plano da semana do aluno: qual treino mostrar agora. Contas puras, sem
// dependências (nem alias "@/"), testadas direto no Node (tests/contas-semana.mjs).
//
// Regras (decisão de 2026-10-29, ver DECISOES.md):
// - a semana começa na segunda, 00:00, pelo dia local do aparelho;
// - "feito nesta semana" zera na virada: quem não fez o último treino volta ao
//   primeiro da ordem (nada de "atrasado" ou culpa);
// - o treinador pode marcar um dia (`weekday`, 0 = domingo ... 6 = sábado, igual
//   ao getDay do JavaScript) e a ordem (`position`); sem eles vale a ordem do nome;
// - qualquer treino pode ser feito fora do dia (o plano só sugere).

export type PlanWorkout = { id: string; name: string; weekday?: number | null; position?: number | null }

export type WeekPlan<T> =
  // O treino em andamento (retomar) vem sempre primeiro.
  | { kind: 'in-progress'; workout: T }
  // Treino marcado para hoje, ainda não feito nesta semana.
  | { kind: 'today'; workout: T }
  // Hoje não tem treino marcado (ou já foi feito): descanso; `suggestion` é o que dá para adiantar.
  | { kind: 'rest'; suggestion: T; doneToday: boolean }
  // Sem dias marcados: o primeiro da ordem ainda não feito nesta semana.
  | { kind: 'next'; workout: T }
  // Tudo feito nesta semana: comemora e deixa repetir (`workout` = primeiro da ordem).
  | { kind: 'week-done'; workout: T }

export const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
// Ordem de exibição dos dias: a semana começa na segunda.
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export const isWeekday = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6

// Posição do dia numa semana que começa na segunda (segunda = 0 ... domingo = 6).
const mondayIndex = (weekday: number) => (weekday + 6) % 7

export function weekStart(now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - mondayIndex(now.getDay()))
  return start
}

const normalizeName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
const nameKey = (name: string) => `nome:${normalizeName(name)}`

const latest = (first: string | undefined, second: string | undefined) => (!first ? second : !second ? first : first >= second ? first : second)

export type Completion = { workoutId: string; completedAt: string; workoutName?: string | null }

// Quando cada treino foi concluído pela última vez, por id E por nome: se o treinador
// refaz o "Treino A" (outro id), o que o aluno já fez nesta semana continua valendo.
// Junta o que veio do servidor e o que ainda está na fila do aparelho (sem internet).
export function buildLastDone(completions: Completion[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const item of completions) {
    if (!item.completedAt) continue
    const keys = [item.workoutId, ...(item.workoutName ? [nameKey(item.workoutName)] : [])]
    for (const key of keys) map.set(key, latest(map.get(key), item.completedAt) as string)
  }
  return map
}

// Última conclusão deste treino (pelo id ou pelo nome).
export function completionOf(workout: PlanWorkout, lastDone: Map<string, string>) {
  return latest(lastDone.get(workout.id), lastDone.get(nameKey(workout.name)))
}

// O treino foi concluído nesta semana (segunda 00:00 em diante)?
export function doneThisWeek(completedAt: string | null | undefined, now: Date) {
  if (!completedAt) return false
  const done = new Date(completedAt)
  if (Number.isNaN(done.getTime())) return false
  // Até o fim da semana (não só até "agora"): se o relógio do aparelho mudou depois de
  // finalizar, o treino continua contando como feito.
  const start = weekStart(now)
  const nextStart = new Date(start)
  nextStart.setDate(nextStart.getDate() + 7)
  return done >= start && done < nextStart
}

// Ordem do treinador (`position`); sem ela, ordem do nome (Treino A, B, C...).
export function orderWorkouts<T extends PlanWorkout>(workouts: T[]): T[] {
  return [...workouts].sort((first, second) => {
    const firstPosition = first.position ?? Number.MAX_SAFE_INTEGER
    const secondPosition = second.position ?? Number.MAX_SAFE_INTEGER
    if (firstPosition !== secondPosition) return firstPosition - secondPosition
    return first.name.localeCompare(second.name, 'pt-BR', { numeric: true })
  })
}

export function planWeek<T extends PlanWorkout>(
  workouts: T[],
  lastDone: Map<string, string>,
  now: Date,
  inProgressId: string | null = null,
): WeekPlan<T> | null {
  if (workouts.length === 0) return null

  const inProgress = workouts.find((workout) => workout.id === inProgressId)
  if (inProgress) return { kind: 'in-progress', workout: inProgress }

  const ordered = orderWorkouts(workouts)
  const pending = ordered.filter((workout) => !doneThisWeek(completionOf(workout, lastDone), now))
  const scheduled = (workout: T) => isWeekday(workout.weekday)
  const hasAgenda = ordered.some(scheduled)

  if (!hasAgenda) {
    return pending.length > 0 ? { kind: 'next', workout: pending[0] } : { kind: 'week-done', workout: ordered[0] }
  }

  const today = now.getDay()
  const todays = pending.find((workout) => workout.weekday === today)
  if (todays) return { kind: 'today', workout: todays }
  if (pending.length === 0) return { kind: 'week-done', workout: ordered[0] }

  // Descanso: sugere o próximo dia marcado (ainda nesta semana), depois os sem dia
  // (pela ordem) e, por último, os de dias que já passaram ("ainda dá tempo").
  const todayIndex = mondayIndex(today)
  const upcoming = pending
    .filter((workout) => scheduled(workout) && mondayIndex(workout.weekday as number) > todayIndex)
    .sort((first, second) => mondayIndex(first.weekday as number) - mondayIndex(second.weekday as number))
  const unscheduled = pending.filter((workout) => !scheduled(workout))
  const missed = pending.filter((workout) => scheduled(workout) && mondayIndex(workout.weekday as number) < todayIndex)
  const suggestion = upcoming[0] ?? unscheduled[0] ?? missed[0] ?? pending[0]
  const doneToday = ordered.some((workout) => workout.weekday === today && doneThisWeek(completionOf(workout, lastDone), now))
  return { kind: 'rest', suggestion, doneToday }
}

// Estado de um treino na lista da semana.
export function workoutWeekState(workout: PlanWorkout, lastDone: Map<string, string>, now: Date): 'done' | 'today' | 'pending' | 'missed' {
  if (doneThisWeek(completionOf(workout, lastDone), now)) return 'done'
  if (!isWeekday(workout.weekday)) return 'pending'
  if (workout.weekday === now.getDay()) return 'today'
  return mondayIndex(workout.weekday) < mondayIndex(now.getDay()) ? 'missed' : 'pending'
}
