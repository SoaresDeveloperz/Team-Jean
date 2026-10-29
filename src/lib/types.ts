// Formato das linhas que o app lê do Supabase. Campos opcionais são colunas
// que podem não existir no banco: o app só filtra/ordena pelas obrigatórias e
// lê as opcionais via select('*'), tolerando a ausência.

export type Profile = {
  id: string
  role: string | null
  full_name: string | null
  email: string | null
  readiness_score?: number | null
  created_at?: string | null
  // supabase/profile.sql
  avatar_path?: string | null
  cover_path?: string | null
  bio?: string | null
  goal?: string | null
  instagram?: string | null
  // supabase/gestao.sql (avaliação física)
  sex?: 'M' | 'F' | null
  birth_date?: string | null
  height_cm?: number | null
}

export type Exercise = {
  id: string
  name: string
  muscle_group: string | null
  secondary_muscle?: string | null
  image_url?: string | null
  video_url?: string | null
  // supabase/exercicios.sql: arquivo do GIF na biblioteca (src/lib/exercises/media.ts).
  media_id?: string | null
}

export type PlannedSet = {
  type: string
  reps: string
  rir: number | string | null
  // Carga-alvo em kg definida pelo treinador (opcional).
  weight?: number | string | null
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
  // supabase/trocar-exercicio.sql: marca do treinador e alternativas aceitas.
  essential?: boolean | null
  alternatives?: string[] | null
  exercises?: Partial<Exercise> | null
}

export type WorkoutSession = {
  id: string
  assigned_workout_id: string
  student_id: string
  status: string
  completed_at: string | null
  session_rpe: number | null
  // supabase/gestao.sql: recado do aluno e resposta do treinador.
  feedback?: string | null
  feedback_tags?: string[] | null
  coach_reply?: string | null
  coach_reply_at?: string | null
  // supabase/treino-curto.sql: o aluno fez a versão curta ("Tenho pouco tempo").
  short_mode?: boolean | null
  // supabase/trocar-exercicio.sql: quantos exercícios o aluno trocou.
  swaps?: number | null
  // Não existe na tabela atual; lidos só se um dia forem adicionados.
  created_at?: string | null
  started_at?: string | null
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
  created_at?: string | null
}

export type AppNotification = {
  id: string
  recipient_id: string
  type: string
  title: string
  message: string
  created_at?: string | null
  pushed_at?: string | null
}
