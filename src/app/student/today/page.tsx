'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Activity, CalendarDays, ChevronRight, Clock, Dumbbell, Flame, Play, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { AssignedWorkout, PrescribedExercise } from '@/lib/types'
import { getSetsCount } from '@/lib/workouts'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { PageLoader } from '@/components/ui/page-loader'

type ExerciseRow = PrescribedExercise & { exercises: { name: string | null; muscle_group: string | null } | null }

type TodayData = {
  firstName: string
  completedThisMonth: number
  workout: AssignedWorkout | null
  inProgress: boolean
  lastDoneAt: string | null
  exercises: ExerciseRow[]
  activeWorkoutsCount: number
}

const READINESS_SAVE_DELAY_MS = 700
// Estimativa: execução + descanso médio por série.
const MINUTES_PER_SET = 2.5

function getReadinessColor(value: number) {
  if (value >= 80) return 'text-emerald-400'
  if (value >= 50) return 'text-amber-400'
  return 'text-rose-400'
}

// Escolhe o próximo treino da rotação: um em andamento; senão, o que nunca foi
// feito (em ordem de nome: A, B, C...); senão, o feito há mais tempo.
function pickNextWorkout(
  workouts: AssignedWorkout[],
  lastDoneByWorkout: Map<string, string>,
  inProgressWorkoutId: string | null,
) {
  const inProgress = workouts.find((workout) => workout.id === inProgressWorkoutId)
  if (inProgress) return inProgress

  return [...workouts].sort((first, second) => {
    const firstDone = lastDoneByWorkout.get(first.id) ?? ''
    const secondDone = lastDoneByWorkout.get(second.id) ?? ''
    if (firstDone !== secondDone) return firstDone.localeCompare(secondDone)
    return first.name.localeCompare(second.name, 'pt-BR', { numeric: true })
  })[0]
}

export default function StudentTodayPage() {
  const [supabase] = useState(() => createClient())
  const [data, setData] = useState<TodayData | null>(null)
  const [loadError, setLoadError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [readiness, setReadiness] = useState(80)
  const [readinessStatus, setReadinessStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimer = useRef<number | null>(null)
  const saveRequest = useRef(0)

  useEffect(() => {
    let active = true

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active || !user) return
      setUserId(user.id)

      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const [profileResult, monthResult, workoutsResult, sessionsResult] = await Promise.all([
        supabase.from('profiles').select('full_name, readiness_score').eq('id', user.id).maybeSingle(),
        supabase
          .from('workout_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', user.id)
          .eq('status', 'completed')
          .gte('completed_at', startOfMonth.toISOString()),
        supabase
          .from('assigned_workouts')
          .select('*')
          .eq('student_id', user.id)
          .eq('is_current', true)
          .order('name', { ascending: true }),
        supabase
          .from('workout_sessions')
          .select('assigned_workout_id, status, created_at, completed_at')
          .eq('student_id', user.id)
          .order('created_at', { ascending: false })
          .limit(60),
      ])
      if (!active) return

      const error = profileResult.error ?? workoutsResult.error ?? sessionsResult.error
      if (error) {
        setLoadError(`Não foi possível carregar seu treino: ${error.message}`)
        return
      }

      const workouts = (workoutsResult.data ?? []) as AssignedWorkout[]
      const sessions = (sessionsResult.data ?? []) as {
        assigned_workout_id: string
        status: string
        created_at: string
        completed_at: string | null
      }[]

      const lastDoneByWorkout = new Map<string, string>()
      for (const session of sessions) {
        if (session.status === 'completed' && session.completed_at && !lastDoneByWorkout.has(session.assigned_workout_id)) {
          lastDoneByWorkout.set(session.assigned_workout_id, session.completed_at)
        }
      }
      const resumeLimit = Date.now() - 12 * 3_600_000
      const inProgressWorkoutId =
        sessions.find((session) => session.status === 'in_progress' && new Date(session.created_at).getTime() > resumeLimit)
          ?.assigned_workout_id ?? null

      const workout = workouts.length > 0 ? pickNextWorkout(workouts, lastDoneByWorkout, inProgressWorkoutId) : null

      let exercises: ExerciseRow[] = []
      if (workout) {
        const { data: exerciseRows } = await supabase
          .from('assigned_workout_exercises')
          .select('*, exercises(name, muscle_group)')
          .eq('assigned_workout_id', workout.id)
          .order('order', { ascending: true })
        if (!active) return
        exercises = (exerciseRows ?? []) as ExerciseRow[]
      }

      const profile = profileResult.data as { full_name: string | null; readiness_score: number | null } | null
      if (typeof profile?.readiness_score === 'number') setReadiness(profile.readiness_score)

      setData({
        firstName: profile?.full_name?.trim().split(' ')[0] || 'Atleta',
        completedThisMonth: monthResult.count ?? 0,
        workout,
        inProgress: workout !== null && workout.id === inProgressWorkoutId,
        lastDoneAt: workout ? (lastDoneByWorkout.get(workout.id) ?? null) : null,
        exercises,
        activeWorkoutsCount: workouts.length,
      })
    }

    void load()
    return () => {
      active = false
    }
  }, [supabase])

  useEffect(
    () => () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
    },
    [],
  )

  // Salva só depois que o aluno para de arrastar (antes era um UPDATE a cada
  // movimento do slider, com respostas podendo chegar fora de ordem).
  const handleReadinessChange = (value: number) => {
    setReadiness(value)
    if (!userId) return
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)

    saveTimer.current = window.setTimeout(async () => {
      const requestId = ++saveRequest.current
      setReadinessStatus('saving')
      const { error } = await supabase
        .from('profiles')
        .update({ readiness_score: value, readiness_updated_at: new Date().toISOString() })
        .eq('id', userId)
      if (requestId === saveRequest.current) setReadinessStatus(error ? 'error' : 'saved')
    }, READINESS_SAVE_DELAY_MS)
  }

  if (loadError) return <Alert variant="error">{loadError}</Alert>
  if (!data) return <PageLoader label="Carregando seu dia" />

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })
  const totalSets = data.exercises.reduce((total, item) => total + getSetsCount(item), 0)
  const estimatedMinutes = Math.max(10, Math.round((totalSets * MINUTES_PER_SET) / 5) * 5)
  const muscles = [
    ...new Set(data.exercises.map((item) => item.exercises?.muscle_group).filter((muscle): muscle is string => Boolean(muscle))),
  ]

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0 space-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">{today}</p>
          <h1 className="truncate text-3xl font-black tracking-tight text-white">Fala, {data.firstName}!</h1>
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/80 px-3 py-1.5 backdrop-blur-md">
          <Flame className="h-5 w-5 fill-amber-500/20 text-amber-500" aria-hidden="true" />
          <div className="flex flex-col items-end leading-none">
            <span className="text-sm font-black text-white">{data.completedThisMonth}</span>
            <span className="mt-0.5 text-[7px] font-black uppercase tracking-widest text-zinc-500">Treinos no mês</span>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-3xl border border-zinc-900 bg-[#0c0c0c] p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('rounded-lg bg-zinc-900/50 p-1.5', getReadinessColor(readiness))}>
              <Activity className="h-4 w-4" aria-hidden="true" />
            </div>
            <label htmlFor="readiness" className="text-xs font-extrabold uppercase tracking-widest text-zinc-400">
              Prontidão
            </label>
          </div>
          <div className="text-right">
            <span className={cn('text-xl font-black', getReadinessColor(readiness))}>{readiness}%</span>
            <span className="block h-3 text-[9px] font-bold text-zinc-600" aria-live="polite">
              {readinessStatus === 'saving' && 'Salvando...'}
              {readinessStatus === 'saved' && 'Salvo'}
              {readinessStatus === 'error' && <span className="text-rose-400">Erro ao salvar</span>}
            </span>
          </div>
        </div>

        <div className="relative pt-1">
          <input
            id="readiness"
            type="range"
            min={10}
            max={100}
            step={10}
            value={readiness}
            onChange={(event) => handleReadinessChange(Number(event.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-white"
          />
          <div className="mt-2 flex justify-between px-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">Fadigado</span>
            <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">Recuperado</span>
          </div>
        </div>
      </div>

      {!data.workout ? (
        <div className="space-y-3 rounded-3xl border border-zinc-900 bg-[#0c0c0c] p-10 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900">
            <Dumbbell className="h-5 w-5 text-zinc-500" aria-hidden="true" />
          </div>
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">Dia de descanso</h2>
          <p className="text-xs text-zinc-600">Quando o treinador liberar um treino, ele aparece aqui.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-[2rem] border border-zinc-800/60 bg-zinc-950 p-6 shadow-2xl">
            <div className="absolute inset-0 z-0 bg-gradient-to-br from-zinc-900/80 via-black to-black" aria-hidden="true" />
            <div className="absolute -right-24 -top-24 z-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-[80px]" aria-hidden="true" />

            <div className="relative z-10 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-emerald-900/50 bg-emerald-950/30 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400">
                    {data.inProgress ? 'Em andamento' : 'Próximo treino'}
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-zinc-900/50 px-2 py-1 text-[10px] font-bold text-zinc-400 backdrop-blur-sm">
                    <Clock className="h-3 w-3" aria-hidden="true" /> ~{estimatedMinutes} min
                  </span>
                </div>

                <div className="pt-2">
                  <h2 className="text-3xl font-black uppercase leading-none tracking-tight text-white">{data.workout.name}</h2>
                  <p className="mt-2 text-[10px] font-semibold text-zinc-500">
                    {data.lastDoneAt
                      ? `Feito pela última vez em ${new Date(data.lastDoneAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
                      : 'Você ainda não fez este treino'}
                  </p>

                  {muscles.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {muscles.slice(0, 4).map((muscle) => (
                        <span
                          key={muscle}
                          className="rounded-md bg-zinc-800/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-zinc-300"
                        >
                          {muscle}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Link
                href={`/student/workout/${data.workout.id}`}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-sm font-black uppercase tracking-[0.2em] text-black shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all hover:bg-zinc-200 active:scale-[0.98]"
              >
                {data.inProgress ? (
                  <>
                    <RotateCcw className="h-5 w-5" aria-hidden="true" /> Continuar
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 fill-black" aria-hidden="true" /> Começar
                  </>
                )}
              </Link>
            </div>
          </div>

          <div className="pt-2">
            <div className="mb-3 flex items-center justify-between px-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Resumo da sessão</span>
              <span className="text-[10px] font-bold text-zinc-600">
                {data.exercises.length} exercícios · {totalSets} séries
              </span>
            </div>

            <ol className="space-y-1.5">
              {data.exercises.map((item, index) => {
                const setsCount = getSetsCount(item)
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-4 rounded-2xl border border-zinc-900/80 bg-[#0c0c0c] p-3.5"
                  >
                    <span className="w-3 text-right text-[10px] font-black text-zinc-600">{index + 1}</span>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800/50 bg-zinc-900/80">
                      <Dumbbell className="h-4 w-4 text-zinc-400" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-xs font-extrabold leading-tight text-zinc-200">
                        {item.exercises?.name ?? 'Exercício'}
                      </h3>
                      <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-zinc-500">
                        {setsCount} {setsCount === 1 ? 'série' : 'séries'}
                        {item.exercises?.muscle_group ? ` · ${item.exercises.muscle_group}` : ''}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>

          {data.activeWorkoutsCount > 1 && (
            <Link
              href="/student/week"
              className="flex items-center justify-between rounded-2xl border border-zinc-900 bg-zinc-950 p-4 text-xs font-bold text-zinc-300 transition hover:border-zinc-700"
            >
              <span className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                Ver os {data.activeWorkoutsCount} treinos da sua rotina
              </span>
              <ChevronRight className="h-4 w-4 text-zinc-600" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
