import type { PlannedSet, PrescribedExercise } from './types'

// letter: rótulo curto na tabela de séries (séries "working" são numeradas).
export const SET_TYPES = [
  { value: 'warmup', label: 'Aquecimento', badge: 'Aquecimento', letter: 'A', className: 'border-amber-800/40 bg-amber-950/40 text-amber-400' },
  { value: 'feeder', label: 'Feeder', badge: 'Feeder set', letter: 'F', className: 'border-sky-800/40 bg-sky-950/40 text-sky-400' },
  { value: 'working', label: 'Working', badge: 'Working set', letter: 'W', className: 'border-zinc-800 bg-zinc-900 text-zinc-400' },
  { value: 'top', label: 'Top set', badge: 'Top set', letter: 'T', className: 'border-rose-800/40 bg-rose-950/40 text-rose-400' },
  { value: 'backoff', label: 'Back-off', badge: 'Back-off set', letter: 'B', className: 'border-purple-800/40 bg-purple-950/40 text-purple-400' },
  { value: 'cluster', label: 'Cluster', badge: 'Cluster', letter: 'C', className: 'border-indigo-800/40 bg-indigo-950/40 text-indigo-400' },
  { value: 'myo_reps', label: 'Myo reps', badge: 'Myo reps', letter: 'M', className: 'border-emerald-800/40 bg-emerald-950/40 text-emerald-400' },
] as const

export function getSetTypeInfo(type: string | null | undefined) {
  return SET_TYPES.find((setType) => setType.value === type) ?? SET_TYPES[2]
}

export const REP_PRESETS = ['6-8', '8-10', '8-12', '10-12', '12-15', '15-20', 'Até a falha']

export const MUSCLE_GROUPS = ['Peito', 'Costas', 'Pernas', 'Ombros', 'Bíceps', 'Tríceps', 'Abdômen', 'Panturrilhas']

export function createDefaultPlannedSets(): PlannedSet[] {
  return [
    { type: 'warmup', reps: '15-20', rir: 4 },
    { type: 'feeder', reps: '10-12', rir: 2 },
    { type: 'working', reps: '8-10', rir: 0 },
  ]
}

type PlannedSource = Pick<PrescribedExercise, 'planned_sets' | 'sets_count' | 'target_reps' | 'target_rir' | 'set_type'>

// Fonte única das séries planejadas: usa planned_sets quando existe e, para
// treinos antigos (só sets_count), monta as séries a partir das colunas legadas.
export function getPlannedSets(item: PlannedSource): PlannedSet[] {
  if (Array.isArray(item.planned_sets) && item.planned_sets.length > 0) return item.planned_sets

  const count = Math.max(0, Math.floor(Number(item.sets_count) || 0))
  return Array.from({ length: count }, () => ({
    type: item.set_type || 'working',
    reps: item.target_reps || '8-12',
    rir: item.target_rir ?? null,
  }))
}

export function getSetsCount(item: PlannedSource) {
  return getPlannedSets(item).length
}

// Inputs numéricos chegam como texto; no banco o RIR deve ser número ou null.
export function normalizeRir(value: PlannedSet['rir']) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatKg(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)
}

type RotationWorkout = { id: string; name: string }

// Próximo treino da rotação: o que está em andamento; senão, o que nunca foi
// feito (em ordem de nome: A, B, C...); senão, o feito há mais tempo.
export function pickNextWorkout<T extends RotationWorkout>(
  workouts: T[],
  lastDoneByWorkout: Map<string, string>,
  inProgressWorkoutId: string | null = null,
): T | null {
  const inProgress = workouts.find((workout) => workout.id === inProgressWorkoutId)
  if (inProgress) return inProgress

  return (
    [...workouts].sort((first, second) => {
      const firstDone = lastDoneByWorkout.get(first.id) ?? ''
      const secondDone = lastDoneByWorkout.get(second.id) ?? ''
      if (firstDone !== secondDone) return firstDone.localeCompare(secondDone)
      return first.name.localeCompare(second.name, 'pt-BR', { numeric: true })
    })[0] ?? null
  )
}

// Uma sessão "em andamento" mais nova que isso pode ser retomada.
export const RESUME_WINDOW_MS = 12 * 3_600_000
