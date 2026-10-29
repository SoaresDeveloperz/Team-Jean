import type { Exercise, PrescribedExercise } from '@/lib/types'

export type ExerciseRow = PrescribedExercise & {
  exercises: (Partial<Exercise> & { secondary_muscle?: string | null }) | null
  // Exercício trocado hoje: id do exercício que o treinador prescreveu.
  swappedFrom?: string
}

export type PreviousSet = { weight: number; reps: number }

export type SetEntry = {
  setNumber: number
  type: string
  targetReps: string
  targetRir: number | null
  // Carga-alvo do treinador (kg), quando definida na prescrição.
  targetWeight: number | null
  weight: string
  reps: string
  previous: PreviousSet | null
  completed: boolean
  // Id da série em session_sets (gerado no aparelho ao marcar).
  rowId: string | null
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
