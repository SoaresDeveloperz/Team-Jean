'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { m } from 'framer-motion'
import { Check, ChevronDown, Dumbbell, Search, TrendingDown, TrendingUp, Trophy, Zap } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import { formatKg } from '@/lib/workouts'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import { Eyebrow, Stagger, Tile } from '@/components/ui/tile'
import { LineChart } from '@/components/fitness/LineChart'

type ExerciseOption = { id: string; name: string; muscle_group: string | null }

type SetRow = { session_id: string; weight_kg: number | null; reps: number | null }

type CompletedSession = { id: string; completed_at: string | null }

type SessionStat = {
  sessionId: string
  date: string
  bestWeight: number
  bestReps: number
  oneRepMax: number
  volume: number
  sets: { weight: number; reps: number }[]
}

type Metric = 'weight' | 'oneRepMax' | 'volume'

const MAX_SESSIONS = 12

// Fórmula de Epley para estimar a carga máxima de 1 repetição.
function estimateOneRepMax(weight: number, reps: number) {
  if (weight <= 0 || reps <= 0) return 0
  return reps === 1 ? weight : weight * (1 + reps / 30)
}

function buildSessionStats(rows: SetRow[], dateBySession: Map<string, string>) {
  const bySession = new Map<string, SessionStat>()
  for (const row of rows) {
    const weight = Number(row.weight_kg) || 0
    const reps = Number(row.reps) || 0
    const stat = bySession.get(row.session_id) ?? {
      sessionId: row.session_id,
      date: dateBySession.get(row.session_id) ?? '',
      bestWeight: 0,
      bestReps: 0,
      oneRepMax: 0,
      volume: 0,
      sets: [],
    }
    stat.sets.push({ weight, reps })
    stat.volume += weight * reps
    stat.oneRepMax = Math.max(stat.oneRepMax, estimateOneRepMax(weight, reps))
    if (weight > stat.bestWeight || (weight === stat.bestWeight && reps > stat.bestReps)) {
      stat.bestWeight = weight
      stat.bestReps = reps
    }
    bySession.set(row.session_id, stat)
  }
  return [...bySession.values()].sort((first, second) => first.date.localeCompare(second.date))
}

const metricValue = (stat: SessionStat, metric: Metric) =>
  metric === 'weight' ? stat.bestWeight : metric === 'oneRepMax' ? stat.oneRepMax : stat.volume

export default function StudentProgressPage() {
  const [supabase] = useState(() => createClient())
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[] | null>(null)
  const [exercises, setExercises] = useState<ExerciseOption[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [stats, setStats] = useState<SessionStat[]>([])
  const [metric, setMetric] = useState<Metric>('weight')
  const [loading, setLoading] = useState(true)
  const [loadingChart, setLoadingChart] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const requestId = useRef(0)

  // Lista apenas exercícios que o treinador prescreveu para este aluno.
  useEffect(() => {
    let active = true

    const loadExercises = async () => {
      const user = await getCurrentUser(supabase)
      if (!active || !user) return

      const [workoutsResult, sessionsResult] = await Promise.all([
        supabase.from('assigned_workouts').select('id').eq('student_id', user.id),
        supabase
          .from('workout_sessions')
          .select('id, completed_at')
          .eq('student_id', user.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(60),
      ])
      if (!active) return

      const firstError = workoutsResult.error ?? sessionsResult.error
      if (firstError) {
        setErrorMessage(`Não foi possível carregar seus exercícios: ${firstError.message}`)
        setLoading(false)
        return
      }

      const workoutIds = ((workoutsResult.data ?? []) as { id: string }[]).map((workout) => workout.id)
      const sessions = (sessionsResult.data ?? []) as CompletedSession[]

      const [exercisesResult, lastSetResult] = await Promise.all([
        workoutIds.length > 0
          ? supabase
              .from('assigned_workout_exercises')
              .select('exercise_id, exercises(id, name, muscle_group)')
              .in('assigned_workout_id', workoutIds)
          : Promise.resolve({ data: [], error: null }),
        // Abre a tela num exercício do último treino concluído.
        sessions.length > 0
          ? supabase
              .from('session_sets')
              .select('exercise_id')
              .eq('session_id', sessions[0].id)
              .eq('completed', true)
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])
      if (!active) return

      if (exercisesResult.error) {
        setErrorMessage(`Não foi possível carregar seus exercícios: ${exercisesResult.error.message}`)
        setLoading(false)
        return
      }

      const unique = new Map<string, ExerciseOption>()
      for (const row of (exercisesResult.data ?? []) as unknown as { exercises: ExerciseOption | null }[]) {
        if (row.exercises) unique.set(row.exercises.id, row.exercises)
      }
      const options = [...unique.values()].sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'))

      const lastExerciseId = (lastSetResult.data as { exercise_id: string } | null)?.exercise_id
      setCompletedSessions(sessions)
      setExercises(options)
      setSelectedExerciseId(options.find((option) => option.id === lastExerciseId)?.id ?? options[0]?.id ?? '')
      setLoading(false)
    }

    void loadExercises()
    return () => {
      active = false
    }
  }, [supabase])

  useEffect(() => {
    if (!completedSessions || completedSessions.length === 0 || !selectedExerciseId) return
    const currentRequest = ++requestId.current

    const loadProgress = async () => {
      setLoadingChart(true)
      const { data, error } = await supabase
        .from('session_sets')
        .select('session_id, weight_kg, reps')
        .in(
          'session_id',
          completedSessions.map((session) => session.id),
        )
        .eq('exercise_id', selectedExerciseId)
        .eq('completed', true)

      // Ignora respostas de um exercício que já não está selecionado.
      if (currentRequest !== requestId.current) return

      if (error) {
        setErrorMessage(`Não foi possível carregar sua evolução: ${error.message}`)
        setStats([])
      } else {
        const dateBySession = new Map(completedSessions.map((session) => [session.id, session.completed_at ?? '']))
        setErrorMessage('')
        setStats(buildSessionStats((data ?? []) as SetRow[], dateBySession).slice(-MAX_SESSIONS))
      }
      setLoadingChart(false)
    }

    void loadProgress()
  }, [supabase, completedSessions, selectedExerciseId])

  const summary = useMemo(() => {
    if (stats.length === 0) return null
    const best = stats.reduce((top, stat) => (stat.bestWeight > top.bestWeight ? stat : top), stats[0])
    const values = stats.map((stat) => metricValue(stat, metric))
    return {
      best,
      bestOneRepMax: Math.max(...stats.map((stat) => stat.oneRepMax)),
      change: values[values.length - 1] - values[0],
    }
  }, [stats, metric])

  const closePicker = useCallback(() => setPickerOpen(false), [])
  const selectedExercise = exercises.find((exercise) => exercise.id === selectedExerciseId)
  const formatMetric = (value: number) =>
    metric === 'volume' ? `${formatKg(Math.round(value))} kg` : `${formatKg(Math.round(value * 10) / 10)} kg`

  const term = search.trim().toLowerCase()
  const groupedOptions = useMemo(() => {
    const groups = new Map<string, ExerciseOption[]>()
    for (const exercise of exercises) {
      const muscle = exercise.muscle_group || 'Geral'
      if (term && !exercise.name.toLowerCase().includes(term) && !muscle.toLowerCase().includes(term)) continue
      groups.set(muscle, [...(groups.get(muscle) ?? []), exercise])
    }
    return [...groups.entries()].sort(([first], [second]) => first.localeCompare(second, 'pt-BR'))
  }, [exercises, term])

  return (
    <div className="space-y-4">
      <div className="px-1">
        <Eyebrow>Sua evolução</Eyebrow>
        <h1 className="mt-1 font-display text-[2.75rem] font-bold uppercase leading-[0.9]">Evolução</h1>
      </div>

      {loading ? (
        <div className="space-y-3" role="status" aria-label="Carregando evolução">
          <Skeleton className="h-16 rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-3xl" />
            <Skeleton className="h-24 rounded-3xl" />
          </div>
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      ) : exercises.length === 0 ? (
        <div className="space-y-3 rounded-3xl border border-line bg-surface p-8 text-center">
          <Dumbbell className="mx-auto h-10 w-10 text-zinc-700" aria-hidden="true" />
          <p className="text-sm font-semibold text-zinc-400">Seu treinador ainda não prescreveu exercícios.</p>
          {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
        </div>
      ) : (
        <Stagger className="space-y-4">
          <m.button
            type="button"
            variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            onClick={() => setPickerOpen(true)}
            aria-haspopup="dialog"
            className="flex w-full items-center gap-3 rounded-3xl border border-line bg-surface p-4 text-left transition hover:border-line-strong"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
              <Dumbbell className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Exercício</span>
              <span className="block truncate text-base font-bold text-white">{selectedExercise?.name}</span>
            </span>
            <span className="flex items-center gap-1 text-xs font-bold text-zinc-400">
              Trocar <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </span>
          </m.button>

          {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

          {summary && (
            <div className="grid grid-cols-2 gap-3">
              <Tile className="p-4">
                <Eyebrow icon={Trophy} className="text-gold/80">
                  Recorde
                </Eyebrow>
                <p className="mt-2 font-display text-4xl font-bold leading-none">
                  {formatKg(summary.best.bestWeight)}
                  <span className="ml-1 text-base text-zinc-500">kg</span>
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">× {summary.best.bestReps} repetições</p>
              </Tile>
              <Tile className="p-4">
                <Eyebrow icon={Zap}>1RM estimado</Eyebrow>
                <p className="mt-2 font-display text-4xl font-bold leading-none">
                  {formatKg(Math.round(summary.bestOneRepMax))}
                  <span className="ml-1 text-base text-zinc-500">kg</span>
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">Fórmula de Epley</p>
              </Tile>
            </div>
          )}

          <Tile className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Eyebrow>Progressão</Eyebrow>
                {summary && stats.length < 2 && (
                  <p className="mt-1.5 text-sm font-semibold text-zinc-400">Primeiro registro. Continue treinando para ver a curva.</p>
                )}
                {summary && stats.length >= 2 && (
                  <p
                    className={cn(
                      'mt-1.5 flex items-center gap-1 text-sm font-bold',
                      summary.change > 0 ? 'text-brand' : summary.change < 0 ? 'text-danger' : 'text-zinc-400',
                    )}
                  >
                    {summary.change >= 0 ? (
                      <TrendingUp className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <TrendingDown className="h-4 w-4" aria-hidden="true" />
                    )}
                    {summary.change > 0 ? '+' : ''}
                    {formatMetric(summary.change)}
                    <span className="font-medium text-zinc-500">nos últimos {stats.length} treinos</span>
                  </p>
                )}
              </div>
            </div>
            <SegmentedControl
              className="mt-3"
              size="sm"
              label="Métrica do gráfico"
              value={metric}
              onChange={setMetric}
              options={[
                { value: 'weight', label: 'Carga máx.' },
                { value: 'oneRepMax', label: '1RM est.' },
                { value: 'volume', label: 'Volume' },
              ]}
            />
            <div className={cn('mt-3 transition-opacity', loadingChart && 'opacity-40')}>
              {stats.length === 0 ? (
                <p className="py-10 text-center text-xs text-zinc-600">
                  {loadingChart ? 'Carregando...' : 'Nenhum registro deste exercício ainda. Bora treinar!'}
                </p>
              ) : (
                <LineChart
                  key={`${selectedExerciseId}-${metric}`}
                  title={`Evolução de ${selectedExercise?.name ?? 'exercício'}`}
                  format={formatMetric}
                  points={stats.map((stat) => ({
                    key: stat.sessionId,
                    label: stat.date
                      ? new Date(stat.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                      : '--',
                    value: metricValue(stat, metric),
                  }))}
                />
              )}
            </div>
          </Tile>

          {stats.length > 0 && (
            <Tile className="p-0">
              <div className="px-5 pb-1 pt-5">
                <Eyebrow>Últimos treinos</Eyebrow>
              </div>
              <ul className="divide-y divide-line">
                {[...stats].reverse().map((stat) => {
                  const isRecord = summary?.best.sessionId === stat.sessionId
                  return (
                    <li key={stat.sessionId} className="flex items-center gap-3 px-5 py-3">
                      <span className="w-12 shrink-0 text-[11px] font-bold tabular-nums text-zinc-500">
                        {stat.date
                          ? new Date(stat.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                          : '--'}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-400">
                        {stat.sets.map((set) => `${formatKg(set.weight)}×${set.reps}`).join('  ·  ')}
                      </span>
                      <span
                        className={cn(
                          'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums',
                          isRecord ? 'bg-gold-soft text-gold' : 'bg-white/[0.06] text-white',
                        )}
                      >
                        {isRecord && <Trophy className="h-3 w-3" aria-label="Recorde" />}
                        {formatKg(stat.bestWeight)}kg
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Tile>
          )}
        </Stagger>
      )}

      <Modal open={pickerOpen} onClose={closePicker} title="Escolher exercício" description="Exercícios das suas fichas">
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou músculo..."
            aria-label="Buscar exercício"
            className="w-full rounded-2xl border border-line bg-surface py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none"
          />
        </div>
        <div className="mt-4 space-y-4">
          {groupedOptions.length === 0 && <p className="py-6 text-center text-xs text-zinc-500">Nenhum exercício encontrado.</p>}
          {groupedOptions.map(([muscle, options]) => (
            <div key={muscle}>
              <p className="mb-1.5 px-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{muscle}</p>
              <ul className="overflow-hidden rounded-2xl border border-line">
                {options.map((exercise) => {
                  const selected = exercise.id === selectedExerciseId
                  return (
                    <li key={exercise.id} className="border-b border-line last:border-b-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedExerciseId(exercise.id)
                          setPickerOpen(false)
                        }}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold transition',
                          selected ? 'bg-brand-soft text-brand' : 'text-zinc-200 hover:bg-white/[0.03]',
                        )}
                      >
                        {exercise.name}
                        {selected && <Check className="h-4 w-4 shrink-0" aria-label="Selecionado" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
