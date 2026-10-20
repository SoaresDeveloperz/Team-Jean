'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Dumbbell, TrendingUp, Trophy } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import { Alert } from '@/components/ui/alert'
import { PageLoader } from '@/components/ui/page-loader'

type ExerciseOption = { id: string; name: string; muscle_group: string | null }

type SetRow = {
  session_id: string
  weight_kg: number | null
  reps: number | null
  created_at: string | null
}

type SessionBest = {
  sessionId: string
  date: string
  weight: number
  reps: number
}

const MAX_SESSIONS = 10

// Fórmula de Epley para estimar a carga máxima de 1 repetição.
function estimateOneRepMax(weight: number, reps: number) {
  if (weight <= 0 || reps <= 0) return 0
  return reps === 1 ? weight : weight * (1 + reps / 30)
}

function formatKg(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)
}

function groupBestSetPerSession(rows: SetRow[]) {
  const bySession = new Map<string, SessionBest>()

  for (const row of rows) {
    const weight = Number(row.weight_kg) || 0
    const reps = Number(row.reps) || 0
    const current = bySession.get(row.session_id)

    if (!current) {
      bySession.set(row.session_id, { sessionId: row.session_id, date: row.created_at ?? '', weight, reps })
    } else if (weight > current.weight || (weight === current.weight && reps > current.reps)) {
      current.weight = weight
      current.reps = reps
    }
  }

  return [...bySession.values()].sort((first, second) => first.date.localeCompare(second.date))
}

export default function StudentProgressPage() {
  const [supabase] = useState(() => createClient())
  const [userId, setUserId] = useState<string | null>(null)
  const [exercises, setExercises] = useState<ExerciseOption[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [sessions, setSessions] = useState<SessionBest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingChart, setLoadingChart] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const requestId = useRef(0)

  // Lista apenas exercícios que o treinador prescreveu para este aluno.
  useEffect(() => {
    let active = true

    const loadExercises = async () => {
      const user = await getCurrentUser(supabase)
      if (!active || !user) return
      setUserId(user.id)

      const [{ data, error }, { data: lastSet }] = await Promise.all([
        supabase
          .from('assigned_workout_exercises')
          .select('exercise_id, exercises(id, name, muscle_group), assigned_workouts!inner(student_id)')
          .eq('assigned_workouts.student_id', user.id),
        // Abre a tela no último exercício treinado.
        supabase
          .from('session_sets')
          .select('exercise_id, workout_sessions!inner(student_id)')
          .eq('workout_sessions.student_id', user.id)
          .eq('completed', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (!active) return
      if (error) {
        setErrorMessage(`Não foi possível carregar seus exercícios: ${error.message}`)
        setLoading(false)
        return
      }

      const unique = new Map<string, ExerciseOption>()
      for (const row of (data ?? []) as unknown as { exercises: ExerciseOption | null }[]) {
        if (row.exercises) unique.set(row.exercises.id, row.exercises)
      }
      const options = [...unique.values()].sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'))

      const lastExerciseId = (lastSet as { exercise_id: string } | null)?.exercise_id
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
    if (!userId || !selectedExerciseId) return
    const currentRequest = ++requestId.current

    const loadProgress = async () => {
      setLoadingChart(true)
      const { data, error } = await supabase
        .from('session_sets')
        .select('session_id, weight_kg, reps, created_at, workout_sessions!inner(student_id)')
        .eq('workout_sessions.student_id', userId)
        .eq('exercise_id', selectedExerciseId)
        .eq('completed', true)
        .order('created_at', { ascending: false })
        .limit(200)

      // Ignora respostas de um exercício que já não está selecionado.
      if (currentRequest !== requestId.current) return

      if (error) {
        setErrorMessage(`Não foi possível carregar sua evolução: ${error.message}`)
        setSessions([])
      } else {
        setErrorMessage('')
        setSessions(groupBestSetPerSession((data ?? []) as SetRow[]).slice(-MAX_SESSIONS))
      }
      setLoadingChart(false)
    }

    void loadProgress()
  }, [supabase, userId, selectedExerciseId])

  const stats = useMemo(() => {
    if (sessions.length === 0) return null
    const best = sessions.reduce((top, session) => (session.weight > top.weight ? session : top), sessions[0])
    const bestOneRepMax = Math.max(...sessions.map((session) => estimateOneRepMax(session.weight, session.reps)))
    const change = sessions[sessions.length - 1].weight - sessions[0].weight
    return { best, bestOneRepMax, change }
  }, [sessions])

  const maxWeight = Math.max(1, ...sessions.map((session) => session.weight))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-wide">Evolução</h1>
        <p className="text-xs font-medium text-zinc-500">Melhor série de cada treino, por exercício</p>
      </div>

      {loading ? (
        <PageLoader label="Carregando" />
      ) : exercises.length === 0 ? (
        <div className="space-y-3 rounded-3xl border border-zinc-900 bg-zinc-950 p-8 text-center">
          <Dumbbell className="mx-auto h-10 w-10 text-zinc-700" aria-hidden="true" />
          <p className="text-sm font-semibold text-zinc-400">Seu treinador ainda não prescreveu exercícios.</p>
          {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <label htmlFor="progress-exercise" className="mb-1 block text-xs font-semibold uppercase text-zinc-400">
              Exercício
            </label>
            <select
              id="progress-exercise"
              value={selectedExerciseId}
              onChange={(event) => setSelectedExerciseId(event.target.value)}
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm font-bold text-white focus:border-white focus:outline-none"
            >
              {exercises.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                  {exercise.muscle_group ? ` (${exercise.muscle_group})` : ''}
                </option>
              ))}
            </select>
          </div>

          {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

          {stats && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-3">
                <p className="flex items-center gap-1 text-[9px] font-black uppercase text-zinc-500">
                  <Trophy className="h-3 w-3 text-amber-400" aria-hidden="true" /> Recorde
                </p>
                <p className="mt-1 text-base font-black">{formatKg(stats.best.weight)} kg</p>
                <p className="text-[10px] text-zinc-500">× {stats.best.reps} reps</p>
              </div>
              <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-3">
                <p className="text-[9px] font-black uppercase text-zinc-500">1RM estimado</p>
                <p className="mt-1 text-base font-black">{formatKg(stats.bestOneRepMax)} kg</p>
                <p className="text-[10px] text-zinc-500">Epley</p>
              </div>
              <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-3">
                <p className="flex items-center gap-1 text-[9px] font-black uppercase text-zinc-500">
                  <TrendingUp className="h-3 w-3 text-emerald-400" aria-hidden="true" /> Variação
                </p>
                <p
                  className={`mt-1 text-base font-black ${stats.change > 0 ? 'text-emerald-400' : stats.change < 0 ? 'text-rose-400' : ''}`}
                >
                  {stats.change > 0 ? '+' : ''}
                  {formatKg(stats.change)} kg
                </p>
                <p className="text-[10px] text-zinc-500">{sessions.length} treinos</p>
              </div>
            </div>
          )}

          <div className="space-y-4 rounded-3xl border border-zinc-900 bg-zinc-950 p-6">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">
              Carga (kg) nos últimos {MAX_SESSIONS} treinos
            </h2>

            {loadingChart && sessions.length === 0 ? (
              <PageLoader label="Carregando cargas" />
            ) : sessions.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-600">
                Nenhum registro de carga para este exercício ainda.
              </p>
            ) : (
              <div
                className={`flex h-48 items-end gap-2 border-b border-zinc-900 px-1 pb-2 pt-6 transition-opacity ${loadingChart ? 'opacity-50' : ''}`}
              >
                {sessions.map((session) => {
                  const heightPct = Math.max(8, (session.weight / maxWeight) * 100)
                  const isBest = stats?.best.sessionId === session.sessionId
                  return (
                    <div key={session.sessionId} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                      <span className="text-[10px] font-black text-white">{formatKg(session.weight)}</span>
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full rounded-t-lg transition-all ${isBest ? 'bg-emerald-400' : 'bg-white'}`}
                        title={`${formatKg(session.weight)} kg × ${session.reps} reps`}
                      />
                      <span className="text-[9px] font-bold text-zinc-600">
                        {session.date
                          ? new Date(session.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                          : '--'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
