// Formato das linhas que o app lê do Supabase. Campos opcionais são colunas
// que podem não existir em todas as versões do banco.

export type Profile = {
  id: string
  role: string | null
  full_name: string | null
  email: string | null
  readiness_score?: number | null
  created_at?: string | null
}

export type Exercise = {
  id: string
  name: string
  muscle_group: string | null
  secondary_muscle?: string | null
  image_url?: string | null
  video_url?: string | null
}

export type PlannedSet = {
  type: string
  reps: string
  rir: number | string | null
}

export type AssignedWorkout = {
  id: string
  student_id: string
  name: string
  is_current: boolean
  created_at: string
  profiles?: Pick<Profile, 'full_name' | 'email'> | null
}

export type WorkoutTemplate = {
  id: string
  name: string
}

// Linha de assigned_workout_exercises ou workout_template_exercises.
export type PrescribedExercise = {
  id: string
  exercise_id: string
  order: number | null
  sets_count: number | null
  target_reps: string | null
  target_rir?: number | string | null
  set_type?: string | null
  planned_sets: PlannedSet[] | null
  notes: string | null
  exercises?: Partial<Exercise> | null
}

export type WorkoutSession = {
  id: string
  assigned_workout_id: string
  student_id: string
  status: string
  created_at: string
  completed_at: string | null
  session_rpe: number | null
}

export type SessionSet = {
  id: string
  session_id: string
  exercise_id: string
  assigned_exercise_id: string | null
  set_number: number
  weight_kg: number | null
  reps: number | null
  rir: number | null
  set_type: string | null
  completed: boolean
  created_at: string | null
}

export type AppNotification = {
  id: string
  recipient_id: string
  type: string
  title: string
  message: string
  created_at: string
}
