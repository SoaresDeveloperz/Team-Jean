'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Check, CloudOff, CloudUpload, Dumbbell, Flag, Hourglass, Timer } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import type { AssignedWorkout } from '@/lib/types'
import { formatKg, getPlannedSets, normalizeRir, normalizeWeight } from '@/lib/workouts'
import {
  SHORT_SET_CAP,
  SHORT_STORAGE_KEY,
  canOfferShort,
  fullMinutes,
  hiddenSetIndexes,
  localDay,
  parseShortState,
  shortMinutes,
  type ShortRow,
  type ShortState,
} from '@/lib/short-workout'
import { PAIN_STORAGE_KEY, SWAP_STORAGE_KEY, canOfferSwap, parsePainFlag, parseSwapState, swapOptions, type SwapOption } from '@/lib/swap-exercise'
import {
  clearActiveSession,
  readActiveSession,
  readSessionJournal,
  saveActiveSession,
  saveSessionJournal,
  type JournalSet,
} from '@/lib/active-session'
import {
  clearSyncIssue,
  enqueueWorkoutOp,
  getWorkoutSyncState,
  hasQueuedOps,
  newId,
  pendingSetIds,
  queuedSessionState,
  sessionPending,
  startWorkoutSync,
  useOnlineStatus,
  useWorkoutSync,
  type FinishPatch,
} from '@/lib/workout-sync'
import {
  NotFoundError,
  OfflineError,
  cacheCurrentPage,
  fetchResumableSets,
  fetchWorkoutBundle,
  type LibraryExercise,
  readCachedBundle,
  saveCachedBundle,
  type StoredSet,
  type WorkoutBundle,
} from '@/lib/workout-session'
import { requestPushDelivery } from '@/lib/push/client'
import { loadFill, muscleLoad, splitSecondary, type MuscleRegion, type MuscleWork } from '@/lib/muscles'
import { usePreferences } from '@/lib/preferences'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/cn'
import { BarFill } from '@/components/ui/bar-fill'
import { friendlyError } from '@/lib/errors'
import { Alert } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { ProgressRing } from '@/components/ui/progress-ring'
import { useToast } from '@/components/ui/toast'
import { ElapsedTime } from '@/components/workout/session/ElapsedTime'
import { ExerciseBlock } from '@/components/workout/session/ExerciseBlock'
import { FinishSheet } from '@/components/workout/session/FinishSheet'
import { RestTimerBar } from '@/components/workout/session/RestTimerBar'
import { ShortWorkoutSheet } from '@/components/workout/session/ShortWorkoutSheet'
import { SwapExerciseSheet } from '@/components/workout/session/SwapExerciseSheet'
import { WorkoutSummary, type WorkoutSummaryData } from '@/components/workout/session/WorkoutSummary'
import { parseNumber, type ExerciseRow, type PreviousSet, type RestState, type SetEntry } from '@/components/workout/session/types'

type LoadState = { status: 'loading' } | { status: 'ready' } | { status: 'not-found' } | { status: 'error'; message: string }

const IDLE_REST: RestState = { endsAt: null, pausedRemaining: null, total: 0 }

function setKey(assignedExerciseId: string | null, setNumber: number) {
  return `${assignedExerciseId}:${setNumber}`
}

// Aplica as trocas de hoje: a linha do treino continua a mesma (mesmo id), só o
// exercício muda. `swappedFrom` guarda o que o treinador prescreveu.
function applySwaps(rows: ExerciseRow[], swaps: Record<string, string>, library: LibraryExercise[]): ExerciseRow[] {
  const byId = new Map(library.map((item) => [item.id, item]))
  return rows.map((row) => {
    const to = swaps[row.id] ? byId.get(swaps[row.id]) : undefined
    return to ? { ...row, exercise_id: to.id, exercises: to, swappedFrom: row.exercise_id } : row
  })
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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
  const [baseExercises, setBaseExercises] = useState<ExerciseRow[]>([])
  const [library, setLibrary] = useState<LibraryExercise[]>([])
  // "Trocar exercício": linha do treino → exercício escolhido hoje (vale neste aparelho).
  const [swaps, setSwaps] = useState<Record<string, string>>({})
  const [swapRowId, setSwapRowId] = useState<string | null>(null)
  const [swapKey, setSwapKey] = useState(0)
  const originalSetsRef = useRef<Record<string, SetEntry[]>>({})
  const exercises = useMemo(() => applySwaps(baseExercises, swaps, library), [baseExercises, swaps, library])
  const [sets, setSets] = useState<Record<string, SetEntry[]>>({})
  const [records, setRecords] = useState<Record<string, PreviousSet>>({})
  const [errorMessage, setErrorMessage] = useState('')
  // Início do treino: quando a tela abriu, ou o horário salvo ao retomar.
  const [startedAt, setStartedAt] = useState<number | null>(null)

  // A sessão só é criada na primeira série concluída (id gerado no aparelho).
  const sessionIdRef = useRef<string | null>(null)
  const setsRef = useRef(sets)
  const sync = useWorkoutSync()
  const online = useOnlineStatus()
  const pendingIds = useMemo(() => pendingSetIds(sync), [sync])
  const offline = !online || sync.offline

  const [rest, setRest] = useState<RestState>(IDLE_REST)
  const [showFinish, setShowFinish] = useState(false)
  const [rpe, setRpe] = useState(8)
  const [feedback, setFeedback] = useState('')
  const [feedbackTags, setFeedbackTags] = useState<string[]>([])
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState('')
  const [summary, setSummary] = useState<WorkoutSummaryData | null>(null)
  // Versão curta ("Tenho pouco tempo"): só esconde coisas na tela, nada muda na
  // prescrição nem nas séries. Vale para este treino e neste dia (aparelho).
  const [shortState, setShortState] = useState<ShortState | null>(null)
  const [shortOpen, setShortOpen] = useState(false)
  const [shortKey, setShortKey] = useState(0)
  const shortStripRef = useRef<HTMLDivElement>(null)
  const shortOfferRef = useRef<HTMLButtonElement>(null)
  // Sessão finalizada sem internet (ainda na fila ao mostrar o resumo).
  const [queuedSessionId, setQueuedSessionId] = useState<string | null>(null)

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
      // Envia o que ficou na fila de um treino anterior feito sem internet.
      void startWorkoutSync(supabase, user.id)

      // Retoma só a sessão iniciada neste aparelho nas últimas 12h.
      const activeSession = readActiveSession(user.id)
      const resumeCandidate = activeSession?.workoutId === workoutId ? activeSession : null

      let bundle: WorkoutBundle | null = null
      let serverSets: StoredSet[] | null = null
      let cached = false
      try {
        ;[bundle, serverSets] = await Promise.all([
          fetchWorkoutBundle(supabase, user.id, workoutId),
          resumeCandidate ? fetchResumableSets(supabase, user.id, resumeCandidate.sessionId) : Promise.resolve(null),
        ])
        saveCachedBundle(user.id, workoutId, bundle)
        cacheCurrentPage()
      } catch (error) {
        if (!active) return
        if (error instanceof NotFoundError) {
          setLoadState({ status: 'not-found' })
          return
        }
        if (!(error instanceof OfflineError)) {
          setLoadState({ status: 'error', message: friendlyError(error) })
          return
        }
        bundle = readCachedBundle(user.id, workoutId)
        if (!bundle) {
          setLoadState({ status: 'error', message: 'Sem internet, e este treino ainda não foi aberto neste aparelho.' })
          return
        }
        cached = true
      }
      if (!active) return

      // Séries já feitas na sessão retomada. Sem internet (ou com a sessão ainda
      // na fila) vale o diário do aparelho; com internet, o servidor mais o que
      // ainda não subiu.
      let resumedSets: StoredSet[] | null = null
      if (resumeCandidate) {
        const queued = queuedSessionState(user.id, resumeCandidate.sessionId)
        if (cached || (serverSets === null && queued.created)) {
          resumedSets = readSessionJournal(resumeCandidate.sessionId)
        } else if (serverSets !== null) {
          const known = new Set(serverSets.map((set) => set.id))
          resumedSets = [
            ...serverSets.filter((set) => !set.id || !queued.removed.has(set.id)),
            ...queued.sets.filter((set) => !known.has(set.id)),
          ]
        }
        if (resumedSets === null) clearActiveSession(true)
      }

      const baseRows = bundle.rows as ExerciseRow[]
      const libraryItems = bundle.library ?? []
      let restoredSwaps: Record<string, string> = {}
      try {
        restoredSwaps = parseSwapState(
          window.localStorage.getItem(SWAP_STORAGE_KEY),
          workoutId,
          localDay(),
          baseRows.map((row) => row.id),
          libraryItems.map((item) => item.id),
        )
      } catch {
        restoredSwaps = {}
      }
      const rows = applySwaps(baseRows, restoredSwaps, libraryItems)
      try {
        if (parsePainFlag(window.localStorage.getItem(PAIN_STORAGE_KEY), workoutId, localDay())) {
          setFeedbackTags((tags) => (tags.includes('Senti dor') ? tags : [...tags, 'Senti dor']))
        }
      } catch {
        // Sem armazenamento: o aviso vale até fechar a tela.
      }
      const pastRecords: Record<string, PreviousSet> = {}
      for (const row of bundle.recordSets) {
        const weight = Number(row.weight_kg) || 0
        const reps = Number(row.reps) || 0
        const current = pastRecords[row.exercise_id]
        if (!current || weight > current.weight || (weight === current.weight && reps > current.reps)) {
          pastRecords[row.exercise_id] = { weight, reps }
        }
      }

      const resumedByKey = new Map((resumedSets ?? []).map((row) => [setKey(row.assigned_exercise_id, row.set_number), row]))
      const previousByKey = new Map(bundle.previousSets.map((row) => [setKey(row.assigned_exercise_id, row.set_number), row]))

      const bestInSession: Record<string, number> = {}
      const buildEntry = (
        row: ExerciseRow,
        setNumber: number,
        plan: { type: string; reps: string; rir: number | null; weight: number | null },
        extra: boolean,
      ): SetEntry => {
        const saved = resumedByKey.get(setKey(row.id, setNumber))
        // Exercício trocado hoje: o "anterior" e a carga-alvo eram do outro exercício.
        const previous = row.swappedFrom ? undefined : previousByKey.get(setKey(row.id, setNumber))
        const weight = Number(saved?.weight_kg) || 0
        const best = Math.max(pastRecords[row.exercise_id]?.weight ?? 0, bestInSession[row.exercise_id] ?? 0)
        const isPR = !row.swappedFrom && Boolean(saved) && weight > 0 && weight > best
        if (saved) bestInSession[row.exercise_id] = Math.max(bestInSession[row.exercise_id] ?? 0, weight)
        return {
          setNumber,
          type: plan.type,
          targetReps: plan.reps,
          targetRir: plan.rir,
          targetWeight: plan.weight,
          weight: saved ? String(saved.weight_kg ?? '') : '',
          reps: saved ? String(saved.reps ?? '') : '',
          previous: previous ? { weight: Number(previous.weight_kg) || 0, reps: Number(previous.reps) || 0 } : null,
          completed: Boolean(saved),
          rowId: saved?.id ?? null,
          isPR,
          extra,
        }
      }

      const entriesFor = (row: ExerciseRow): SetEntry[] => {
        const planned = getPlannedSets(row).map((plan) => ({
          type: plan.type,
          reps: String(plan.reps || '8-12'),
          rir: normalizeRir(plan.rir),
          weight: row.swappedFrom ? null : normalizeWeight(plan.weight),
        }))
        const entries = planned.map((plan, index) => buildEntry(row, index + 1, plan, false))
        // Séries extras já salvas (além do prescrito) voltam ao retomar.
        const extraNumbers = (resumedSets ?? [])
          .filter((set) => set.assigned_exercise_id === row.id && set.set_number > planned.length)
          .map((set) => set.set_number)
          .sort((first, second) => first - second)
        const lastPlan = planned[planned.length - 1] ?? { type: 'working', reps: '8-12', rir: null, weight: null }
        for (const setNumber of extraNumbers) {
          entries.push(buildEntry(row, setNumber, { ...lastPlan, type: 'working' }, true))
        }
        return entries
      }
      const initialSets: Record<string, SetEntry[]> = {}
      const originalSets: Record<string, SetEntry[]> = {}
      for (const row of rows) {
        initialSets[row.id] = entriesFor(row)
        // Para "Voltar ao original": como a linha ficaria sem a troca.
        const base = row.swappedFrom ? baseRows.find((item) => item.id === row.id) : undefined
        originalSets[row.id] = base ? entriesFor(base) : initialSets[row.id]
      }
      originalSetsRef.current = originalSets

      if (resumedSets !== null && resumeCandidate) {
        sessionIdRef.current = resumeCandidate.sessionId
        setStartedAt(resumeCandidate.startedAt)
      } else {
        setStartedAt(Date.now())
      }
      let restoredShort: ShortState | null = null
      try {
        restoredShort = parseShortState(window.localStorage.getItem(SHORT_STORAGE_KEY), workoutId, localDay(), rows.map((row) => row.id))
      } catch {
        restoredShort = null
      }
      setShortState(restoredShort)
      // Link da tela Hoje ("Tenho pouco tempo"): abre o painel já na primeira vez.
      if (new URLSearchParams(window.location.search).get('curto') === '1') {
        window.history.replaceState(null, '', window.location.pathname)
        const lite: ShortRow[] = rows.map((row) => ({
          id: row.id,
          name: row.exercises?.name ?? 'Exercício',
          essential: Boolean(row.essential),
          sets: (initialSets[row.id] ?? []).map((entry) => ({ type: entry.type, completed: entry.completed, extra: entry.extra })),
        }))
        const anyDone = lite.some((row) => row.sets.some((entry) => entry.completed))
        if (!restoredShort && !anyDone && canOfferShort(lite)) {
          setShortKey((value) => value + 1)
          setShortOpen(true)
        }
      }
      setWorkout(bundle.workout as AssignedWorkout)
      setBaseExercises(baseRows)
      setLibrary(libraryItems)
      setSwaps(restoredSwaps)
      setRecords(pastRecords)
      setSets(initialSets)
      setLoadState({ status: 'ready' })
    }

    void load()
    return () => {
      active = false
    }
  }, [supabase, router, workoutId, reloadKey])

  // Diário das séries marcadas (retoma o treino neste aparelho mesmo sem internet).
  useEffect(() => {
    const sessionId = sessionIdRef.current
    if (!sessionId || loadState.status !== 'ready' || summary) return
    const journal: JournalSet[] = []
    for (const row of exercises) {
      for (const entry of sets[row.id] ?? []) {
        if (!entry.completed || !entry.rowId) continue
        journal.push({
          id: entry.rowId,
          assigned_exercise_id: row.id,
          set_number: entry.setNumber,
          weight_kg: parseNumber(entry.weight),
          reps: Math.round(parseNumber(entry.reps)),
        })
      }
    }
    saveSessionJournal(sessionId, journal)
  }, [sets, exercises, loadState.status, summary])

  const updateEntry = useCallback((rowId: string, index: number, patch: Partial<SetEntry>) => {
    setSets((previous) => ({
      ...previous,
      [rowId]: (previous[rowId] ?? []).map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry)),
    }))
  }, [])

  const startRest = useCallback((seconds: number) => {
    setRest({ endsAt: Date.now() + seconds * 1000, pausedRemaining: null, total: seconds })
  }, [])

  // Cria a sessão na fila (sem esperar o servidor) na primeira série marcada.
  const ensureSession = useCallback(() => {
    if (sessionIdRef.current) return sessionIdRef.current
    if (!userId) return null
    const id = newId()
    sessionIdRef.current = id
    saveActiveSession({ userId, workoutId, sessionId: id, startedAt: startedAt ?? Date.now() })
    void enqueueWorkoutOp(supabase, userId, {
      kind: 'session',
      row: { id, assigned_workout_id: workoutId, student_id: userId, status: 'in_progress' },
    })
    return id
  }, [supabase, workoutId, userId, startedAt])

  const toggleSet = useCallback(
    (rowId: string, index: number) => {
      const row = exercises.find((item) => item.id === rowId)
      const entry = setsRef.current[rowId]?.[index]
      if (!row || !entry || !userId) return
      setErrorMessage('')
      clearSyncIssue()

      if (entry.completed) {
        // Desmarcar remove a série (ou só a tira da fila, se ainda não subiu).
        updateEntry(rowId, index, { completed: false, isPR: false, rowId: null })
        if (entry.rowId && sessionIdRef.current) {
          void enqueueWorkoutOp(supabase, userId, { kind: 'unset', id: entry.rowId, sessionId: sessionIdRef.current })
        }
        return
      }

      // Campos vazios usam o que aparece como sugestão (meta do treinador,
      // treino anterior ou repetições da meta).
      const suggestedWeight = entry.targetWeight ?? entry.previous?.weight ?? null
      const weightText = entry.weight.trim() || (suggestedWeight !== null ? String(suggestedWeight) : '')
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
      const isPR = !row.swappedFrom && weight > 0 && weight > Math.max(records[row.exercise_id]?.weight ?? 0, sameExerciseBest)

      const sessionId = ensureSession()
      if (!sessionId) return
      const setId = newId()
      updateEntry(rowId, index, { completed: true, weight: weightText, reps: String(reps), isPR, rowId: setId })
      haptic(15)
      startRest(restSeconds)
      void enqueueWorkoutOp(supabase, userId, {
        kind: 'set',
        row: {
          id: setId,
          session_id: sessionId,
          exercise_id: row.exercise_id,
          assigned_exercise_id: row.id,
          set_number: entry.setNumber,
          weight_kg: weight,
          reps,
          rir: entry.targetRir,
          set_type: entry.type,
          completed: true,
        },
      })
      if (isPR) {
        haptic([30, 40, 90])
        toast({
          tone: 'gold',
          title: 'Novo recorde pessoal!',
          description: `${row.exercises?.name ?? 'Exercício'} · ${formatKg(weight)} kg × ${reps}`,
        })
      }
    },
    [exercises, records, supabase, userId, updateEntry, startRest, restSeconds, ensureSession, toast],
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
            targetWeight: last?.targetWeight ?? null,
            weight: '',
            reps: '',
            previous: null,
            completed: false,
            rowId: null,
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
      if (!last?.extra || last.completed) return previous
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

  const hiddenRows = useMemo(() => new Set(shortState?.hidden ?? []), [shortState])
  const shortCap = shortState ? shortState.cap : null
  const visibleExercises = useMemo(() => exercises.filter((row) => !hiddenRows.has(row.id)), [exercises, hiddenRows])

  const progress = useMemo(() => {
    let done = 0
    let total = 0
    let volume = 0
    let nextHint: string | null = null
    const perExercise: { id: string; name: string; done: number; total: number }[] = []

    for (const row of visibleExercises) {
      const entries = sets[row.id] ?? []
      const hiddenIndexes = shortCap === null ? null : hiddenSetIndexes(entries, shortCap)
      let exerciseDone = 0
      let exerciseTotal = 0
      let nextOrdinal = -1
      entries.forEach((entry, index) => {
        if (hiddenIndexes?.has(index)) return
        exerciseTotal += 1
        if (entry.completed) {
          exerciseDone += 1
          volume += parseNumber(entry.weight) * parseNumber(entry.reps)
        } else if (nextOrdinal < 0) {
          nextOrdinal = exerciseTotal
        }
      })
      done += exerciseDone
      total += exerciseTotal
      if (nextHint === null && nextOrdinal > 0) {
        nextHint = `Próxima: ${row.exercises?.name ?? 'exercício'} · série ${nextOrdinal} de ${exerciseTotal}`
      }
      perExercise.push({ id: row.id, name: row.exercises?.name ?? 'Exercício', done: exerciseDone, total: exerciseTotal })
    }

    const currentId = perExercise.find((item) => item.done < item.total)?.id ?? null
    return { done, total, volume, nextHint, perExercise, currentId }
  }, [visibleExercises, sets, shortCap])

  // Treino todo (sem corte) em números simples, para decidir se oferece a versão curta.
  const shortRows = useMemo<ShortRow[]>(
    () =>
      exercises.map((row) => ({
        id: row.id,
        name: row.exercises?.name ?? 'Exercício',
        essential: Boolean(row.essential),
        sets: (sets[row.id] ?? []).map((entry) => ({ type: entry.type, completed: entry.completed, extra: entry.extra })),
      })),
    [exercises, sets],
  )
  const shortOffer = shortState === null && progress.done === 0 && canOfferShort(shortRows)

  const openShort = useCallback(() => {
    setShortKey((value) => value + 1)
    setShortOpen(true)
  }, [])

  // O botão que abriu o painel some ao confirmar: o foco vai para onde o aluno continua.
  const focusLater = (target: () => HTMLElement | null) => {
    window.setTimeout(() => {
      const element = target()
      if (!element) return
      if (!element.hasAttribute('tabindex') && !['BUTTON', 'A', 'INPUT'].includes(element.tagName)) element.setAttribute('tabindex', '-1')
      element.focus({ preventScroll: false })
    }, 120)
  }
  const closeShort = () => {
    setShortOpen(false)
    focusLater(() => shortOfferRef.current)
  }

  const applyShort = (hidden: string[]) => {
    const next: ShortState = { workoutId, day: localDay(), hidden, cap: SHORT_SET_CAP }
    setShortState(next)
    setShortOpen(false)
    try {
      window.localStorage.setItem(SHORT_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Sem armazenamento: a versão curta vale até fechar a tela.
    }
    toast({ tone: 'info', title: 'Versão curta ligada', description: 'Dá para desfazer logo acima dos exercícios.', duration: 8000 })
    focusLater(() => shortStripRef.current)
  }

  const undoShort = () => {
    setShortState(null)
    try {
      window.localStorage.removeItem(SHORT_STORAGE_KEY)
    } catch {
      // Nada a limpar.
    }
    toast({ tone: 'info', title: 'Treino completo de volta', duration: 3000 })
    focusLater(() => shortOfferRef.current ?? document.getElementById(`exercise-${exercises[0]?.id}`))
  }

  // ---- Trocar exercício (só para hoje, só antes da primeira série do exercício).
  // Opções por linha: não mudam a cada tecla digitada, só quando a troca muda.
  const swapOptionsByRow = useMemo(() => {
    const taken = new Set(exercises.map((row) => row.exercise_id))
    const byRow: Record<string, SwapOption[]> = {}
    for (const base of baseExercises) {
      byRow[base.id] = swapOptions({
        original: { exercise_id: base.exercise_id, muscle_group: base.exercises?.muscle_group },
        essential: base.essential,
        alternatives: base.alternatives,
        library,
        taken,
      })
    }
    return byRow
  }, [baseExercises, exercises, library])

  const openSwap = useCallback((rowId: string) => {
    setSwapKey((value) => value + 1)
    setSwapRowId(rowId)
  }, [])

  const saveSwaps = (next: Record<string, string>) => {
    try {
      if (Object.keys(next).length === 0) window.localStorage.removeItem(SWAP_STORAGE_KEY)
      else window.localStorage.setItem(SWAP_STORAGE_KEY, JSON.stringify({ workoutId, day: localDay(), swaps: next }))
    } catch {
      // Sem armazenamento: a troca vale até fechar a tela.
    }
  }

  const closeSwap = () => {
    const rowId = swapRowId
    setSwapRowId(null)
    focusLater(() => document.querySelector<HTMLElement>(`#exercise-${rowId} [data-swap-button]`) ?? document.getElementById(`exercise-${rowId}`))
  }

  const pickSwap = (option: SwapOption, pain: boolean) => {
    const rowId = swapRowId
    if (!rowId || (setsRef.current[rowId] ?? []).some((entry) => entry.completed)) return
    const next = { ...swaps, [rowId]: option.id }
    setSwaps(next)
    saveSwaps(next)
    // O "anterior" e a carga-alvo eram do outro exercício.
    setSets((previous) => ({
      ...previous,
      [rowId]: (previous[rowId] ?? []).map((entry) => ({ ...entry, previous: null, targetWeight: null })),
    }))
    // Troca por dor: o recado "Senti dor" já vem marcado ao finalizar (o Jean fica sabendo).
    if (pain) {
      setFeedbackTags((tags) => (tags.includes('Senti dor') ? tags : [...tags, 'Senti dor']))
      try {
        window.localStorage.setItem(PAIN_STORAGE_KEY, JSON.stringify({ workoutId, day: localDay() }))
      } catch {
        // Sem armazenamento: o aviso vale até fechar a tela.
      }
    }
    setSwapRowId(null)
    toast({
      tone: 'info',
      title: `Trocado por ${option.name}`,
      description: pain ? 'O Jean vai receber o aviso de dor quando você finalizar.' : 'Vale só para hoje.',
      duration: pain ? 10000 : 5000,
    })
    focusLater(() => document.querySelector<HTMLElement>(`#exercise-${rowId} h2`))
  }

  const restoreSwap = () => {
    const rowId = swapRowId
    if (!rowId || (setsRef.current[rowId] ?? []).some((entry) => entry.completed)) return
    const next = { ...swaps }
    delete next[rowId]
    setSwaps(next)
    saveSwaps(next)
    const original = originalSetsRef.current[rowId]
    if (original) setSets((previous) => ({ ...previous, [rowId]: original }))
    setSwapRowId(null)
    toast({ tone: 'info', title: 'Exercício original de volta', duration: 3000 })
    focusLater(() => document.querySelector<HTMLElement>(`#exercise-${rowId} h2`))
  }

  const scrollToExercise = (rowId: string) => {
    document.getElementById(`exercise-${rowId}`)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }

  const handleFinishWorkout = async () => {
    setFinishError('')
    const sessionId = sessionIdRef.current
    if (!sessionId || progress.done === 0 || !userId) {
      setFinishError('Marque pelo menos uma série concluída antes de finalizar.')
      return
    }

    setFinishing(true)
    const completedAt = new Date()
    const swappedDone = exercises.filter((row) => row.swappedFrom && (sets[row.id] ?? []).some((entry) => entry.completed)).length
    const note = feedback.trim()
    const withFeedback = note.length > 0 || feedbackTags.length > 0
    const patch: FinishPatch = {
      completed_at: completedAt.toISOString(),
      session_rpe: rpe,
      status: 'completed',
      ...(withFeedback ? { feedback: note || null, feedback_tags: feedbackTags } : {}),
      // Só quando o aluno fez a versão curta (o treinador vê no histórico).
      ...(shortState ? { short_mode: true } : {}),
      // Quantos exercícios foram trocados (e feitos) hoje; o Jean vê no histórico.
      ...(swappedDone > 0 ? { swaps: swappedDone } : {}),
    }
    const sending = enqueueWorkoutOp(supabase, userId, { kind: 'finish', sessionId, patch })
    // Com internet, espera o envio (até 8 s) para confirmar. Sem internet, o
    // treino fica na fila e sobe sozinho depois.
    await Promise.race([sending, wait(8000)])
    setFinishing(false)
    const issue = getWorkoutSyncState().issue
    if (issue) {
      clearSyncIssue()
      setFinishError(issue)
      return
    }
    const queued = hasQueuedOps(sessionId)
    // Recado novo: o treinador recebe o aviso (e o push, se ativado).
    if (!queued && withFeedback) requestPushDelivery()

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

    setQueuedSessionId(queued ? sessionId : null)
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
    const stillQueued = queuedSessionId !== null && sessionPending(sync, queuedSessionId)
    return (
      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {queuedSessionId !== null && (
            <m.div
              key="sync-state"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="status"
              className={cn(
                'flex items-start gap-3 rounded-2xl border px-4 py-3 text-xs leading-relaxed',
                stillQueued ? 'border-gold/25 bg-gold-soft text-gold' : 'border-brand/25 bg-brand-soft text-brand',
              )}
            >
              {stillQueued ? (
                <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              {stillQueued
                ? 'Treino salvo no aparelho. Ele vai para o seu histórico assim que a internet voltar (pode fechar o app).'
                : 'Conexão de volta: treino enviado para o seu histórico.'}
            </m.div>
          )}
        </AnimatePresence>
        <WorkoutSummary
          data={summary}
          onDone={() => {
            router.replace('/student/today')
            router.refresh()
          }}
        />
      </div>
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
            <p className="flex items-center justify-center gap-2 text-xs font-semibold text-zinc-400">
              <span className="flex items-center gap-1 text-brand">
                <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                {startedAt && <ElapsedTime startedAt={startedAt} />}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{formatKg(progress.volume)} kg</span>
              {(offline || pendingIds.size > 0) && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className={cn('flex items-center gap-1', offline ? 'text-gold' : 'text-zinc-400')} role="status">
                    {offline ? (
                      <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {offline ? 'Offline' : 'Enviando'}
                    {pendingIds.size > 0 && <span className="sr-only">: {pendingIds.size} série(s) aguardando envio</span>}
                  </span>
                </>
              )}
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
          <BarFill value={progressPercent / 100} className="bg-brand" />
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
                      'flex h-11 items-center gap-2 rounded-full border pl-1 pr-3 text-xs font-bold transition',
                      current ? 'border-white/30 bg-white/10 text-white' : 'border-line text-zinc-400',
                    )}
                  >
                    <ProgressRing value={item.total > 0 ? item.done / item.total : 0} size={30} stroke={3}>
                      {finished ? (
                        <Check className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
                      ) : (
                        <span className="text-xs font-black">{index + 1}</span>
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
        {offline && (
          <p className="flex items-start gap-2.5 rounded-2xl border border-gold/25 bg-gold-soft px-4 py-3 text-xs leading-relaxed text-gold">
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Sem internet: pode treinar normalmente. As séries ficam salvas no aparelho e sobem sozinhas quando a conexão voltar.
          </p>
        )}
        {/* Erro da tela ou algo que o servidor recusou ao sincronizar. */}
        {(errorMessage || sync.issue) && <Alert variant="error">{errorMessage || sync.issue}</Alert>}

        {exercises.length === 0 && (
          <div className="rounded-3xl border border-dashed border-line-strong p-8 text-center text-sm text-zinc-500">
            Este treino ainda não tem exercícios. Fale com seu treinador.
          </div>
        )}

        {shortOffer && (
          <button
            ref={shortOfferRef}
            type="button"
            onClick={openShort}
            className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line-strong bg-surface px-4 py-2.5 text-left transition hover:bg-white/5"
          >
            <Hourglass className="h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white">Tenho pouco tempo</span>
              <span className="block text-xs text-zinc-300">Fazer uma versão mais curta só hoje (cerca de {shortMinutes(shortRows, new Set(), SHORT_SET_CAP)} min em vez de {fullMinutes(shortRows)})</span>
            </span>
          </button>
        )}

        {shortState && (
          <div ref={shortStripRef} tabIndex={-1} role="status" className="flex items-center gap-3 rounded-2xl border border-gold/25 bg-gold-soft px-4 py-2 outline-none focus-visible:ring-2 focus-visible:ring-gold/60">
            <Hourglass className="h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-sm font-semibold text-gold">
              Versão curta de hoje · cerca de {shortMinutes(shortRows, hiddenRows, shortState.cap)} min
            </p>
            <button
              type="button"
              onClick={undoShort}
              className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-bold text-white underline-offset-4 hover:underline"
            >
              Desfazer
            </button>
          </div>
        )}

        {visibleExercises.map((row, index) => (
          <ExerciseBlock
            key={row.id}
            row={row}
            index={index}
            shortCap={shortCap}
            entries={sets[row.id] ?? []}
            record={records[row.exercise_id]}
            pendingIds={pendingIds}
            onChangeSet={updateEntry}
            onToggleSet={toggleSet}
            onAddSet={addSet}
            onRemoveExtra={removeExtra}
            onSwap={
              canOfferSwap(swapOptionsByRow[row.id] ?? [], (sets[row.id] ?? []).filter((entry) => entry.completed).length)
                ? openSwap
                : undefined
            }
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

      <ShortWorkoutSheet key={shortKey} open={shortOpen} onClose={closeShort} rows={shortRows} onConfirm={applyShort} />

      {swapRowId && (
        <SwapExerciseSheet
          key={swapKey}
          open
          onClose={closeSwap}
          originalName={baseExercises.find((row) => row.id === swapRowId)?.exercises?.name ?? 'exercício'}
          swapped={Boolean(swaps[swapRowId])}
          options={swapOptionsByRow[swapRowId] ?? []}
          onPick={pickSwap}
          onRestore={restoreSwap}
        />
      )}

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
          feedback={feedback}
          onFeedbackChange={setFeedback}
          tags={feedbackTags}
          onTagsChange={setFeedbackTags}
          offline={offline}
          finishing={finishing}
          error={finishError}
          onConfirm={handleFinishWorkout}
        />
      )}
    </div>
  )
}
