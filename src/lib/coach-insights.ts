// Radar do treinador: recordes recentes, cargas prontas para subir e sinais de
// cansaço, tudo calculado a partir dos treinos já registrados (sem SQL novo).
import type { createClient } from './supabase/client'
import type { PlannedSet, Profile } from './types'
import { REGION_LABELS, loadFill, regionsForExercise, splitSecondary, type MuscleRegion } from './muscles'
import { PREP_SET_TYPES, getPlannedSets } from './workouts'

type Supabase = ReturnType<typeof createClient>

const DAY = 86_400_000
const HISTORY_DAYS = 60
const RECENT_DAYS = 7
const LOWER_BODY: MuscleRegion[] = ['quads', 'hamstrings', 'glutes', 'calves']

type SessionRow = { id: string; student_id: string; completed_at: string; session_rpe: number | null }
type SetRow = {
  session_id: string
  exercise_id: string
  assigned_exercise_id?: string | null
  weight_kg: number | null
  reps: number | null
  set_type?: string | null
}
type ExerciseRow = { id: string; name: string; muscle_group: string | null; secondary_muscle?: string | null }
type PrescriptionRow = {
  id: string
  assigned_workout_id: string
  exercise_id: string
  target_reps: string | null
  sets_count: number | null
  planned_sets: PlannedSet[] | null
}

export type RadarRecord = {
  key: string
  studentId: string
  studentName: string
  exercise: string
  weight: number
  reps: number
  previous: number
  date: Date
}
export type RadarProgression = {
  key: string
  studentId: string
  studentName: string
  exercise: string
  weight: number
  reps: number
  sets: number
  next: number
  // Prescrições do exercício nos treinos ativos do aluno (onde a carga é aplicada).
  prescriptions: PrescriptionRow[]
}
export type RadarAlert = { key: string; studentId: string; studentName: string; rpe: number[] }
export type Radar = { records: RadarRecord[]; progressions: RadarProgression[]; alerts: RadarAlert[] }

// .in() com muitos ids estoura o tamanho da URL: busca em lotes.
async function inChunks<T>(
  ids: string[],
  size: number,
  run: (chunk: string[]) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const chunks: string[][] = []
  for (let index = 0; index < ids.length; index += size) chunks.push(ids.slice(index, index + size))
  const results = await Promise.all(chunks.map((chunk) => run(chunk)))
  const rows: T[] = []
  for (const { data, error } of results) {
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as T[]))
  }
  return rows
}

// "8-10" → 10, "12" → 12, "Até a falha" → null.
export function topReps(target: string | null | undefined) {
  const numbers = String(target ?? '')
    .match(/\d+/g)
    ?.map(Number)
    .filter((value) => value > 0 && value < 100)
  return numbers && numbers.length > 0 ? Math.max(...numbers) : null
}

// Próxima carga: +2,5 kg em cima, +5 kg nas pernas (pesos leves sobem 1 kg).
export function nextLoad(weight: number, lowerBody: boolean) {
  if (weight < 10) return weight + 1
  if (lowerBody && weight >= 40) return weight + 5
  return weight + 2.5
}

const firstName = (student: Pick<Profile, 'full_name' | 'email'> | undefined) =>
  student?.full_name?.trim().split(' ')[0] || student?.email?.split('@')[0] || 'Aluno'

export async function loadRadar(supabase: Supabase, students: Pick<Profile, 'id' | 'full_name' | 'email'>[], now = new Date()): Promise<Radar> {
  const since = new Date(now.getTime() - HISTORY_DAYS * DAY)
  const [sessionsResult, workoutsResult] = await Promise.all([
    supabase
      .from('workout_sessions')
      .select('id, student_id, completed_at, session_rpe')
      .eq('status', 'completed')
      .gte('completed_at', since.toISOString())
      .order('completed_at', { ascending: false })
      .limit(400),
    supabase.from('assigned_workouts').select('id, student_id').eq('is_current', true),
  ])
  if (sessionsResult.error) throw new Error(sessionsResult.error.message)
  if (workoutsResult.error) throw new Error(workoutsResult.error.message)

  const sessions = ((sessionsResult.data ?? []) as SessionRow[]).filter((session) => session.completed_at)
  const workouts = (workoutsResult.data ?? []) as { id: string; student_id: string }[]
  const [sets, prescriptions] = await Promise.all([
    inChunks<SetRow>(
      sessions.map((session) => session.id),
      40,
      (chunk) =>
        supabase
          .from('session_sets')
          .select('session_id, exercise_id, assigned_exercise_id, weight_kg, reps, set_type')
          .in('session_id', chunk)
          .eq('completed', true),
    ),
    inChunks<PrescriptionRow>(
      workouts.map((workout) => workout.id),
      40,
      (chunk) =>
        supabase
          .from('assigned_workout_exercises')
          .select('id, assigned_workout_id, exercise_id, target_reps, sets_count, planned_sets')
          .in('assigned_workout_id', chunk),
    ),
  ])
  const exerciseIds = [...new Set([...sets.map((set) => set.exercise_id), ...prescriptions.map((row) => row.exercise_id)])].filter(Boolean)
  // select('*'): secondary_muscle pode não existir.
  const exercises = await inChunks<ExerciseRow>(exerciseIds, 60, (chunk) => supabase.from('exercises').select('*').in('id', chunk))

  const studentById = new Map(students.map((student) => [student.id, student]))
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const recentLimit = now.getTime() - RECENT_DAYS * DAY

  // ---- recordes: maior carga da semana acima do melhor dos 60 dias anteriores
  const recentBest = new Map<string, { weight: number; reps: number; date: Date }>()
  const previousBest = new Map<string, number>()
  for (const set of sets) {
    const session = sessionById.get(set.session_id)
    const weight = Number(set.weight_kg) || 0
    const reps = Number(set.reps) || 0
    if (!session || weight <= 0 || reps <= 0 || set.set_type === 'warmup') continue
    const key = `${session.student_id}|${set.exercise_id}`
    const date = new Date(session.completed_at)
    if (date.getTime() >= recentLimit) {
      const current = recentBest.get(key)
      if (!current || weight > current.weight || (weight === current.weight && reps > current.reps)) recentBest.set(key, { weight, reps, date })
    } else {
      previousBest.set(key, Math.max(previousBest.get(key) ?? 0, weight))
    }
  }
  const records: RadarRecord[] = []
  for (const [key, best] of recentBest) {
    const previous = previousBest.get(key)
    if (!previous || best.weight <= previous) continue
    const [studentId, exerciseId] = key.split('|')
    if (!studentById.has(studentId)) continue
    records.push({
      key: `pr|${key}|${best.weight}x${best.reps}`,
      studentId,
      studentName: firstName(studentById.get(studentId)),
      exercise: exerciseById.get(exerciseId)?.name ?? 'Exercício',
      weight: best.weight,
      reps: best.reps,
      previous,
      date: best.date,
    })
  }
  records.sort((a, b) => b.date.getTime() - a.date.getTime())

  // ---- progressão dupla: todas as séries no topo da faixa com a mesma carga
  const studentOfWorkout = new Map(workouts.map((workout) => [workout.id, workout.student_id]))
  const sessionsByStudent = new Map<string, SessionRow[]>()
  for (const session of sessions) {
    const list = sessionsByStudent.get(session.student_id) ?? []
    list.push(session)
    sessionsByStudent.set(session.student_id, list)
  }
  const setsBySession = new Map<string, SetRow[]>()
  for (const set of sets) {
    const list = setsBySession.get(set.session_id) ?? []
    list.push(set)
    setsBySession.set(set.session_id, list)
  }
  const progressions: RadarProgression[] = []
  const seen = new Set<string>()
  for (const prescription of prescriptions) {
    const studentId = studentOfWorkout.get(prescription.assigned_workout_id)
    const top = topReps(prescription.target_reps)
    if (!studentId || !top || !studentById.has(studentId)) continue
    const key = `${studentId}|${prescription.exercise_id}`
    if (seen.has(key)) continue
    // Sessão mais recente (já ordenadas) com séries deste exercício.
    const working = (sessionsByStudent.get(studentId) ?? [])
      .map((session) =>
        (setsBySession.get(session.id) ?? []).filter(
          (set) =>
            (set.exercise_id === prescription.exercise_id || set.assigned_exercise_id === prescription.id) && set.set_type !== 'warmup',
        ),
      )
      .find((list) => list.length > 0)
    if (!working || working.length < 2) continue
    const weight = Math.max(...working.map((set) => Number(set.weight_kg) || 0))
    if (weight <= 0) continue
    if (!working.every((set) => (Number(set.weight_kg) || 0) === weight && (Number(set.reps) || 0) >= top)) continue
    seen.add(key)
    const exercise = exerciseById.get(prescription.exercise_id)
    const primary = regionsForExercise(exercise?.name, exercise?.muscle_group)[0]?.[0]
    progressions.push({
      key: `up|${key}|${weight}`,
      studentId,
      studentName: firstName(studentById.get(studentId)),
      exercise: exercise?.name ?? 'Exercício',
      weight,
      reps: Math.min(...working.map((set) => Number(set.reps) || 0)),
      sets: working.length,
      next: nextLoad(weight, primary !== undefined && LOWER_BODY.includes(primary)),
      prescriptions: prescriptions.filter(
        (row) => row.exercise_id === prescription.exercise_id && studentOfWorkout.get(row.assigned_workout_id) === studentId,
      ),
    })
  }

  // ---- cansaço: RPE 9+ nos últimos 3 treinos
  const alerts: RadarAlert[] = []
  for (const [studentId, list] of sessionsByStudent) {
    const rated = list.filter((session) => session.session_rpe !== null && session.session_rpe !== undefined).slice(0, 3)
    if (rated.length < 3 || !rated.every((session) => Number(session.session_rpe) >= 9) || !studentById.has(studentId)) continue
    alerts.push({
      key: `rpe|${studentId}|${rated[0].id}`,
      studentId,
      studentName: firstName(studentById.get(studentId)),
      rpe: rated.map((session) => Number(session.session_rpe)),
    })
  }

  return { records, progressions, alerts }
}

// Grava a nova carga-alvo nas séries de trabalho (não mexe em aquecimento e
// feeder) de cada prescrição do exercício. Devolve quantas foram atualizadas.
export async function applyProgression(supabase: Supabase, progression: Pick<RadarProgression, 'prescriptions' | 'next'>) {
  let updated = 0
  for (const prescription of progression.prescriptions) {
    const planned = getPlannedSets(prescription)
    if (planned.length === 0) continue
    const hasWork = planned.some((set) => !PREP_SET_TYPES.has(set.type))
    const next = planned.map((set) => (!hasWork || !PREP_SET_TYPES.has(set.type) ? { ...set, weight: progression.next } : set))
    const { data, error } = await supabase
      .from('assigned_workout_exercises')
      .update({ planned_sets: next, sets_count: next.length })
      .eq('id', prescription.id)
      .select('id')
    if (error) throw new Error(error.message)
    updated += data?.length ?? 0
  }
  return updated
}

// ------------------------------------------------------- carga da semana
export type MuscleWeek = {
  fills: Partial<Record<MuscleRegion, string>>
  details: Partial<Record<MuscleRegion, string>>
  sessions: number
  sets: number
  // Grupos grandes sem estímulo há 10 dias ou mais.
  neglected: MuscleRegion[]
}

const MAJOR: MuscleRegion[] = ['chest', 'lats', 'shoulders', 'quads', 'hamstrings', 'glutes']

export async function loadMuscleWeek(supabase: Supabase, studentId: string, now = new Date()): Promise<MuscleWeek> {
  const since = new Date(now.getTime() - 14 * DAY)
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, student_id, completed_at, session_rpe')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .gte('completed_at', since.toISOString())
    .order('completed_at', { ascending: false })
    .limit(60)
  if (error) throw new Error(error.message)
  const sessions = ((data ?? []) as SessionRow[]).filter((session) => session.completed_at)
  const sets = await inChunks<SetRow>(
    sessions.map((session) => session.id),
    40,
    (chunk) => supabase.from('session_sets').select('session_id, exercise_id, weight_kg, reps, set_type').in('session_id', chunk).eq('completed', true),
  )
  const exercises = await inChunks<ExerciseRow>(
    [...new Set(sets.map((set) => set.exercise_id))].filter(Boolean),
    60,
    (chunk) => supabase.from('exercises').select('*').in('id', chunk),
  )
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const weekStart = now.getTime() - RECENT_DAYS * DAY

  const weekly: Partial<Record<MuscleRegion, number>> = {}
  const lastHit: Partial<Record<MuscleRegion, number>> = {}
  let weekSets = 0
  const weekSessions = new Set<string>()
  for (const set of sets) {
    const session = sessionById.get(set.session_id)
    const exercise = exerciseById.get(set.exercise_id)
    if (!session || !exercise || set.set_type === 'warmup') continue
    const time = new Date(session.completed_at).getTime()
    const work: [MuscleRegion, number][] = [
      ...regionsForExercise(exercise.name, exercise.muscle_group),
      ...splitSecondary(exercise.secondary_muscle).flatMap((muscle) =>
        regionsForExercise(null, muscle).map(([region, factor]): [MuscleRegion, number] => [region, factor * 0.5]),
      ),
    ]
    for (const [region, factor] of work) {
      lastHit[region] = Math.max(lastHit[region] ?? 0, time)
      if (time >= weekStart) weekly[region] = (weekly[region] ?? 0) + factor
    }
    if (time >= weekStart) {
      weekSets++
      weekSessions.add(session.id)
    }
  }

  const max = Math.max(0, ...Object.values(weekly))
  const fills: MuscleWeek['fills'] = {}
  const details: MuscleWeek['details'] = {}
  for (const [region, value] of Object.entries(weekly) as [MuscleRegion, number][]) {
    if (value <= 0) continue
    fills[region] = loadFill(max > 0 ? value / max : 0)
    const rounded = Math.round(value * 10) / 10
    details[region] = `${String(rounded).replace('.', ',')} ${rounded === 1 ? 'série' : 'séries'}`
  }
  const neglected = MAJOR.filter((region) => !lastHit[region] || now.getTime() - (lastHit[region] as number) >= 10 * DAY)

  return { fills, details, sessions: weekSessions.size, sets: weekSets, neglected }
}

export const regionList = (regions: MuscleRegion[]) => regions.map((region) => REGION_LABELS[region]).join(', ')
