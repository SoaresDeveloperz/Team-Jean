'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { m, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Check, Dumbbell, Flag, Timer } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import type { AssignedWorkout } from '@/lib/types'
import { formatKg, getPlannedSets, normalizeRir } from '@/lib/workouts'
import { clearActiveSession, readActiveSession, saveActiveSession } from '@/lib/active-session'
import { loadFill, muscleLoad, splitSecondary, type MuscleRegion, type MuscleWork } from '@/lib/muscles'
import { usePreferences } from '@/lib/preferences'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { ProgressRing } from '@/components/ui/progress-ring'
import { useToast } from '@/components/ui/toast'
import { ElapsedTime } from '@/components/workout/session/ElapsedTime'
import { ExerciseBlock } from '@/components/workout/session/ExerciseBlock'
import { FinishSheet } from '@/components/workout/session/FinishSheet'
import { RestTimerBar } from '@/components/workout/session/RestTimerBar'
import { WorkoutSummary, type WorkoutSummaryData } from '@/components/workout/session/WorkoutSummary'
import { parseNumber, type ExerciseRow, type PreviousSet, type RestState, type SetEntry } from '@/components/workout/session/types'

type LoadState = { status: 'loading' } | { status: 'ready' } | { status: 'not-found' } | { status: 'error'; message: string }

type StoredSet = {
  id?: string
  assigned_exercise_id: string | null
  set_number: number
  weight_kg: number | null
  reps: number | null
}

const IDLE_REST: RestState = { endsAt: null, pausedRemaining: null, total: 0 }

function setKey(assignedExerciseId: string | null, setNumber: number) {
  return `${assignedExerciseId}:${setNumber}`
}

export default function WorkoutExecutionPage() {
  const { id: workoutId } = useParams<{ id: string }>()
  const router = useRouter()
  const toast = useToast()
  const reduceMotion = useReducedMotion()
  const { restSeconds } = usePreferences()
  const [supabase] = useState(() => createClient())

  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [workout, setWorkout] = useState<AssignedWorkout | null>(null)
  const [exercises, setExercises] = useState<ExerciseRow[]>([])
  const [sets, setSets] = useState<Record<string, SetEntry[]>>({})
  const [records, setRecords] = useState<Record<string, PreviousSet>>({})
  const [errorMessage, setErrorMessage] = useState('')
  // Início do treino: quando a tela abriu, ou o horário salvo ao retomar.
  const [startedAt, setStartedAt] = useState<number | null>(null)

  // A sessão no banco só é criada na primeira série concluída.
  const sessionIdRef = useRef<string | null>(null)
  const sessionPromiseRef = useRef<Promise<string> | null>(null)
  const setsRef = useRef(sets)

  const [rest, setRest] = useState<RestState>(IDLE_REST)
  const [showFinish, setShowFinish] = useState(false)
  const [rpe, setRpe] = useState(8)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState('')
  const [summary, setSummary] = useState<WorkoutSummaryData | null>(null)

  useEffect(() => {
    setsRef.current = sets
  }, [sets])

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
        // Últimos treinos concluídos do aluno: base do "anterior" e dos recordes.
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

      const resumedSets = (resumedSetsResult.data ?? []) as StoredSet[]
      const resumedByKey = new Map(resumedSets.map((row) => [setKey(row.assigned_exercise_id, row.set_number), row]))
      const previousByKey = new Map(
        ((previousSetsResult.data ?? []) as StoredSet[]).map((row) => [setKey(row.assigned_exercise_id, row.set_number), row]),
      )

      const bestInSession: Record<string, number> = {}
      const buildEntry = (
        row: ExerciseRow,
        setNumber: number,
        plan: { type: string; reps: string; rir: number | null },
        extra: boolean,
      ): SetEntry => {
        const saved = resumedByKey.get(setKey(row.id, setNumber))
        const previous = previousByKey.get(setKey(row.id, setNumber))
        const weight = Number(saved?.weight_kg) || 0
        const best = Math.max(pastRecords[row.exercise_id]?.weight ?? 0, bestInSession[row.exercise_id] ?? 0)
        const isPR = Boolean(saved) && weight > 0 && weight > best
        if (saved) bestInSession[row.exercise_id] = Math.max(bestInSession[row.exercise_id] ?? 0, weight)
        return {
          setNumber,
          type: plan.type,
          targetReps: plan.reps,
          targetRir: plan.rir,
          weight: saved ? String(saved.weight_kg ?? '') : '',
          reps: saved ? String(saved.reps ?? '') : '',
          previous: previous ? { weight: Number(previous.weight_kg) || 0, reps: Number(previous.reps) || 0 } : null,
          completed: Boolean(saved),
          rowId: saved?.id ?? null,
          saving: false,
          isPR,
          extra,
        }
      }

      const initialSets: Record<string, SetEntry[]> = {}
      for (const row of rows) {
        const planned = getPlannedSets(row).map((plan) => ({
          type: plan.type,
          reps: String(plan.reps || '8-12'),
          rir: normalizeRir(plan.rir),
        }))
        const entries = planned.map((plan, index) => buildEntry(row, index + 1, plan, false))
        // Séries extras já salvas (além do prescrito) voltam ao retomar.
        const extraNumbers = resumedSets
          .filter((set) => set.assigned_exercise_id === row.id && set.set_number > planned.length)
          .map((set) => set.set_number)
          .sort((first, second) => first - second)
        const lastPlan = planned[planned.length - 1] ?? { type: 'working', reps: '8-12', rir: null }
        for (const setNumber of extraNumbers) {
          entries.push(buildEntry(row, setNumber, { ...lastPlan, type: 'working' }, true))
        }
        initialSets[row.id] = entries
      }

      if (resumed && resumeCandidate) {
        sessionIdRef.current = resumed.id
        setStartedAt(resumeCandidate.startedAt)
      } else {
        setStartedAt(Date.now())
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

  const updateEntry = useCallback((rowId: string, index: number, patch: Partial<SetEntry>) => {
    setSets((previous) => ({
      ...previous,
      [rowId]: (previous[rowId] ?? []).map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry)),
    }))
  }, [])

  const startRest = useCallback((seconds: number) => {
    setRest({ endsAt: Date.now() + seconds * 1000, pausedRemaining: null, total: seconds })
  }, [])

  const ensureSession = useCallback(() => {
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
        sessionIdRef.current = data.id
        saveActiveSession({ userId, workoutId, sessionId: data.id, startedAt: startedAt ?? Date.now() })
        return data.id as string
      })()
    }
    return sessionPromiseRef.current
  }, [supabase, workoutId, userId, startedAt])

  const toggleSet = useCallback(
    async (rowId: string, index: number) => {
      const row = exercises.find((item) => item.id === rowId)
      const entry = setsRef.current[rowId]?.[index]
      if (!row || !entry || entry.saving) return
      setErrorMessage('')

      if (entry.completed) {
        // Desmarcar remove a série do banco.
        updateEntry(rowId, index, { completed: false, saving: true, isPR: false })
        if (entry.rowId) {
          const { data, error } = await supabase.from('session_sets').delete().eq('id', entry.rowId).select('id')
          if (error || !data?.length) {
            updateEntry(rowId, index, { completed: true, saving: false, isPR: entry.isPR })
            setErrorMessage('Não foi possível desmarcar a série. Verifique sua conexão.')
            return
          }
        }
        updateEntry(rowId, index, { saving: false, rowId: null })
        return
      }

      // Campos vazios usam o que aparece como sugestão (treino anterior / meta).
      const weightText = entry.weight.trim() || (entry.previous ? String(entry.previous.weight) : '')
      const repsText =
        entry.reps.trim() || (entry.previous ? String(entry.previous.reps) : String(parseInt(entry.targetReps, 10) || ''))
      const weight = Math.max(0, parseNumber(weightText))
      const reps = Math.max(0, Math.round(parseNumber(repsText)))

      if (reps <= 0) {
        setErrorMessage(`Informe as repetições feitas em ${row.exercises?.name ?? 'exercício'}.`)
        haptic([20, 40, 20])
        return
      }

      const sameExerciseBest = exercises
        .filter((item) => item.exercise_id === row.exercise_id)
        .flatMap((item) => (setsRef.current[item.id] ?? []).filter((other) => other.completed && other !== entry))
        .reduce((best, other) => Math.max(best, parseNumber(other.weight)), 0)
      const isPR = weight > 0 && weight > Math.max(records[row.exercise_id]?.weight ?? 0, sameExerciseBest)

      updateEntry(rowId, index, { completed: true, saving: true, weight: weightText, reps: String(reps), isPR })
      haptic(15)
      startRest(restSeconds)

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
        updateEntry(rowId, index, { saving: false, rowId: data.id })
        if (isPR) {
          haptic([30, 40, 90])
          toast({
            tone: 'gold',
            title: 'Novo recorde pessoal!',
            description: `${row.exercises?.name ?? 'Exercício'} · ${formatKg(weight)} kg × ${reps}`,
          })
        }
      } catch {
        updateEntry(rowId, index, { completed: false, saving: false, isPR: false })
        setRest(IDLE_REST)
        setErrorMessage('Não foi possível salvar a série. Verifique sua conexão e tente de novo.')
      }
    },
    [exercises, records, supabase, updateEntry, startRest, restSeconds, ensureSession, toast],
  )

  const addSet = useCallback((rowId: string) => {
    setSets((previous) => {
      const entries = previous[rowId] ?? []
      const last = entries[entries.length - 1]
      const setNumber = entries.reduce((max, entry) => Math.max(max, entry.setNumber), 0) + 1
      return {
        ...previous,
        [rowId]: [
          ...entries,
          {
            setNumber,
            type: 'working',
            targetReps: last?.targetReps ?? '8-12',
            targetRir: last?.targetRir ?? null,
            weight: '',
            reps: '',
            previous: null,
            completed: false,
            rowId: null,
            saving: false,
            isPR: false,
            extra: true,
          },
        ],
      }
    })
  }, [])

  const removeExtra = useCallback((rowId: string) => {
    setSets((previous) => {
      const entries = previous[rowId] ?? []
      const last = entries[entries.length - 1]
      if (!last?.extra || last.completed || last.saving) return previous
      return { ...previous, [rowId]: entries.slice(0, -1) }
    })
  }, [])

  const finishRest = useCallback(() => {
    setRest(IDLE_REST)
    haptic([200, 100, 200])
    toast({ tone: 'success', title: 'Descanso concluído', description: 'Bora pra próxima série!', duration: 2500 })
  }, [toast])

  const adjustRest = useCallback(
    (delta: number, remaining: number) => {
      const next = Math.max(0, remaining + delta)
      setRest((current) => {
        if (next === 0) return IDLE_REST
        if (current.pausedRemaining !== null) return { ...current, pausedRemaining: next, total: Math.max(current.total, next) }
        return { endsAt: Date.now() + next * 1000, pausedRemaining: null, total: Math.max(current.total, next) }
      })
    },
    [],
  )

  const toggleRestPause = useCallback((remaining: number) => {
    setRest((current) =>
      current.endsAt !== null
        ? { ...current, endsAt: null, pausedRemaining: remaining }
        : { ...current, endsAt: Date.now() + (current.pausedRemaining ?? 0) * 1000, pausedRemaining: null },
    )
  }, [])

  const skipRest = useCallback(() => setRest(IDLE_REST), [])
  const closeFinish = useCallback(() => setShowFinish(false), [])

  const progress = useMemo(() => {
    let done = 0
    let total = 0
    let volume = 0
    let saving = false
    let nextHint: string | null = null
    const perExercise: { id: string; name: string; done: number; total: number }[] = []

    for (const row of exercises) {
      const entries = sets[row.id] ?? []
      let exerciseDone = 0
      for (const entry of entries) {
        if (entry.completed) {
          exerciseDone += 1
          volume += parseNumber(entry.weight) * parseNumber(entry.reps)
        }
        if (entry.saving) saving = true
      }
      done += exerciseDone
      total += entries.length
      const nextIndex = entries.findIndex((entry) => !entry.completed)
      if (nextHint === null && nextIndex >= 0) {
        nextHint = `Próxima: ${row.exercises?.name ?? 'exercício'} · série ${nextIndex + 1} de ${entries.length}`
      }
      perExercise.push({ id: row.id, name: row.exercises?.name ?? 'Exercício', done: exerciseDone, total: entries.length })
    }

    const currentId = perExercise.find((item) => item.done < item.total)?.id ?? null
    return { done, total, volume, saving, nextHint, perExercise, currentId }
  }, [exercises, sets])

  const scrollToExercise = (rowId: string) => {
    document.getElementById(`exercise-${rowId}`)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }

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
      .update({ completed_at: completedAt.toISOString(), session_rpe: rpe, status: 'completed' })
      .eq('id', sessionId)
      .select('id')
      .maybeSingle()
    setFinishing(false)

    if (error || !data) {
      setFinishError('Não foi possível finalizar o treino. Tente novamente.')
      return
    }

    clearActiveSession()
    setRest(IDLE_REST)
    setShowFinish(false)

    const prs = new Map<string, { name: string; weight: number; reps: number }>()
    const work: MuscleWork[] = []
    for (const row of exercises) {
      for (const entry of sets[row.id] ?? []) {
        if (!entry.completed) continue
        work.push({ muscle: row.exercises?.muscle_group, amount: 1, exercise: row.exercises?.name })
        for (const muscle of splitSecondary(row.exercises?.secondary_muscle)) work.push({ muscle, amount: 0.5 })
        if (entry.isPR) {
          const name = row.exercises?.name ?? 'Exercício'
          const weight = parseNumber(entry.weight)
          const current = prs.get(name)
          if (!current || weight > current.weight) prs.set(name, { name, weight, reps: parseNumber(entry.reps) })
        }
      }
    }
    const regions = muscleLoad(work)
    const fills: Partial<Record<MuscleRegion, string>> = {}
    for (const [region, intensity] of Object.entries(regions) as [MuscleRegion, number][]) {
      fills[region] = loadFill(intensity)
    }

    setSummary({
      workoutName: workout?.name ?? 'Treino',
      volume: progress.volume,
      sets: progress.done,
      minutes: startedAt ? Math.max(1, Math.round((completedAt.getTime() - startedAt) / 60_000)) : null,
      rpe,
      prs: [...prs.values()],
      fills,
      regions,
    })
    window.scrollTo({ top: 0 })
  }

  if (loadState.status === 'loading') {
    return (
      <div className="space-y-4 pt-2" role="status" aria-label="Preparando treino">
        <Skeleton className="h-20 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    )
  }

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
            className="rounded-xl border border-line px-4 py-2.5 text-xs font-bold uppercase text-zinc-300"
          >
            Voltar
          </button>
        </div>
      </div>
    )
  }

  if (summary) {
    return (
      <WorkoutSummary
        data={summary}
        onDone={() => {
          router.replace('/student/today')
          router.refresh()
        }}
      />
    )
  }

  const progressPercent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="pb-40">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 border-b border-line bg-black/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex items-center gap-2 py-2.5">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Voltar (o progresso fica salvo)"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-zinc-300 hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate font-display text-xl font-bold uppercase leading-tight">{workout?.name}</h1>
            <p className="flex items-center justify-center gap-2 text-[11px] font-semibold text-zinc-400">
              <span className="flex items-center gap-1 text-brand">
                <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                {startedAt && <ElapsedTime startedAt={startedAt} />}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{formatKg(progress.volume)} kg</span>
            </p>
          </div>
          <m.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setFinishError('')
              setShowFinish(true)
            }}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-white px-4 text-xs font-black uppercase tracking-wider text-black"
          >
            <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Concluir
          </m.button>
        </div>

        <div
          className="h-1 overflow-hidden rounded-full bg-white/[0.06]"
          role="progressbar"
          aria-label="Séries concluídas"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <m.div
            className="h-full rounded-full bg-brand"
            initial={false}
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: 'spring', stiffness: 160, damping: 24 }}
          />
        </div>

        <nav aria-label="Exercícios do treino" className="no-scrollbar -mx-4 overflow-x-auto px-4 py-2.5">
          <ol className="flex gap-2">
            {progress.perExercise.map((item, index) => {
              const finished = item.total > 0 && item.done === item.total
              const current = item.id === progress.currentId
              return (
                <li key={item.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => scrollToExercise(item.id)}
                    aria-current={current ? 'step' : undefined}
                    className={cn(
                      'flex h-10 items-center gap-2 rounded-full border pl-1 pr-3 text-[11px] font-bold transition',
                      current ? 'border-white/30 bg-white/10 text-white' : 'border-line text-zinc-400',
                    )}
                  >
                    <ProgressRing value={item.total > 0 ? item.done / item.total : 0} size={30} stroke={3}>
                      {finished ? (
                        <Check className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
                      ) : (
                        <span className="text-[10px] font-black">{index + 1}</span>
                      )}
                    </ProgressRing>
                    <span className="max-w-[9rem] truncate">{item.name}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
      </div>

      <div className="mt-4 space-y-4">
        {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

        {exercises.length === 0 && (
          <div className="rounded-3xl border border-dashed border-line-strong p-8 text-center text-sm text-zinc-500">
            Este treino ainda não tem exercícios. Fale com seu treinador.
          </div>
        )}

        {exercises.map((row, index) => (
          <ExerciseBlock
            key={row.id}
            row={row}
            index={index}
            entries={sets[row.id] ?? []}
            record={records[row.exercise_id]}
            onChangeSet={updateEntry}
            onToggleSet={toggleSet}
            onAddSet={addSet}
            onRemoveExtra={removeExtra}
          />
        ))}

        {exercises.length > 0 && (
          <m.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setFinishError('')
              setShowFinish(true)
            }}
            className={cn(
              'flex h-16 w-full items-center justify-center gap-2 rounded-3xl text-sm font-black uppercase tracking-[0.18em] transition',
              progress.done === progress.total && progress.total > 0
                ? 'bg-brand text-black shadow-[0_10px_40px_rgba(52,211,153,0.25)]'
                : 'border border-line-strong bg-surface text-white',
            )}
          >
            <Flag className="h-4 w-4" aria-hidden="true" /> Finalizar treino
          </m.button>
        )}
      </div>

      <RestTimerBar
        rest={rest}
        nextHint={progress.nextHint}
        onAdjust={adjustRest}
        onTogglePause={toggleRestPause}
        onSkip={skipRest}
        onFinish={finishRest}
      />

      {startedAt && (
        <FinishSheet
          open={showFinish}
          onClose={closeFinish}
          startedAt={startedAt}
          done={progress.done}
          total={progress.total}
          volume={progress.volume}
          rpe={rpe}
          onRpeChange={setRpe}
          finishing={finishing}
          error={finishError}
          onConfirm={handleFinishWorkout}
        />
      )}
    </div>
  )
}
