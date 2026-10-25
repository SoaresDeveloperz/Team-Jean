'use client'

// Dados que a tela de execução do treino precisa, com uma cópia no aparelho
// para reabrir o treino sem internet (academia com sinal ruim).
import type { createClient } from './supabase/client'
import type { AssignedWorkout, PrescribedExercise, Exercise } from './types'
import { friendlyError } from './errors'

type Supabase = ReturnType<typeof createClient>

export type BundleExercise = PrescribedExercise & {
  exercises: (Partial<Exercise> & { secondary_muscle?: string | null }) | null
}
export type StoredSet = {
  id?: string
  assigned_exercise_id: string | null
  set_number: number
  weight_kg: number | null
  reps: number | null
}
export type RecordSet = { exercise_id: string; weight_kg: number | null; reps: number | null }

export type WorkoutBundle = {
  workout: AssignedWorkout
  rows: BundleExercise[]
  // Último treino concluído deste mesmo treino (coluna "Anterior").
  previousSets: StoredSet[]
  // Séries de todos os treinos concluídos do aluno com estes exercícios (recordes).
  recordSets: RecordSet[]
  savedAt: number
}

export class OfflineError extends Error {}
export class NotFoundError extends Error {}

type Result = { data: unknown; error: { message: string } | null; status: number }

function check(result: Result) {
  if (result.status === 0) throw new OfflineError(result.error?.message ?? 'sem conexão')
  if (result.error) throw new Error(friendlyError(result.error), { cause: result.error })
  return result.data
}

export async function fetchWorkoutBundle(supabase: Supabase, userId: string, workoutId: string): Promise<WorkoutBundle> {
  const [workoutResult, exercisesResult, completedResult] = (await Promise.all([
    supabase.from('assigned_workouts').select('*').eq('id', workoutId).maybeSingle(),
    // exercises(*): traz o media_id (GIF) quando o supabase/exercicios.sql já rodou,
    // sem quebrar enquanto a coluna não existe. Vai junto na cópia offline.
    supabase.from('assigned_workout_exercises').select('*, exercises(*)').eq('assigned_workout_id', workoutId).order('order', { ascending: true }),
    // Últimos treinos concluídos do aluno: base do "anterior" e dos recordes.
    supabase
      .from('workout_sessions')
      .select('id, assigned_workout_id')
      .eq('student_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(100),
  ])) as Result[]

  const workout = check(workoutResult) as AssignedWorkout | null
  const rows = (check(exercisesResult) ?? []) as BundleExercise[]
  if (!workout) throw new NotFoundError('Treino não encontrado.')
  const completed = (check(completedResult) ?? []) as { id: string; assigned_workout_id: string }[]
  const lastCompleted = completed.find((session) => session.assigned_workout_id === workoutId) ?? null
  const exerciseIds = [...new Set(rows.map((row) => row.exercise_id))]

  const [previousResult, recordResult] = (await Promise.all([
    lastCompleted
      ? supabase
          .from('session_sets')
          .select('assigned_exercise_id, set_number, weight_kg, reps')
          .eq('session_id', lastCompleted.id)
          .eq('completed', true)
      : Promise.resolve({ data: [], error: null, status: 200 }),
    completed.length > 0 && exerciseIds.length > 0
      ? supabase
          .from('session_sets')
          .select('exercise_id, weight_kg, reps')
          .in(
            'session_id',
            completed.map((session) => session.id),
          )
          .in('exercise_id', exerciseIds)
          .eq('completed', true)
          .order('weight_kg', { ascending: false })
          .limit(1000)
      : Promise.resolve({ data: [], error: null, status: 200 }),
  ])) as Result[]

  return {
    workout,
    rows,
    previousSets: (check(previousResult) ?? []) as StoredSet[],
    recordSets: (check(recordResult) ?? []) as RecordSet[],
    savedAt: Date.now(),
  }
}

// Séries já gravadas da sessão em andamento (null = sessão não existe ou já foi concluída).
export async function fetchResumableSets(supabase: Supabase, userId: string, sessionId: string) {
  const sessionResult = (await supabase
    .from('workout_sessions')
    .select('id, status')
    .eq('id', sessionId)
    .eq('student_id', userId)
    .maybeSingle()) as Result
  const session = check(sessionResult) as { id: string; status: string } | null
  if (session?.status !== 'in_progress') return null
  const setsResult = (await supabase
    .from('session_sets')
    .select('id, assigned_exercise_id, set_number, weight_kg, reps')
    .eq('session_id', sessionId)
    .eq('completed', true)) as Result
  return (check(setsResult) ?? []) as StoredSet[]
}

const CACHE_PREFIX = 'team-jean:treino-salvo:'
const CACHE_LIMIT = 8
const cacheKey = (userId: string, workoutId: string) => `${CACHE_PREFIX}${userId}:${workoutId}`

export function readCachedBundle(userId: string, workoutId: string): WorkoutBundle | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(cacheKey(userId, workoutId)) ?? 'null') as WorkoutBundle | null
    return parsed && parsed.workout && Array.isArray(parsed.rows) ? parsed : null
  } catch {
    return null
  }
}

export function saveCachedBundle(userId: string, workoutId: string, bundle: WorkoutBundle) {
  try {
    window.localStorage.setItem(cacheKey(userId, workoutId), JSON.stringify(bundle))
    // Guarda só os treinos abertos mais recentemente.
    const keys = Object.keys(window.localStorage).filter((key) => key.startsWith(CACHE_PREFIX))
    if (keys.length > CACHE_LIMIT) {
      const byAge = keys
        .map((key) => ({ key, savedAt: Number((JSON.parse(window.localStorage.getItem(key) ?? '{}') as { savedAt?: number }).savedAt) || 0 }))
        .sort((first, second) => first.savedAt - second.savedAt)
      byAge.slice(0, keys.length - CACHE_LIMIT).forEach(({ key }) => window.localStorage.removeItem(key))
    }
  } catch {
    // Sem espaço ou sem armazenamento: o treino só não abre offline.
  }
}

// Pede ao service worker para guardar a página (abre sem internet depois).
export function cacheCurrentPage() {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: 'cache-page', url: window.location.pathname })
  } catch {
    // Sem service worker: só não abre offline.
  }
}
