'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Activity, ChevronLeft, ChevronRight, CircleAlert, Dumbbell, Flame, Gauge, Layers, Weight } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import { REGION_LABELS, loadFill, muscleLoad, regionsForExercise, splitSecondary, type MuscleRegion, type MuscleWork } from '@/lib/muscles'
import { WEEKDAY_SHORT, startOfWeek } from '@/lib/stats'
import { capitalize } from '@/lib/text'
import { cn } from '@/lib/cn'
import { BarFill } from '@/components/ui/bar-fill'
import { friendlyError } from '@/lib/errors'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import { Eyebrow } from '@/components/ui/tile'
import { MuscleMap } from '@/components/fitness/MuscleMap'

type WeeklyTrainingInsightsProps = {
  mode: 'student' | 'admin'
}

type StudentProfile = { id: string; full_name: string | null; email: string | null }

type SessionRow = {
  id: string
  student_id: string
  completed_at: string
  session_rpe: number | null
  assigned_workouts: { name: string | null } | null
}

type SetRow = { session_id: string; exercise_id: string; weight_kg: number | null; reps: number | null }

type ExerciseRow = { id: string; name: string; muscle_group: string | null; secondary_muscle?: string | null }

type DaySession = { id: string; workoutName: string; studentId: string }

type DailyVolume = { sets: number; volume: number; sessions: DaySession[] }

type InsightsData = {
  daily: DailyVolume[]
  totalSets: number
  totalVolume: number
  completedSessions: number
  averageRpe: number | null
  fills: Partial<Record<MuscleRegion, string>>
  ranking: { region: MuscleRegion; sets: number; share: number }[]
  studentsWithoutTraining: StudentProfile[]
}

function formatRange(start: Date) {
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const format = (date: Date) => date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '')
  return `${format(start)} – ${format(end)}`
}


const formatKg = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value)

export function WeeklyTrainingInsights({ mode }: WeeklyTrainingInsightsProps) {
  const [supabase] = useState(() => createClient())
  const [students, setStudents] = useState<StudentProfile[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('all')
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState(() => (new Date().getDay() + 6) % 7)
  const [chartMode, setChartMode] = useState<'sets' | 'load'>('sets')
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
        const weekStart = startOfWeek(new Date())
        weekStart.setDate(weekStart.getDate() + weekOffset * 7)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 7)

        // Só treinos concluídos contam; a data de referência é a conclusão.
        let sessionsQuery = supabase
          .from('workout_sessions')
          .select('id, student_id, completed_at, session_rpe, assigned_workouts(name)')
          .eq('status', 'completed')
          .gte('completed_at', weekStart.toISOString())
          .lt('completed_at', weekEnd.toISOString())
        if (studentId) sessionsQuery = sessionsQuery.eq('student_id', studentId)

        const { data: sessionRows, error: sessionsError } = await sessionsQuery
        if (sessionsError) throw sessionsError
        const sessions = (sessionRows ?? []) as unknown as SessionRow[]

        let sets: SetRow[] = []
        if (sessions.length > 0) {
          const { data, error } = await supabase
            .from('session_sets')
            .select('session_id, exercise_id, weight_kg, reps')
            .in(
              'session_id',
              sessions.map((session) => session.id),
            )
            .eq('completed', true)
          if (error) throw error
          sets = (data ?? []) as SetRow[]
        }

        const exerciseIds = [...new Set(sets.map((set) => set.exercise_id))]
        let exercises: ExerciseRow[] = []
        if (exerciseIds.length > 0) {
          // select('*'): secondary_muscle pode não existir na tabela.
          const { data, error } = await supabase.from('exercises').select('*').in('id', exerciseIds)
          if (error) throw error
          exercises = (data ?? []) as ExerciseRow[]
        }

        const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]))
        const sessionById = new Map(sessions.map((session) => [session.id, session]))
        const daily: DailyVolume[] = Array.from({ length: 7 }, () => ({ sets: 0, volume: 0, sessions: [] }))
        const dayIndex = (iso: string) => (new Date(iso).getDay() + 6) % 7

        for (const session of sessions) {
          daily[dayIndex(session.completed_at)].sessions.push({
            id: session.id,
            workoutName: session.assigned_workouts?.name || 'Treino',
            studentId: session.student_id,
          })
        }

        let totalVolume = 0
        const work: MuscleWork[] = []
        for (const set of sets) {
          const session = sessionById.get(set.session_id)
          if (!session) continue
          const volume = Math.max(0, Number(set.weight_kg) || 0) * Math.max(0, Number(set.reps) || 0)
          const day = daily[dayIndex(session.completed_at)]
          day.sets += 1
          day.volume += volume
          totalVolume += volume

          const exercise = exerciseById.get(set.exercise_id)
          if (exercise) {
            work.push({ muscle: exercise.muscle_group, amount: 1, exercise: exercise.name })
            for (const muscle of splitSecondary(exercise.secondary_muscle)) work.push({ muscle, amount: 0.5 })
          }
        }

        // Séries efetivas por região para o ranking (principal = 1, secundário = 0,5).
        const effective: Partial<Record<MuscleRegion, number>> = {}
        for (const { muscle, amount, exercise } of work) {
          for (const [region, factor] of regionsForExercise(exercise, muscle)) {
            effective[region] = (effective[region] ?? 0) + amount * factor
          }
        }
        const effectiveTotal = Object.values(effective).reduce((total, value) => total + value, 0)
        const ranking = (Object.entries(effective) as [MuscleRegion, number][])
          .map(([region, value]) => ({ region, sets: value, share: effectiveTotal > 0 ? value / effectiveTotal : 0 }))
          .sort((first, second) => second.sets - first.sets)

        const fills: Partial<Record<MuscleRegion, string>> = {}
        for (const [region, intensity] of Object.entries(muscleLoad(work)) as [MuscleRegion, number][]) {
          fills[region] = loadFill(intensity)
        }

        const rpeValues = sessions.filter((session) => session.session_rpe != null).map((session) => Number(session.session_rpe))
        const trainedStudentIds = new Set(sessions.map((session) => session.student_id))

        if (!active) return
        setStudents(studentRows)
        setInsights({
          daily,
          totalSets: sets.length,
          totalVolume,
          completedSessions: sessions.length,
          averageRpe: rpeValues.length > 0 ? rpeValues.reduce((total, value) => total + value, 0) / rpeValues.length : null,
          fills,
          ranking,
          studentsWithoutTraining:
            mode === 'admin' && !studentId ? studentRows.filter((student) => !trainedStudentIds.has(student.id)) : [],
        })
        setErrorMessage('')
      } catch (error) {
        if (!active) return
        setErrorMessage(friendlyError(error, 'Não foi possível carregar o resumo semanal'))
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

  const weekStart = startOfWeek(new Date())
  weekStart.setDate(weekStart.getDate() + weekOffset * 7)
  const studentById = new Map(students.map((student) => [student.id, student]))
  const chartMaximum = Math.max(1, ...(insights?.daily.map((day) => (chartMode === 'sets' ? day.sets : day.volume)) ?? [0]))
  const selectedDayData = insights?.daily[selectedDay]
  const selectedDate = new Date(weekStart)
  selectedDate.setDate(selectedDate.getDate() + selectedDay)

  return (
    <section className="space-y-4" aria-labelledby="weekly-training-title">
      <header className="flex items-end justify-between gap-3">
        <div>
          <Eyebrow icon={Activity} className="text-brand/80">
            {mode === 'admin' ? 'Painel do treinador' : 'Seu painel'}
          </Eyebrow>
          <h2 id="weekly-training-title" className="mt-1 font-display text-3xl font-bold uppercase leading-none">
            {weekOffset === 0 ? 'Esta semana' : weekOffset === -1 ? 'Semana passada' : 'Semana'}
          </h2>
          <p className="mt-1 text-xs text-zinc-400">{formatRange(weekStart)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-line bg-surface p-1">
          <button
            type="button"
            aria-label="Semana anterior"
            onClick={() => changeWeek(weekOffset - 1)}
            className="grid h-11 w-11 place-items-center rounded-xl text-zinc-300 transition hover:bg-white/5 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={() => changeWeek(0)}
              className="min-h-11 rounded-xl px-3 text-sm font-bold text-brand hover:bg-white/5"
            >
              Hoje
            </button>
          )}
          <button
            type="button"
            aria-label="Próxima semana"
            disabled={weekOffset >= 0}
            onClick={() => changeWeek(weekOffset + 1)}
            className="grid h-11 w-11 place-items-center rounded-xl text-zinc-300 transition hover:bg-white/5 hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      {mode === 'admin' && (
        <label className="block">
          <span className="sr-only">Atleta</span>
          <select
            value={selectedStudentId}
            onChange={(event) => changeStudent(event.target.value)}
            className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-sm font-semibold text-white outline-none focus:border-brand"
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

      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <m.div key="loading" exit={{ opacity: 0 }} className="space-y-3" role="status" aria-label="Carregando semana">
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-24 rounded-3xl" />
              ))}
            </div>
            <Skeleton className="h-52 rounded-3xl" />
          </m.div>
        ) : errorMessage ? (
          <m.p
            key="error"
            role="alert"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-danger/30 bg-danger-soft p-4 text-xs text-danger"
          >
            {errorMessage}
          </m.p>
        ) : insights ? (
          <m.div
            key={`${weekOffset}-${selectedStudentId}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            <dl className="grid grid-cols-2 gap-3">
              {[
                { label: 'Treinos', icon: Flame, value: insights.completedSessions, format: undefined, suffix: '' },
                { label: 'Séries', icon: Layers, value: insights.totalSets, format: undefined, suffix: '' },
                { label: 'Volume', icon: Weight, value: insights.totalVolume, format: formatKg, suffix: 'kg' },
                {
                  label: 'RPE médio',
                  icon: Gauge,
                  value: insights.averageRpe ?? 0,
                  format: (value: number) => (insights.averageRpe === null ? '—' : value.toFixed(1).replace('.', ',')),
                  suffix: insights.averageRpe === null ? '' : '/10',
                },
              ].map((stat) => (
                <div key={stat.label} className="rounded-3xl border border-line bg-surface p-4">
                  <dt>
                    <Eyebrow icon={stat.icon}>{stat.label}</Eyebrow>
                  </dt>
                  <dd className="mt-2 font-display text-4xl font-bold leading-none">
                    <AnimatedNumber value={stat.value} format={stat.format} />
                    {stat.suffix && <span className="ml-1 text-base font-semibold text-zinc-500">{stat.suffix}</span>}
                  </dd>
                </div>
              ))}
            </dl>

            {insights.studentsWithoutTraining.length > 0 && weekOffset === 0 && (
              <div className="rounded-3xl border border-gold/25 bg-gold-soft p-4">
                <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.1em] text-gold">
                  <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  Sem treino nesta semana ({insights.studentsWithoutTraining.length})
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-200">
                  {insights.studentsWithoutTraining
                    .slice(0, 8)
                    .map((student) => student.full_name || student.email || 'Atleta')
                    .join(', ')}
                  {insights.studentsWithoutTraining.length > 8 && '…'}
                </p>
              </div>
            )}

            {/* Volume diário */}
            <div className="rounded-3xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <Eyebrow>Volume diário</Eyebrow>
                <SegmentedControl
                  size="sm"
                  label="Métrica do gráfico"
                  value={chartMode}
                  onChange={setChartMode}
                  options={[
                    { value: 'sets', label: 'Séries' },
                    { value: 'load', label: 'Kg×reps' },
                  ]}
                  className="w-40"
                />
              </div>
              <div className="mt-4 grid grid-cols-7 gap-1.5">
                {insights.daily.map((day, index) => {
                  const value = chartMode === 'sets' ? day.sets : day.volume
                  const height = value > 0 ? Math.max(10, (value / chartMaximum) * 100) : 4
                  const selected = selectedDay === index
                  return (
                    <button
                      key={index}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelectedDay(index)}
                      className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl py-1 transition hover:bg-white/[0.03]"
                    >
                      <span className="h-3.5 text-xs font-bold text-zinc-400" aria-hidden="true">
                        {value > 0 ? (chartMode === 'sets' ? value : `${(value / 1000).toFixed(1).replace('.', ',')}k`) : ''}
                      </span>
                      <span className="flex h-24 w-full items-end justify-center">
                        <m.span
                          className={cn(
                            'w-full max-w-7 rounded-lg',
                            selected ? 'bg-brand' : value > 0 ? 'bg-white/25' : 'bg-white/[0.06]',
                          )}
                          initial={{ height: 0 }}
                          animate={{ height: `${height}%` }}
                          transition={{ type: 'spring', stiffness: 220, damping: 26, delay: index * 0.03 }}
                        />
                      </span>
                      <span className={cn('text-xs font-bold', selected ? 'text-brand' : 'text-zinc-500')}>
                        {WEEKDAY_SHORT[index]}
                        <span className="sr-only">
                          : {day.sets} séries, {formatKg(day.volume)} kg
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-3 border-t border-line pt-3">
                <p className="text-xs font-semibold text-zinc-400">
                  {capitalize(selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' }))}
                  <span className="text-zinc-600">
                    {' '}
                    · {selectedDayData?.sets ?? 0} séries · {formatKg(selectedDayData?.volume ?? 0)} kg
                  </span>
                </p>
                {selectedDayData && selectedDayData.sessions.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {selectedDayData.sessions.map((session) => {
                      const student = studentById.get(session.studentId)
                      return (
                        <li
                          key={session.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2"
                        >
                          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
                            <Dumbbell className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
                            <span className="truncate">{session.workoutName}</span>
                          </span>
                          {mode === 'admin' && (
                            <span className="shrink-0 text-xs text-zinc-500">
                              {student?.full_name || student?.email || 'Atleta'}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-xs text-zinc-600">Nenhum treino concluído neste dia.</p>
                )}
              </div>
            </div>

            {/* Foco muscular */}
            <div className="rounded-3xl border border-line bg-surface p-4">
              <Eyebrow>Foco muscular</Eyebrow>
              {insights.ranking.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-500">Conclua séries nesta semana para ver os músculos trabalhados.</p>
              ) : (
                <div className="mt-3 flex gap-4">
                  <div className="w-[42%] shrink-0">
                    <MuscleMap fills={insights.fills} showLabels />
                  </div>
                  <ul className="min-w-0 flex-1 space-y-2.5">
                    {insights.ranking.slice(0, 6).map((item, index) => (
                      <li key={item.region}>
                        <div className="flex items-center justify-between text-xs">
                          <span className={cn('font-semibold', index === 0 ? 'text-white' : 'text-zinc-300')}>
                            {REGION_LABELS[item.region]}
                          </span>
                          <span className="text-zinc-500">{Math.round(item.share * 100)}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                          <BarFill
                            value={Math.max(0.06, item.sets / insights.ranking[0].sets)}
                            delay={Math.min(index, 8) * 50}
                            className="bg-brand"
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {insights.ranking.length > 0 && (
                <p className="mt-3 border-t border-line pt-2.5 text-xs text-zinc-500">
                  Maior foco: <span className="font-bold text-brand">{REGION_LABELS[insights.ranking[0].region]}</span> · série
                  principal = 1, músculo secundário = 0,5.
                </p>
              )}
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
