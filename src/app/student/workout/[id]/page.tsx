'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  Clock,
  Dumbbell,
  Info,
  LoaderCircle,
  Minus,
  Pause,
  Play,
  Plus,
  Share2,
  Timer,
  Trophy,
  X,
} from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import type { AssignedWorkout, Exercise, PrescribedExercise } from '@/lib/types'
import { formatKg, formatSeconds, getPlannedSets, getSetTypeInfo, normalizeRir } from '@/lib/workouts'
import { clearActiveSession, readActiveSession, saveActiveSession } from '@/lib/active-session'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { PageLoader } from '@/components/ui/page-loader'
import { Logo } from '@/components/ui/logo'
import { ExerciseMedia } from '@/components/workout/ExerciseMedia'

type ExerciseRow = PrescribedExercise & { exercises: Exercise | null }

type PreviousSet = { weight: number; reps: number }

type SetEntry = {
  setNumber: number
  type: string
  targetReps: string
  targetRir: number | null
  weight: string
  reps: string
  previous: PreviousSet | null
  completed: boolean
  rowId: string | null
  saving: boolean
  isPR: boolean
}

type LoadState = { status: 'loading' } | { status: 'ready' } | { status: 'not-found' } | { status: 'error'; message: string }

type Summary = { volume: number; sets: number; prs: number; minutes: number | null }

const DEFAULT_REST_SECONDS = 90

function parseNumber(value: string) {
  const number = Number(value.replace(',', '.'))
  return Number.isFinite(number) ? number : 0
}

function setKey(assignedExerciseId: string | null, setNumber: number) {
  return `${assignedExerciseId}:${setNumber}`
}

export default function WorkoutExecutionPage() {
  const { id: workoutId } = useParams<{ id: string }>()
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [workout, setWorkout] = useState<AssignedWorkout | null>(null)
  const [exercises, setExercises] = useState<ExerciseRow[]>([])
  const [sets, setSets] = useState<Record<string, SetEntry[]>>({})
  const [records, setRecords] = useState<Record<string, PreviousSet>>({})
  const [errorMessage, setErrorMessage] = useState('')

  // Sessão criada só na primeira série concluída (antes era criada ao abrir a tela).
  const sessionIdRef = useRef<string | null>(null)
  const sessionPromiseRef = useRef<Promise<string> | null>(null)
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null)

  // Cronômetro baseado no horário de término: não atrasa quando o celular
  // bloqueia a tela e o navegador desacelera os intervalos.
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null)
  const [pausedRemaining, setPausedRemaining] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const [showFinishModal, setShowFinishModal] = useState(false)
  const [sessionRpe, setSessionRpe] = useState(8)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [shareMessage, setShareMessage] = useState('')

  useEffect(() => {
    let active = true

    const load = async () => {
      const user = await getCurrentUser(supabase)
      if (!active) return
      if (!user) {
        router.replace('/login')
        return
      }
      setUserId(user.id)

      // Retoma só a sessão iniciada neste aparelho nas últimas 12h.
      const activeSession = readActiveSession(user.id)
      const resumeCandidate = activeSession?.workoutId === workoutId ? activeSession : null

      const [workoutResult, exercisesResult, resumableResult, completedSessionsResult] = await Promise.all([
        supabase.from('assigned_workouts').select('*').eq('id', workoutId).maybeSingle(),
        supabase
          .from('assigned_workout_exercises')
          .select('*, exercises(*)')
          .eq('assigned_workout_id', workoutId)
          .order('order', { ascending: true }),
        resumeCandidate
          ? supabase
              .from('workout_sessions')
              .select('id, status')
              .eq('id', resumeCandidate.sessionId)
              .eq('student_id', user.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        // Últimos treinos concluídos do aluno: base do "último treino" e dos recordes.
        supabase
          .from('workout_sessions')
          .select('id, assigned_workout_id')
          .eq('student_id', user.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(100),
      ])
      if (!active) return

      const firstError = workoutResult.error ?? exercisesResult.error
      if (firstError) {
        setLoadState({ status: 'error', message: firstError.message })
        return
      }
      if (!workoutResult.data) {
        setLoadState({ status: 'not-found' })
        return
      }

      const rows = (exercisesResult.data ?? []) as ExerciseRow[]
      const resumableRow = resumableResult.data as { id: string; status: string } | null
      const resumed = resumableRow?.status === 'in_progress' ? resumableRow : null
      if (resumeCandidate && !resumed) clearActiveSession()
      const completedSessions = (completedSessionsResult.data ?? []) as { id: string; assigned_workout_id: string }[]
      const lastCompleted = completedSessions.find((session) => session.assigned_workout_id === workoutId) ?? null
      const exerciseIds = [...new Set(rows.map((row) => row.exercise_id))]

      const [resumedSetsResult, previousSetsResult, recordSetsResult] = await Promise.all([
        resumed
          ? supabase
              .from('session_sets')
              .select('id, assigned_exercise_id, set_number, weight_kg, reps')
              .eq('session_id', resumed.id)
              .eq('completed', true)
          : Promise.resolve({ data: [], error: null }),
        lastCompleted
          ? supabase
              .from('session_sets')
              .select('assigned_exercise_id, set_number, weight_kg, reps')
              .eq('session_id', lastCompleted.id)
              .eq('completed', true)
          : Promise.resolve({ data: [], error: null }),
        // Recorde de cada exercício considerando só os treinos deste aluno.
        completedSessions.length > 0 && exerciseIds.length > 0
          ? supabase
              .from('session_sets')
              .select('exercise_id, weight_kg, reps')
              .in(
                'session_id',
                completedSessions.map((session) => session.id),
              )
              .in('exercise_id', exerciseIds)
              .eq('completed', true)
              .order('weight_kg', { ascending: false })
              .limit(1000)
          : Promise.resolve({ data: [], error: null }),
      ])
      if (!active) return

      const pastRecords: Record<string, PreviousSet> = {}
      for (const row of (recordSetsResult.data ?? []) as { exercise_id: string; weight_kg: number | null; reps: number | null }[]) {
        const weight = Number(row.weight_kg) || 0
        const reps = Number(row.reps) || 0
        const current = pastRecords[row.exercise_id]
        if (!current || weight > current.weight || (weight === current.weight && reps > current.reps)) {
          pastRecords[row.exercise_id] = { weight, reps }
        }
      }

      type StoredSet = { id?: string; assigned_exercise_id: string | null; set_number: number; weight_kg: number | null; reps: number | null }
      const resumedByKey = new Map(
        ((resumedSetsResult.data ?? []) as StoredSet[]).map((row) => [setKey(row.assigned_exercise_id, row.set_number), row]),
      )
      const previousByKey = new Map(
        ((previousSetsResult.data ?? []) as StoredSet[]).map((row) => [setKey(row.assigned_exercise_id, row.set_number), row]),
      )

      const bestInSession: Record<string, number> = {}
      const initialSets: Record<string, SetEntry[]> = {}
      for (const row of rows) {
        initialSets[row.id] = getPlannedSets(row).map((plan, index) => {
          const setNumber = index + 1
          const saved = resumedByKey.get(setKey(row.id, setNumber))
          const previous = previousByKey.get(setKey(row.id, setNumber))
          const weight = Number(saved?.weight_kg) || 0
          const best = Math.max(pastRecords[row.exercise_id]?.weight ?? 0, bestInSession[row.exercise_id] ?? 0)
          const isPR = Boolean(saved) && weight > 0 && weight > best
          if (saved) bestInSession[row.exercise_id] = Math.max(bestInSession[row.exercise_id] ?? 0, weight)

          return {
            setNumber,
            type: plan.type,
            targetReps: String(plan.reps || '8-12'),
            targetRir: normalizeRir(plan.rir),
            weight: saved ? String(saved.weight_kg ?? '') : '',
            reps: saved ? String(saved.reps ?? '') : '',
            previous: previous ? { weight: Number(previous.weight_kg) || 0, reps: Number(previous.reps) || 0 } : null,
            completed: Boolean(saved),
            rowId: saved?.id ?? null,
            saving: false,
            isPR,
          }
        })
      }

      if (resumed && resumeCandidate) {
        sessionIdRef.current = resumed.id
        setSessionStartedAt(resumeCandidate.startedAt)
      }
      setWorkout(workoutResult.data as AssignedWorkout)
      setExercises(rows)
      setRecords(pastRecords)
      setSets(initialSets)
      setLoadState({ status: 'ready' })
    }

    void load()
    return () => {
      active = false
    }
  }, [supabase, router, workoutId, reloadKey])

  // Atualiza o relógio só enquanto o descanso está correndo.
  useEffect(() => {
    if (restEndsAt === null) return
    const interval = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= restEndsAt) {
        setRestEndsAt(null)
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200])
      }
    }, 250)
    return () => window.clearInterval(interval)
  }, [restEndsAt])

  const restRemaining =
    pausedRemaining ?? (restEndsAt !== null ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0)
  const restRunning = restEndsAt !== null

  const startRest = (seconds = DEFAULT_REST_SECONDS) => {
    setPausedRemaining(null)
    setNow(Date.now())
    setRestEndsAt(Date.now() + seconds * 1000)
  }

  const adjustRest = (deltaSeconds: number) => {
    const next = Math.max(0, restRemaining + deltaSeconds)
    if (pausedRemaining !== null) {
      setPausedRemaining(next > 0 ? next : null)
    } else if (next > 0) {
      startRest(next)
    } else {
      setRestEndsAt(null)
    }
  }

  const toggleRestPause = () => {
    if (restRunning) {
      setPausedRemaining(restRemaining)
      setRestEndsAt(null)
    } else if (pausedRemaining !== null) {
      startRest(pausedRemaining)
    }
  }

  const stopRest = () => {
    setRestEndsAt(null)
    setPausedRemaining(null)
  }

  const updateEntry = useCallback((assignedId: string, index: number, patch: Partial<SetEntry>) => {
    setSets((previous) => ({
      ...previous,
      [assignedId]: (previous[assignedId] ?? []).map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    }))
  }, [])

  const ensureSession = () => {
    if (sessionIdRef.current) return Promise.resolve(sessionIdRef.current)

    if (!sessionPromiseRef.current) {
      sessionPromiseRef.current = (async () => {
        const { data, error } = await supabase
          .from('workout_sessions')
          .insert({ assigned_workout_id: workoutId, student_id: userId, status: 'in_progress' })
          .select('id')
          .single()

        if (error || !data || !userId) {
          sessionPromiseRef.current = null
          throw new Error(error?.message ?? 'Não foi possível iniciar a sessão.')
        }
        const startedAt = Date.now()
        sessionIdRef.current = data.id
        setSessionStartedAt(startedAt)
        saveActiveSession({ userId, workoutId, sessionId: data.id, startedAt })
        return data.id as string
      })()
    }
    return sessionPromiseRef.current
  }

  const toggleSet = async (row: ExerciseRow, index: number) => {
    const entry = sets[row.id]?.[index]
    if (!entry || entry.saving) return
    setErrorMessage('')

    if (entry.completed) {
      // Desmarcar remove a série do banco (antes ela continuava salva).
      updateEntry(row.id, index, { completed: false, saving: true, isPR: false })
      if (entry.rowId) {
        const { data, error } = await supabase.from('session_sets').delete().eq('id', entry.rowId).select('id')
        if (error || !data?.length) {
          updateEntry(row.id, index, { completed: true, saving: false, isPR: entry.isPR })
          setErrorMessage('Não foi possível desmarcar a série. Verifique sua conexão.')
          return
        }
      }
      updateEntry(row.id, index, { saving: false, rowId: null })
      return
    }

    // Campos vazios usam o que aparece como sugestão (treino anterior / meta).
    const weightText = entry.weight.trim() || (entry.previous ? String(entry.previous.weight) : '')
    const repsText = entry.reps.trim() || (entry.previous ? String(entry.previous.reps) : String(parseInt(entry.targetReps, 10) || ''))
    const weight = Math.max(0, parseNumber(weightText))
    const reps = Math.max(0, Math.round(parseNumber(repsText)))

    if (reps <= 0) {
      setErrorMessage(`Informe as repetições feitas na série ${entry.setNumber} de ${row.exercises?.name ?? 'exercício'}.`)
      return
    }

    const sameExerciseBest = exercises
      .filter((item) => item.exercise_id === row.exercise_id)
      .flatMap((item) => (sets[item.id] ?? []).filter((other) => other.completed && other !== entry))
      .reduce((best, other) => Math.max(best, parseNumber(other.weight)), 0)
    const isPR = weight > 0 && weight > Math.max(records[row.exercise_id]?.weight ?? 0, sameExerciseBest)

    updateEntry(row.id, index, { completed: true, saving: true, weight: weightText, reps: String(reps), isPR })
    startRest()

    try {
      const sessionId = await ensureSession()
      const { data, error } = await supabase
        .from('session_sets')
        .insert({
          session_id: sessionId,
          exercise_id: row.exercise_id,
          assigned_exercise_id: row.id,
          set_number: entry.setNumber,
          weight_kg: weight,
          reps,
          rir: entry.targetRir,
          set_type: entry.type,
          completed: true,
        })
        .select('id')
        .single()

      if (error || !data) throw new Error(error?.message)
      updateEntry(row.id, index, { saving: false, rowId: data.id })
      if (isPR && 'vibrate' in navigator) navigator.vibrate(80)
    } catch {
      updateEntry(row.id, index, { completed: false, saving: false, isPR: false })
      setErrorMessage('Não foi possível salvar a série. Verifique sua conexão e tente de novo.')
    }
  }

  const progress = useMemo(() => {
    const all = Object.values(sets).flat()
    const done = all.filter((entry) => entry.completed)
    return {
      total: all.length,
      done: done.length,
      volume: done.reduce((total, entry) => total + parseNumber(entry.weight) * parseNumber(entry.reps), 0),
      prs: done.filter((entry) => entry.isPR).length,
      saving: all.some((entry) => entry.saving),
    }
  }, [sets])

  const closeFinishModal = useCallback(() => setShowFinishModal(false), [])

  const handleFinishWorkout = async () => {
    setFinishError('')
    if (progress.saving) {
      setFinishError('Aguarde as séries terminarem de salvar.')
      return
    }
    const sessionId = sessionIdRef.current
    if (!sessionId || progress.done === 0) {
      setFinishError('Marque pelo menos uma série concluída antes de finalizar.')
      return
    }

    setFinishing(true)
    const completedAt = new Date()
    const { data, error } = await supabase
      .from('workout_sessions')
      .update({ completed_at: completedAt.toISOString(), session_rpe: sessionRpe, status: 'completed' })
      .eq('id', sessionId)
      .select('id')
      .maybeSingle()
    setFinishing(false)

    if (error || !data) {
      setFinishError('Não foi possível finalizar o treino. Tente novamente.')
      return
    }

    stopRest()
    clearActiveSession()
    setShowFinishModal(false)
    setSummary({
      volume: progress.volume,
      sets: progress.done,
      prs: progress.prs,
      minutes: sessionStartedAt
        ? Math.max(1, Math.round((completedAt.getTime() - sessionStartedAt) / 60_000))
        : null,
    })
  }

  const handleShare = async () => {
    if (!summary) return
    const text =
      `Treino "${workout?.name}" concluído! 💪\n` +
      `Volume: ${formatKg(summary.volume)} kg · ${summary.sets} séries` +
      (summary.prs > 0 ? ` · ${summary.prs} recorde(s)` : '') +
      '\n@teamjean'

    try {
      if (navigator.share) {
        await navigator.share({ title: 'Team Jean', text })
        return
      }
      await navigator.clipboard.writeText(text)
      setShareMessage('Resumo copiado! Cole nos stories e marque @teamjean.')
    } catch {
      // Compartilhamento cancelado pelo usuário.
    }
  }

  if (loadState.status === 'loading') return <PageLoader label="Preparando treino" />

  if (loadState.status === 'not-found' || loadState.status === 'error') {
    return (
      <div className="space-y-4 py-16 text-center">
        <Dumbbell className="mx-auto h-10 w-10 text-zinc-700" aria-hidden="true" />
        <p className="text-sm font-semibold text-zinc-400">
          {loadState.status === 'not-found' ? 'Treino não encontrado.' : 'Não foi possível carregar o treino.'}
        </p>
        {loadState.status === 'error' && <Alert variant="error">{loadState.message}</Alert>}
        <div className="flex justify-center gap-2">
          {loadState.status === 'error' && (
            <button
              type="button"
              onClick={() => {
                setLoadState({ status: 'loading' })
                setReloadKey((key) => key + 1)
              }}
              className="rounded-xl bg-white px-4 py-2.5 text-xs font-black uppercase text-black"
            >
              Tentar de novo
            </button>
          )}
          <button
            type="button"
            onClick={() => router.replace('/student/today')}
            className="rounded-xl border border-zinc-800 px-4 py-2.5 text-xs font-bold uppercase text-zinc-300"
          >
            Voltar
          </button>
        </div>
      </div>
    )
  }

  if (summary) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center py-8">
        <div className="relative w-full space-y-6 overflow-hidden rounded-3xl border-2 border-zinc-800 bg-black p-6 text-center shadow-2xl">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-[70px]" aria-hidden="true" />
          <div className="relative space-y-2">
            <Logo className="mx-auto h-12 w-12" />
            <h1 className="text-2xl font-black uppercase tracking-wider text-white">Treino concluído!</h1>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">{workout?.name}</p>
          </div>

          <div className="relative grid grid-cols-2 gap-3 border-y border-zinc-900 py-4">
            {[
              { label: 'Volume total', value: `${formatKg(summary.volume)} kg` },
              { label: 'Séries', value: String(summary.sets) },
              { label: 'Duração', value: summary.minutes ? `${summary.minutes} min` : '—' },
              { label: 'Esforço (RPE)', value: `${sessionRpe}/10` },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-zinc-900 bg-zinc-950 p-3">
                <span className="block text-[9px] font-black uppercase text-zinc-500">{stat.label}</span>
                <span className="text-lg font-black text-white">{stat.value}</span>
              </div>
            ))}
          </div>

          {summary.prs > 0 && (
            <p className="relative flex items-center justify-center gap-2 text-sm font-black uppercase text-amber-300">
              <Trophy className="h-4 w-4 text-amber-400" aria-hidden="true" />
              {summary.prs} {summary.prs === 1 ? 'novo recorde' : 'novos recordes'}!
            </p>
          )}

          {shareMessage && <Alert variant="success">{shareMessage}</Alert>}

          <div className="relative space-y-3 pt-2">
            <button
              type="button"
              onClick={handleShare}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white p-4 text-xs font-black uppercase text-black transition-all active:scale-95"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" /> Compartilhar
            </button>
            <button
              type="button"
              onClick={() => {
                router.replace('/student/today')
                router.refresh()
              }}
              className="w-full rounded-2xl bg-zinc-900 p-3 text-xs font-bold uppercase text-zinc-400"
            >
              Voltar para o app
            </button>
          </div>
        </div>
      </div>
    )
  }

  const progressPercent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className={cn('space-y-5', restRemaining > 0 ? 'pb-36' : 'pb-10')}>
      <div className="sticky top-0 z-30 -mx-4 border-b border-zinc-900 bg-black/90 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Voltar (o progresso fica salvo)"
            className="rounded-xl p-2 text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="h-6 w-6" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-base font-black uppercase tracking-wide">{workout?.name}</h1>
            <p className="text-[10px] font-extrabold uppercase text-emerald-400">
              {progress.done}/{progress.total} séries · {formatKg(progress.volume)} kg
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFinishError('')
              setShowFinishModal(true)
            }}
            className="rounded-xl bg-white px-3.5 py-2 text-xs font-extrabold uppercase text-black shadow-lg"
          >
            Concluir
          </button>
        </div>
        <div
          className="mt-3 h-1 overflow-hidden rounded-full bg-zinc-900"
          role="progressbar"
          aria-label="Séries concluídas"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

      {exercises.length === 0 && (
        <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-950 p-8 text-center text-sm text-zinc-500">
          Este treino ainda não tem exercícios. Fale com seu treinador.
        </div>
      )}

      {exercises.map((row) => {
        const record = records[row.exercise_id]
        const entries = sets[row.id] ?? []

        return (
          <section
            key={row.id}
            aria-label={row.exercises?.name ?? 'Exercício'}
            className="space-y-4 overflow-hidden rounded-3xl border border-zinc-900 bg-zinc-950 p-5"
          >
            <ExerciseMedia
              muscleGroup={row.exercises?.muscle_group}
              videoUrl={row.exercises?.video_url}
              imageUrl={row.exercises?.image_url}
              name={row.exercises?.name}
            />

            <div className="flex items-start justify-between gap-3 border-b border-zinc-900 pb-3">
              <div className="min-w-0">
                <h2 className="text-base font-black text-white">{row.exercises?.name ?? 'Exercício'}</h2>
                <p className="mt-0.5 text-xs font-bold uppercase text-zinc-500">{row.exercises?.muscle_group}</p>
              </div>
              {record && record.weight > 0 && (
                <div className="shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-right">
                  <span className="block text-[9px] font-bold uppercase text-zinc-500">Seu recorde</span>
                  <span className="text-xs font-extrabold text-emerald-400">
                    {formatKg(record.weight)}kg × {record.reps}
                  </span>
                </div>
              )}
            </div>

            {row.notes && (
              <div className="flex items-start gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
                <p className="whitespace-pre-line text-xs font-medium text-zinc-300">{row.notes}</p>
              </div>
            )}

            <div className="space-y-3">
              {entries.map((entry, index) => {
                const badge = getSetTypeInfo(entry.type)
                const weightId = `weight-${row.id}-${index}`
                const repsId = `reps-${row.id}-${index}`
                const locked = entry.completed || entry.saving

                return (
                  <div
                    key={entry.setNumber}
                    className={cn(
                      'space-y-2 rounded-2xl border p-3 transition-all',
                      entry.completed ? 'border-emerald-800/40 bg-emerald-950/20' : 'border-zinc-800/60 bg-zinc-900/80',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black text-zinc-400">#{entry.setNumber}</span>
                        <span className={cn('rounded-md border px-2 py-0.5 text-[9px] font-black uppercase', badge.className)}>
                          {badge.badge}
                        </span>
                        {entry.isPR && entry.completed && (
                          <span className="flex items-center gap-1 rounded-md border border-amber-600/50 bg-amber-950/80 px-2 py-0.5 text-[9px] font-black uppercase text-amber-300">
                            <Trophy className="h-3 w-3 text-amber-400" aria-hidden="true" /> Novo PR!
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] font-bold text-zinc-400">
                        Meta: {entry.targetReps} reps
                        {entry.targetRir !== null && ` · RIR ${entry.targetRir}`}
                      </span>
                    </div>

                    <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 pt-1">
                      <div>
                        <label htmlFor={weightId} className="mb-1 block text-[8px] font-bold uppercase text-zinc-500">
                          Carga (kg)
                        </label>
                        <input
                          id={weightId}
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={entry.weight}
                          disabled={locked}
                          onChange={(event) => updateEntry(row.id, index, { weight: event.target.value })}
                          placeholder={entry.previous ? formatKg(entry.previous.weight) : '0'}
                          className="w-full rounded-xl border border-zinc-800 bg-black p-2.5 text-center text-sm font-extrabold text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none disabled:opacity-70"
                        />
                      </div>
                      <div>
                        <label htmlFor={repsId} className="mb-1 block text-[8px] font-bold uppercase text-zinc-500">
                          Reps feitas
                        </label>
                        <input
                          id={repsId}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="off"
                          value={entry.reps}
                          disabled={locked}
                          onChange={(event) => updateEntry(row.id, index, { reps: event.target.value })}
                          placeholder={entry.previous ? String(entry.previous.reps) : entry.targetReps}
                          className="w-full rounded-xl border border-zinc-800 bg-black p-2.5 text-center text-sm font-extrabold text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none disabled:opacity-70"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleSet(row, index)}
                        disabled={entry.saving}
                        aria-pressed={entry.completed}
                        aria-label={
                          entry.completed
                            ? `Desmarcar série ${entry.setNumber}`
                            : `Marcar série ${entry.setNumber} como concluída`
                        }
                        className={cn(
                          'flex h-[42px] w-14 items-center justify-center rounded-xl font-bold transition-all',
                          entry.completed ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500',
                        )}
                      >
                        {entry.saving ? (
                          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Check className="h-5 w-5 stroke-[3]" aria-hidden="true" />
                        )}
                      </button>
                    </div>

                    {entry.previous && !entry.completed && (
                      <p className="text-[9px] font-semibold text-zinc-600">
                        Último treino: {formatKg(entry.previous.weight)} kg × {entry.previous.reps}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {restRemaining > 0 && (
        <div
          role="timer"
          aria-label="Tempo de descanso"
          className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-2xl border border-zinc-700/80 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur-lg"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-400">
                <Timer className={cn('h-5 w-5', restRunning && 'animate-pulse')} aria-hidden="true" />
              </div>
              <div>
                <span className="block text-[9px] font-black uppercase tracking-widest text-zinc-400">Descanso</span>
                <span className="text-xl font-black tabular-nums text-white">{formatSeconds(restRemaining)}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => adjustRest(-15)}
                aria-label="Menos 15 segundos"
                className="rounded-lg bg-zinc-800 p-2 text-zinc-300"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => adjustRest(30)}
                aria-label="Mais 30 segundos"
                className="flex items-center rounded-lg bg-zinc-800 px-2 py-2 text-xs font-bold text-zinc-300"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                30s
              </button>
              <button
                type="button"
                onClick={toggleRestPause}
                aria-label={restRunning ? 'Pausar descanso' : 'Continuar descanso'}
                className="rounded-lg bg-white p-2 text-black"
              >
                {restRunning ? (
                  <Pause className="h-4 w-4 fill-black" aria-hidden="true" />
                ) : (
                  <Play className="h-4 w-4 fill-black" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                onClick={stopRest}
                aria-label="Pular descanso"
                className="rounded-lg bg-zinc-800 p-2 text-zinc-400"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-zinc-800" aria-hidden="true">
            <div
              className="h-full rounded-full bg-emerald-400 transition-[width] duration-300"
              style={{ width: `${Math.min(100, (restRemaining / DEFAULT_REST_SECONDS) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <Modal
        open={showFinishModal}
        onClose={closeFinishModal}
        title="Finalizar treino"
        description="Qual foi o esforço (RPE) da sessão?"
      >
        <div className="space-y-6">
          <div className="space-y-3 text-center">
            <span className="text-4xl font-black text-white">{sessionRpe} / 10</span>
            <input
              type="range"
              min={1}
              max={10}
              value={sessionRpe}
              onChange={(event) => setSessionRpe(Number(event.target.value))}
              aria-label="RPE da sessão"
              className="w-full accent-white"
            />
            <div className="flex justify-between text-[9px] font-bold uppercase text-zinc-600">
              <span>Leve</span>
              <span>Máximo</span>
            </div>
          </div>

          <p className="flex items-center justify-center gap-1.5 text-xs text-zinc-500">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {progress.done} de {progress.total} séries concluídas
          </p>

          {finishError && <Alert variant="error">{finishError}</Alert>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={closeFinishModal}
              className="w-1/2 rounded-xl bg-zinc-900 p-4 text-xs font-bold uppercase text-zinc-400"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleFinishWorkout}
              disabled={finishing}
              className="flex w-1/2 items-center justify-center rounded-xl bg-white p-4 text-xs font-extrabold uppercase text-black disabled:opacity-60"
            >
              {finishing ? <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Finalizando" /> : 'Concluir'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
