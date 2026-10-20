import type { Exercise, PrescribedExercise } from '@/lib/types'

export type ExerciseRow = PrescribedExercise & {
  exercises: (Partial<Exercise> & { secondary_muscle?: string | null }) | null
}

export type PreviousSet = { weight: number; reps: number }

export type SetEntry = {
  setNumber: number
  type: string
  targetReps: string
  targetRir: number | null
  weight: string
  reps: string
  previous: PreviousSet | null
  completed: boolean
  rowId: string | null
  saving: boolean
  isPR: boolean
  // Série adicionada pelo aluno além do que o treinador prescreveu.
  extra: boolean
}

export type RestState = {
  endsAt: number | null
  pausedRemaining: number | null
  total: number
}

export function parseNumber(value: string) {
  const number = Number(value.replace(',', '.'))
  return Number.isFinite(number) ? number : 0
}
