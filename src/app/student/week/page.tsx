'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { m } from 'framer-motion'
import { ArrowUpRight, Dumbbell } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import type { AssignedWorkout } from '@/lib/types'
import { pickNextWorkout } from '@/lib/workouts'
import { readActiveSession } from '@/lib/active-session'
import { relativeDay } from '@/lib/stats'
import { cn } from '@/lib/cn'
import { MISSING_SESSION, friendlyError } from '@/lib/errors'
import { Alert } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Eyebrow, Stagger, tileVariants } from '@/components/ui/tile'
import { WeeklyTrainingInsights } from '@/components/workout/WeeklyTrainingInsights'

type RoutineWorkout = AssignedWorkout & {
  exerciseCount: number
  muscles: string[]
  lastDoneAt: string | null
  inProgress: boolean
}

export default function StudentWeekPage() {
  const [supabase] = useState(() => createClient())
  const [workouts, setWorkouts] = useState<RoutineWorkout[] | null>(null)
  const [nextWorkoutId, setNextWorkoutId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true

    const load = async () => {
      const user = await getCurrentUser(supabase)
      if (!active) return
      if (!user) {
        setLoadError(friendlyError(MISSING_SESSION, 'Não foi possível carregar sua rotina'))
        return
      }

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
        // Mantém o que já estava na tela (sem fingir que não há treinos).
        setLoadError(friendlyError(error, 'Não foi possível carregar sua rotina'))
        return
      }

      const workoutRows = (workoutsResult.data ?? []) as AssignedWorkout[]
      const exercisesByWorkout = new Map<string, { count: number; muscles: Set<string> }>()
      if (workoutRows.length > 0) {
        const { data: exerciseRows } = await supabase
          .from('assigned_workout_exercises')
          .select('assigned_workout_id, exercises(muscle_group)')
          .in(
            'assigned_workout_id',
            workoutRows.map((workout) => workout.id),
          )
        if (!active) return
        for (const row of (exerciseRows ?? []) as unknown as {
          assigned_workout_id: string
          exercises: { muscle_group: string | null } | null
        }[]) {
          const entry = exercisesByWorkout.get(row.assigned_workout_id) ?? { count: 0, muscles: new Set<string>() }
          entry.count += 1
          if (row.exercises?.muscle_group) entry.muscles.add(row.exercises.muscle_group)
          exercisesByWorkout.set(row.assigned_workout_id, entry)
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
        exerciseCount: exercisesByWorkout.get(workout.id)?.count ?? 0,
        muscles: [...(exercisesByWorkout.get(workout.id)?.muscles ?? [])],
        lastDoneAt: lastDone.get(workout.id) ?? null,
        inProgress: workout.id === inProgressId,
      }))
      setLoadError('')
      setWorkouts(rows)
      setNextWorkoutId(pickNextWorkout(rows, lastDone, inProgressId)?.id ?? null)
    }

    void load()
    return () => {
      active = false
    }
  }, [supabase, attempt])

  const retry = () => {
    setLoadError('')
    setAttempt((value) => value + 1)
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="routine-title">
        <div className="px-1">
          <Eyebrow>Rotina ativa</Eyebrow>
          <h1 id="routine-title" className="mt-1 font-display text-[2.75rem] font-bold uppercase leading-[0.9]">
            Seus treinos
          </h1>
          <p className="mt-2 text-sm text-zinc-400">Siga a ordem: o próximo da rotina fica em destaque.</p>
        </div>

        {loadError && (
          <Alert variant="error" onRetry={retry}>
            {loadError}
          </Alert>
        )}

        {workouts === null ? (
          loadError ? null : (
            <div className="space-y-3" role="status" aria-label="Carregando rotina">
              <Skeleton className="h-28 rounded-3xl" />
              <Skeleton className="h-28 rounded-3xl" />
            </div>
          )
        ) : workouts.length === 0 ? (
          <div className="space-y-3 rounded-3xl border border-line bg-surface p-8 text-center">
            <Dumbbell className="mx-auto h-10 w-10 text-zinc-700" aria-hidden="true" />
            <h2 className="font-display text-2xl font-bold uppercase text-zinc-300">Sem treinos ativos</h2>
            <p className="text-xs text-zinc-500">Seu treinador ainda não liberou a rotina.</p>
          </div>
        ) : (
          <Stagger className="space-y-3">
            {workouts.map((workout, index) => {
              const isNext = workout.id === nextWorkoutId
              const letter = index < 26 ? String.fromCharCode(65 + index) : String(index + 1)
              return (
                <m.div key={workout.id} variants={tileVariants}>
                  <Link
                    href={`/student/workout/${workout.id}`}
                    className={cn(
                      'group relative flex items-center gap-4 overflow-hidden rounded-3xl border bg-surface p-4 transition active:scale-[0.99]',
                      isNext ? 'glow-brand border-brand/35' : 'border-line hover:border-line-strong',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-16 w-16 shrink-0 place-items-center rounded-2xl font-display text-4xl font-bold',
                        isNext ? 'bg-brand text-black' : 'bg-white/[0.06] text-zinc-300',
                      )}
                      aria-hidden="true"
                    >
                      {letter}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        {isNext && (
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-black uppercase tracking-wider',
                              workout.inProgress ? 'bg-gold text-black' : 'bg-brand text-black',
                            )}
                          >
                            {workout.inProgress ? 'Em andamento' : 'Próximo'}
                          </span>
                        )}
                        <span className="text-xs font-semibold text-zinc-500">
                          {workout.lastDoneAt ? `Feito ${relativeDay(new Date(workout.lastDoneAt))}` : 'Ainda não feito'}
                        </span>
                      </span>
                      <span className="mt-1 block font-display text-2xl font-bold uppercase leading-[0.95] text-white">
                        {workout.name}
                      </span>
                      <span className="mt-1.5 block truncate text-xs text-zinc-500">
                        {workout.exerciseCount} {workout.exerciseCount === 1 ? 'exercício' : 'exercícios'}
                        {workout.muscles.length > 0 && ` · ${workout.muscles.slice(0, 3).join(', ')}`}
                      </span>
                    </span>
                    <ArrowUpRight
                      className="h-5 w-5 shrink-0 text-zinc-600 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
                      aria-hidden="true"
                    />
                  </Link>
                </m.div>
              )
            })}
          </Stagger>
        )}
      </section>

      <WeeklyTrainingInsights mode="student" />
    </div>
  )
}
