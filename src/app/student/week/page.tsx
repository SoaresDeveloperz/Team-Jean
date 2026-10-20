'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Dumbbell } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import type { AssignedWorkout } from '@/lib/types'
import { pickNextWorkout } from '@/lib/workouts'
import { readActiveSession } from '@/lib/active-session'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { PageLoader } from '@/components/ui/page-loader'
import { WeeklyTrainingInsights } from '@/components/workout/WeeklyTrainingInsights'

type RoutineWorkout = AssignedWorkout & {
  exerciseCount: number
  lastDoneAt: string | null
  inProgress: boolean
}

export default function StudentWeekPage() {
  const [supabase] = useState(() => createClient())
  const [workouts, setWorkouts] = useState<RoutineWorkout[] | null>(null)
  const [nextWorkoutId, setNextWorkoutId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true

    const load = async () => {
      const user = await getCurrentUser(supabase)
      if (!active || !user) return

      const [workoutsResult, sessionsResult] = await Promise.all([
        supabase
          .from('assigned_workouts')
          .select('*')
          .eq('student_id', user.id)
          .eq('is_current', true)
          .order('name', { ascending: true }),
        supabase
          .from('workout_sessions')
          .select('assigned_workout_id, completed_at')
          .eq('student_id', user.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(60),
      ])
      if (!active) return

      const error = workoutsResult.error ?? sessionsResult.error
      if (error) {
        setLoadError(`Não foi possível carregar sua rotina: ${error.message}`)
        setWorkouts([])
        return
      }

      const workoutRows = (workoutsResult.data ?? []) as AssignedWorkout[]
      const exerciseCounts = new Map<string, number>()
      if (workoutRows.length > 0) {
        const { data: exerciseRows } = await supabase
          .from('assigned_workout_exercises')
          .select('assigned_workout_id')
          .in(
            'assigned_workout_id',
            workoutRows.map((workout) => workout.id),
          )
        if (!active) return
        for (const row of (exerciseRows ?? []) as { assigned_workout_id: string }[]) {
          exerciseCounts.set(row.assigned_workout_id, (exerciseCounts.get(row.assigned_workout_id) ?? 0) + 1)
        }
      }

      const lastDone = new Map<string, string>()
      for (const session of (sessionsResult.data ?? []) as { assigned_workout_id: string; completed_at: string | null }[]) {
        if (session.completed_at && !lastDone.has(session.assigned_workout_id)) {
          lastDone.set(session.assigned_workout_id, session.completed_at)
        }
      }
      const inProgressId = readActiveSession(user.id)?.workoutId ?? null

      const rows = workoutRows.map((workout) => ({
        ...workout,
        exerciseCount: exerciseCounts.get(workout.id) ?? 0,
        lastDoneAt: lastDone.get(workout.id) ?? null,
        inProgress: workout.id === inProgressId,
      }))
      setWorkouts(rows)
      setNextWorkoutId(pickNextWorkout(rows, lastDone, inProgressId)?.id ?? null)
    }

    void load()
    return () => {
      active = false
    }
  }, [supabase])

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-wide text-white">Rotina</h1>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-zinc-500">Seus treinos ativos</p>
        </div>

        {loadError && <Alert variant="error">{loadError}</Alert>}

        {workouts === null ? (
          <PageLoader label="Carregando rotina" />
        ) : workouts.length === 0 ? (
          <div className="space-y-4 rounded-3xl border border-zinc-900 bg-zinc-950 p-8 text-center">
            <Dumbbell className="mx-auto h-10 w-10 text-zinc-700" aria-hidden="true" />
            <h2 className="text-sm font-black uppercase text-zinc-400">Sem treinos ativos</h2>
          </div>
        ) : (
          <ul className="space-y-3">
            {workouts.map((workout, index) => {
              const isNext = workout.id === nextWorkoutId
              return (
                <li key={workout.id}>
                  <Link
                    href={`/student/workout/${workout.id}`}
                    className={cn(
                      'group flex items-center justify-between gap-3 rounded-3xl border bg-zinc-950 p-5 transition-all active:scale-[0.98]',
                      isNext ? 'border-emerald-800/60' : 'border-zinc-900 hover:border-zinc-700',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div
                        className={cn(
                          'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-lg font-black transition-colors',
                          isNext
                            ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-400'
                            : 'border-zinc-800 bg-zinc-900 text-zinc-500 group-hover:text-white',
                        )}
                        aria-hidden="true"
                      >
                        {index < 26 ? String.fromCharCode(65 + index) : index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-base font-black text-white">{workout.name}</h2>
                          {isNext && (
                            <span className="shrink-0 rounded-md bg-emerald-500 px-1.5 py-0.5 text-[8px] font-black uppercase text-black">
                              {workout.inProgress ? 'Em andamento' : 'Próximo'}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          {workout.exerciseCount} exercícios ·{' '}
                          {workout.lastDoneAt
                            ? `feito em ${new Date(workout.lastDoneAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
                            : 'ainda não feito'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 shrink-0 text-zinc-600 transition-colors group-hover:text-white" aria-hidden="true" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="rounded-3xl border border-zinc-900 bg-zinc-950/60 p-5">
        <WeeklyTrainingInsights mode="student" />
      </div>
    </div>
  )
}
