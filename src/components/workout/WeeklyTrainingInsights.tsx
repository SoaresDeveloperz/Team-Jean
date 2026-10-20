'use client'

import { useEffect, useState } from 'react'
import { Activity, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Dumbbell } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'

type WeeklyTrainingInsightsProps = {
  mode: 'student' | 'admin'
}

type StudentProfile = {
  id: string
  full_name: string | null
  email: string | null
}

type WorkoutSessionRow = {
  id: string
  student_id: string
  completed_at: string
  status: string
  session_rpe: number | null
  assigned_workouts: { name: string | null } | null
}

type CompletedSet = {
  session_id: string
  exercise_id: string
  weight_kg: number | null
  reps: number | null
}

type ExerciseMuscles = {
  id: string
  name: string
  muscle_group: string | null
  secondary_muscle?: string | null
}

type MusclePriority = {
  name: string
  effectiveSets: number
  percentage: number
  exercises: { name: string; sets: number }[]
}

type DaySession = { id: string; workoutName: string; studentId: string }

type DailyVolume = {
  day: number
  shortName: string
  date: Date
  sets: number
  volume: number
  sessions: DaySession[]
}

type InsightsData = {
  daily: DailyVolume[]
  totalSets: number
  totalVolume: number
  completedSessions: number
  averageRpe: number | null
  muscles: MusclePriority[]
  studentsWithoutTraining: StudentProfile[]
}

const WEEKDAYS = [
  { day: 1, shortName: 'Seg', fullName: 'Segunda-feira' },
  { day: 2, shortName: 'Ter', fullName: 'Terça-feira' },
  { day: 3, shortName: 'Qua', fullName: 'Quarta-feira' },
  { day: 4, shortName: 'Qui', fullName: 'Quinta-feira' },
  { day: 5, shortName: 'Sex', fullName: 'Sexta-feira' },
  { day: 6, shortName: 'Sáb', fullName: 'Sábado' },
  { day: 7, shortName: 'Dom', fullName: 'Domingo' },
]

function getWeekStart(offset: number) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + offset * 7)
  return start
}

function getWeekday(date: Date) {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

function formatDate(date: Date) {
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '')
}

function formatCount(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',')
}

function formatLoad(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value)
}

export function WeeklyTrainingInsights({ mode }: WeeklyTrainingInsightsProps) {
  const [supabase] = useState(() => createClient())
  const [students, setStudents] = useState<StudentProfile[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('all')
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState(() => getWeekday(new Date()))
  const [chartMode, setChartMode] = useState<'sets' | 'load'>('sets')
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null)
  const [insights, setInsights] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const user = await getCurrentUser(supabase)
        if (!user) throw new Error('Faça login para ver o resumo semanal.')

        let studentRows: StudentProfile[] = []
        if (mode === 'admin') {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('role', 'student')
            .order('full_name')
          if (error) throw error
          studentRows = (data ?? []) as StudentProfile[]
        }

        const studentId = mode === 'student' ? user.id : selectedStudentId === 'all' ? null : selectedStudentId
        const weekStart = getWeekStart(weekOffset)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 7)

        // Só treinos concluídos contam: a data de referência é a conclusão.
        let sessionsQuery = supabase
          .from('workout_sessions')
          .select('id, student_id, completed_at, status, session_rpe, assigned_workouts(name)')
          .eq('status', 'completed')
          .gte('completed_at', weekStart.toISOString())
          .lt('completed_at', weekEnd.toISOString())
        if (studentId) sessionsQuery = sessionsQuery.eq('student_id', studentId)

        const { data: sessionRows, error: sessionsError } = await sessionsQuery
        if (sessionsError) throw sessionsError
        const sessions = (sessionRows ?? []) as unknown as WorkoutSessionRow[]
        const sessionIds = sessions.map((session) => session.id)

        let sets: CompletedSet[] = []
        if (sessionIds.length > 0) {
          const { data, error } = await supabase
            .from('session_sets')
            .select('session_id, exercise_id, weight_kg, reps')
            .in('session_id', sessionIds)
            .eq('completed', true)
          if (error) throw error
          sets = (data ?? []) as CompletedSet[]
        }

        const exerciseIds = [...new Set(sets.map((set) => set.exercise_id))]
        let exerciseRows: ExerciseMuscles[] = []
        if (exerciseIds.length > 0) {
          // select('*'): secondary_muscle pode não existir na tabela.
          const { data, error } = await supabase.from('exercises').select('*').in('id', exerciseIds)
          if (error) throw error
          exerciseRows = (data ?? []) as ExerciseMuscles[]
        }

        const exerciseById = new Map(exerciseRows.map((exercise) => [exercise.id, exercise]))
        const sessionById = new Map(sessions.map((session) => [session.id, session]))
        const daily: DailyVolume[] = WEEKDAYS.map((weekday, index) => {
          const date = new Date(weekStart)
          date.setDate(date.getDate() + index)
          return { day: weekday.day, shortName: weekday.shortName, date, sets: 0, volume: 0, sessions: [] }
        })

        for (const session of sessions) {
          const weekday = getWeekday(new Date(session.completed_at))
          daily[weekday - 1].sessions.push({
            id: session.id,
            workoutName: session.assigned_workouts?.name || 'Treino',
            studentId: session.student_id,
          })
        }

        const muscleTotals = new Map<string, { effectiveSets: number; exercises: Map<string, number> }>()
        const addMuscleWork = (muscle: string | null | undefined, count: number, exerciseName: string) => {
          const name = muscle?.trim()
          if (!name) return
          const current = muscleTotals.get(name) ?? { effectiveSets: 0, exercises: new Map<string, number>() }
          current.effectiveSets += count
          current.exercises.set(exerciseName, (current.exercises.get(exerciseName) ?? 0) + count)
          muscleTotals.set(name, current)
        }

        let totalVolume = 0
        for (const set of sets) {
          const session = sessionById.get(set.session_id)
          const dayData = daily[getWeekday(new Date(session?.completed_at ?? weekStart)) - 1]
          const volume = Math.max(0, Number(set.weight_kg) || 0) * Math.max(0, Number(set.reps) || 0)
          totalVolume += volume
          dayData.sets += 1
          dayData.volume += volume

          const exercise = exerciseById.get(set.exercise_id)
          if (exercise) {
            addMuscleWork(exercise.muscle_group, 1, exercise.name)
            const secondaryMuscles =
              exercise.secondary_muscle
                ?.split(/[,;/]/)
                .map((muscle) => muscle.trim())
                .filter((muscle) => muscle && muscle !== exercise.muscle_group) ?? []
            for (const muscle of secondaryMuscles) addMuscleWork(muscle, 0.5, exercise.name)
          }
        }

        const effectiveSetTotal = [...muscleTotals.values()].reduce((total, muscle) => total + muscle.effectiveSets, 0)
        const muscles = [...muscleTotals.entries()]
          .map(([name, muscle]) => ({
            name,
            effectiveSets: muscle.effectiveSets,
            percentage: effectiveSetTotal > 0 ? Math.round((muscle.effectiveSets / effectiveSetTotal) * 100) : 0,
            exercises: [...muscle.exercises.entries()]
              .map(([exerciseName, exerciseSets]) => ({ name: exerciseName, sets: exerciseSets }))
              .sort((first, second) => second.sets - first.sets),
          }))
          .sort((first, second) => second.effectiveSets - first.effectiveSets)

        const rpeValues = sessions
          .filter((session) => session.session_rpe != null)
          .map((session) => Number(session.session_rpe))
        const trainedStudentIds = new Set(sessions.map((session) => session.student_id))

        if (!active) return
        setStudents(studentRows)
        setInsights({
          daily,
          totalSets: sets.length,
          totalVolume,
          completedSessions: sessions.length,
          averageRpe: rpeValues.length > 0 ? rpeValues.reduce((total, value) => total + value, 0) / rpeValues.length : null,
          muscles,
          studentsWithoutTraining:
            mode === 'admin' && !studentId ? studentRows.filter((student) => !trainedStudentIds.has(student.id)) : [],
        })
        setErrorMessage('')
      } catch (error) {
        if (!active) return
        setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar o resumo semanal.')
        setInsights(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [mode, selectedStudentId, supabase, weekOffset])

  const changeWeek = (offset: number) => {
    setLoading(true)
    setWeekOffset(Math.min(0, offset))
  }

  const changeStudent = (studentId: string) => {
    setLoading(true)
    setSelectedStudentId(studentId)
  }

  const weekStart = getWeekStart(weekOffset)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const studentById = new Map(students.map((student) => [student.id, student]))
  const selectedDayData = insights?.daily[selectedDay - 1]
  const selectedMuscleData = insights?.muscles.find((muscle) => muscle.name === selectedMuscle)
  const chartMaximum = Math.max(1, ...(insights?.daily.map((day) => (chartMode === 'sets' ? day.sets : day.volume)) ?? [0]))
  const topMuscle = insights?.muscles[0]

  return (
    <section className="space-y-5 text-white" aria-labelledby="weekly-training-title">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
            <Activity className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            {mode === 'admin' ? 'Painel do treinador' : 'Painel do atleta'}
          </p>
          <h2 id="weekly-training-title" className="mt-1 text-lg font-black">
            Semana de treino
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            {formatDate(weekStart)} – {formatDate(weekEnd)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Semana anterior"
            onClick={() => changeWeek(weekOffset - 1)}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={() => changeWeek(0)}
              className="rounded-lg px-2 py-1 text-[10px] font-bold text-emerald-300 hover:bg-zinc-900"
            >
              Esta semana
            </button>
          )}
          <button
            type="button"
            aria-label="Próxima semana"
            disabled={weekOffset >= 0}
            onClick={() => changeWeek(weekOffset + 1)}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      {mode === 'admin' && (
        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          Atleta
          <select
            value={selectedStudentId}
            onChange={(event) => changeStudent(event.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-medium normal-case text-white outline-none focus:border-emerald-400"
          >
            <option value="all">Todos os atletas</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.full_name || student.email || 'Atleta'}
              </option>
            ))}
          </select>
        </label>
      )}

      {loading ? (
        <div className="py-8 text-center text-xs text-zinc-500" role="status">
          Carregando semana...
        </div>
      ) : errorMessage ? (
        <p role="alert" className="rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-xs text-red-300">
          {errorMessage}
        </p>
      ) : insights ? (
        <>
          <div className="grid grid-cols-2 divide-x divide-y divide-zinc-900 border-y border-zinc-900 sm:grid-cols-4 sm:divide-y-0">
            <div className="py-3 pr-3">
              <p className="text-[10px] font-bold uppercase text-zinc-500">Séries</p>
              <p className="mt-1 text-xl font-black">{insights.totalSets}</p>
            </div>
            <div className="py-3 pl-3 sm:px-3">
              <p className="text-[10px] font-bold uppercase text-zinc-500">Volume</p>
              <p className="mt-1 text-xl font-black">
                {formatLoad(insights.totalVolume)} <span className="text-xs font-semibold text-zinc-500">kg</span>
              </p>
            </div>
            <div className="py-3 pr-3 sm:px-3">
              <p className="text-[10px] font-bold uppercase text-zinc-500">Treinos</p>
              <p className="mt-1 text-xl font-black">{insights.completedSessions}</p>
            </div>
            <div className="py-3 pl-3 sm:pl-3">
              <p className="text-[10px] font-bold uppercase text-zinc-500">RPE médio</p>
              <p className="mt-1 text-xl font-black">
                {insights.averageRpe?.toFixed(1).replace('.', ',') ?? '—'}
                <span className="text-xs font-semibold text-zinc-500">/10</span>
              </p>
            </div>
          </div>

          {insights.studentsWithoutTraining.length > 0 && weekOffset === 0 && (
            <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase text-amber-400">
                <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                Sem treino concluído nesta semana ({insights.studentsWithoutTraining.length})
              </p>
              <p className="mt-1.5 text-xs text-zinc-300">
                {insights.studentsWithoutTraining
                  .slice(0, 8)
                  .map((student) => student.full_name || student.email || 'Atleta')
                  .join(', ')}
                {insights.studentsWithoutTraining.length > 8 && '…'}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold">Volume diário</h3>
              <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5" role="group" aria-label="Métrica do gráfico semanal">
                {(
                  [
                    { id: 'sets', label: 'Séries' },
                    { id: 'load', label: 'Kg × reps' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={chartMode === option.id}
                    onClick={() => setChartMode(option.id)}
                    className={cn(
                      'rounded-md px-2 py-1.5 text-[10px] font-bold transition',
                      chartMode === option.id ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {insights.daily.map((day) => {
                const value = chartMode === 'sets' ? day.sets : day.volume
                const height = value > 0 ? Math.max(8, (value / chartMaximum) * 100) : 3
                return (
                  <button
                    key={day.day}
                    type="button"
                    aria-pressed={selectedDay === day.day}
                    aria-label={`${WEEKDAYS[day.day - 1].fullName}: ${day.sets} séries e ${formatLoad(day.volume)} kg vezes reps`}
                    onClick={() => setSelectedDay(day.day)}
                    className="flex min-w-0 flex-col items-center gap-1 rounded-lg p-1 transition hover:bg-zinc-900"
                  >
                    <span className="h-3 text-[9px] font-bold text-zinc-400">
                      {value > 0 ? (chartMode === 'sets' ? value : formatLoad(value)) : ''}
                    </span>
                    <span className="flex h-20 w-full items-end rounded-md bg-zinc-900/70 p-1">
                      <span
                        className={cn('w-full rounded-sm transition-all', selectedDay === day.day ? 'bg-emerald-400' : 'bg-sky-500')}
                        style={{ height: `${height}%` }}
                      />
                    </span>
                    <span
                      className={cn('text-[9px] font-bold', selectedDay === day.day ? 'text-emerald-300' : 'text-zinc-500')}
                    >
                      {day.shortName}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-3 border-t border-zinc-900 pt-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <h3 className="text-sm font-extrabold">
                {WEEKDAYS[selectedDay - 1].fullName} · {formatDate(selectedDayData?.date ?? weekStart)}
              </h3>
            </div>
            <p className="text-[10px] text-zinc-500">
              {selectedDayData?.sets ?? 0} séries concluídas · {formatLoad(selectedDayData?.volume ?? 0)} kg
            </p>
            {selectedDayData && selectedDayData.sessions.length > 0 ? (
              <ul className="divide-y divide-zinc-900">
                {selectedDayData.sessions.map((session) => {
                  const student = studentById.get(session.studentId)
                  return (
                    <li key={session.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="truncate text-sm font-semibold text-white">{session.workoutName}</span>
                      {mode === 'admin' && (
                        <span className="shrink-0 text-[10px] text-zinc-500">
                          {student?.full_name || student?.email || 'Atleta'}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="flex items-center gap-2 rounded-xl bg-zinc-950 px-3 py-3 text-xs text-zinc-500">
                <Dumbbell className="h-4 w-4" aria-hidden="true" />
                Nenhum treino concluído neste dia
              </p>
            )}
          </div>

          <div className="space-y-3 border-t border-zinc-900 pt-4">
            <div>
              <h3 className="text-sm font-extrabold">Mapa de foco muscular</h3>
              <p className="mt-0.5 text-[10px] text-zinc-500">Toque em um músculo para ver os exercícios</p>
            </div>

            {insights.muscles.length > 0 ? (
              <div className="space-y-1">
                {insights.muscles.map((muscle) => (
                  <button
                    key={muscle.name}
                    type="button"
                    aria-pressed={selectedMuscle === muscle.name}
                    onClick={() => setSelectedMuscle((current) => (current === muscle.name ? null : muscle.name))}
                    className={cn(
                      'w-full rounded-lg px-2 py-2 text-left transition',
                      selectedMuscle === muscle.name ? 'bg-zinc-900' : 'hover:bg-zinc-900/60',
                    )}
                  >
                    <span className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-semibold text-zinc-200">{muscle.name}</span>
                      <span className="shrink-0 font-bold text-zinc-400">{muscle.percentage}%</span>
                    </span>
                    <span className="mt-1.5 flex items-center gap-2">
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                        <span className="block h-full rounded-full bg-sky-500 transition-all" style={{ width: `${muscle.percentage}%` }} />
                      </span>
                      <span className="w-16 shrink-0 text-right text-[9px] text-zinc-500">
                        {formatCount(muscle.effectiveSets)} séries
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-5 text-center text-xs text-zinc-500">
                Conclua séries nesta semana para ver a distribuição muscular.
              </p>
            )}

            {selectedMuscleData && (
              <div className="rounded-xl border-l-2 border-sky-400 bg-zinc-950 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase text-sky-300">Foco selecionado</p>
                <p className="mt-1 text-sm font-black">
                  {selectedMuscleData.name} · {selectedMuscleData.percentage}%
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedMuscleData.exercises.slice(0, 4).map((exercise) => (
                    <span key={exercise.name} className="rounded-md bg-zinc-900 px-2 py-1 text-[10px] text-zinc-400">
                      {exercise.name} · {formatCount(exercise.sets)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[9px] text-zinc-600">Série principal = 1; músculo secundário = 0,5 série efetiva.</p>
          </div>

          {topMuscle && insights.totalSets > 0 && (
            <p className="text-[10px] text-zinc-500">
              {mode === 'admin' ? 'O maior foco' : 'Seu maior foco'} nesta semana é{' '}
              <span className="font-bold text-emerald-300">{topMuscle.name}</span>, com {topMuscle.percentage}% das séries
              efetivas.
            </p>
          )}
        </>
      ) : null}
    </section>
  )
}
