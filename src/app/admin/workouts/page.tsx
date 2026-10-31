'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Check,
  ChevronDown,
  FolderKanban,
  History,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { WEEKDAY_NAMES, WEEKDAY_ORDER, isWeekday, orderWorkouts, weekdayThisWeek } from '@/lib/week-plan'
import type { AssignedWorkout, Exercise, PlannedSet, PrescribedExercise, Profile, WorkoutSession } from '@/lib/types'
import { avatarUrlOf } from '@/lib/profile'
import { createDefaultPlannedSets, getPlannedSets, normalizeRir, normalizeWeight } from '@/lib/workouts'
import { requestPushDelivery } from '@/lib/push/client'
import { plural } from '@/lib/text'
import { summarizePrescription, summarizeWork, summaryLine, type WorkoutSummary } from '@/lib/workout-summary'
import { cn } from '@/lib/cn'
import { friendlyError } from '@/lib/errors'
import { Body3D } from '@/components/fitness/Body3D'
import { MuscleMap } from '@/components/fitness/MuscleMap'
import { BuilderExerciseCard, type BuilderExercise, type BuilderSet } from '@/components/admin/BuilderExerciseCard'
import { ExercisePicker } from '@/components/admin/ExercisePicker'
import { SWAP_MAX_ALTERNATIVES } from '@/lib/swap-exercise'
import { ReorderList } from '@/components/admin/ReorderList'
import { WorkoutHistory, groupHistory, type HistorySession, type HistorySet } from '@/components/admin/WorkoutHistory'
import { Alert } from '@/components/ui/alert'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Avatar } from '@/components/ui/avatar'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Modal, SheetFooter } from '@/components/ui/modal'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/toast'
import { Eyebrow } from '@/components/ui/tile'

type TemplateWithMeta = { id: string; name: string }
const NO_EXERCISES: ReadonlySet<string> = new Set()

type BuilderMode = { kind: 'workout' | 'template'; editingId: string | null }
type Tab = 'students' | 'templates'
type SummaryRow = Pick<PrescribedExercise, 'id' | 'planned_sets' | 'sets_count' | 'target_reps' | 'exercises'> & {
  assigned_workout_id?: string
  template_id?: string
}
type ConfirmState = { title: string; description: string; confirmLabel: string; run: () => Promise<void> }

const WORKOUT_SUMMARY_COLUMNS = 'id, assigned_workout_id, sets_count, target_reps, planned_sets, exercises(*)'
const TEMPLATE_SUMMARY_COLUMNS = 'id, template_id, sets_count, target_reps, planned_sets, exercises(*)'

const inputClassName =
  'w-full rounded-2xl border border-line-strong bg-black/40 p-3.5 text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none'
const labelClassName = 'mb-1.5 block text-xs font-black uppercase tracking-[0.1em] text-zinc-400'
const ease = [0.22, 1, 0.36, 1] as const

const normalizeText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

function groupSummaries(rows: SummaryRow[], parentKey: 'assigned_workout_id' | 'template_id', ids: string[]) {
  const byParent = new Map<string, SummaryRow[]>(ids.map((id) => [id, []]))
  for (const row of rows) {
    const list = row[parentKey] ? byParent.get(row[parentKey] as string) : undefined
    if (list) list.push(row)
  }
  const result: Record<string, WorkoutSummary> = {}
  for (const [id, list] of byParent) result[id] = summarizePrescription(list)
  return result
}

function IconButton({
  label,
  onClick,
  disabled,
  tone = 'default',
  dataMove,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'brand' | 'danger'
  // Identifica o botão de ordem para devolver o foco a ele depois de mover.
  dataMove?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-move={dataMove}
      aria-label={label}
      title={label}
      className={cn(
        'grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-black/30 transition disabled:opacity-40',
        tone === 'brand' && 'text-brand hover:border-brand/40 hover:bg-brand-soft',
        tone === 'danger' && 'text-zinc-500 hover:border-danger/40 hover:bg-danger-soft hover:text-danger',
        tone === 'default' && 'text-zinc-300 hover:border-line-strong hover:text-white',
      )}
    >
      {children}
    </button>
  )
}

function SummaryMap({ summary, className }: { summary: WorkoutSummary | undefined; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('shrink-0 rounded-2xl bg-black/40 p-1.5', className)}>
      {summary ? (
        <MuscleMap fills={summary.fills} animated={false} />
      ) : (
        <Skeleton className="aspect-square w-full rounded-xl" />
      )}
    </div>
  )
}

export default function AdminWorkoutsPage() {
  const [supabase] = useState(() => createClient())
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const toast = useToast()

  // Links da ficha do aluno: ?aluno=ID abre o acordeão dele; ?novo=ID abre o
  // construtor já com o aluno escolhido.
  const [deepLink] = useState(() => ({ aluno: searchParams.get('aluno'), novo: searchParams.get('novo') }))
  const deepLinkHandled = useRef(false)

  const [activeTab, setActiveTab] = useState<Tab>('students')
  const [workouts, setWorkouts] = useState<AssignedWorkout[]>([])
  const [templates, setTemplates] = useState<TemplateWithMeta[]>([])
  const [students, setStudents] = useState<Profile[]>([])
  const [exerciseLibrary, setExerciseLibrary] = useState<Exercise[]>([])
  const [summaries, setSummaries] = useState<Record<string, WorkoutSummary>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    deepLink.aluno ? { [deepLink.aluno]: true } : {},
  )
  const [highlightId, setHighlightId] = useState<string | null>(deepLink.aluno)

  const [historyWorkout, setHistoryWorkout] = useState<AssignedWorkout | null>(null)
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState('')

  const [builder, setBuilder] = useState<BuilderMode | null>(() =>
    deepLink.novo ? { kind: 'workout', editingId: null } : null,
  )
  const [selectedStudent, setSelectedStudent] = useState(deepLink.novo ?? '')
  const [workoutName, setWorkoutName] = useState('')
  const [selectedExercises, setSelectedExercises] = useState<BuilderExercise[]>([])
  const [originalRowIds, setOriginalRowIds] = useState<string[]>([])
  const [notifyStudent, setNotifyStudent] = useState(true)
  const [reordering, setReordering] = useState(false)
  const [builderError, setBuilderError] = useState('')
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showExPicker, setShowExPicker] = useState(false)
  // supabase/trocar-exercicio.sql já rodou? (colunas "essential" e "alternatives")
  const [swapSql, setSwapSql] = useState(false)
  const [altKey, setAltKey] = useState<string | null>(null)
  // supabase/rotina-semanal.sql já rodou? (colunas "weekday" e "position")
  const [rotinaSql, setRotinaSql] = useState(false)
  // ... e a coluna do descanso rotativo (parte mais nova do mesmo arquivo)?
  const [rotateSql, setRotateSql] = useState(false)
  // Dia da semana do treino aberto no construtor ('' = sem dia fixo).
  const [workoutDay, setWorkoutDay] = useState('')
  // Aluno cujos treinos estão sendo reordenados (trava os botões até salvar).
  const [movingStudent, setMovingStudent] = useState<string | null>(null)
  // Dia escolhido no seletor: salva depois de uma pausa (setas do teclado não salvam cada dia que passam).
  const dayTimers = useRef(new Map<string, { before: number | null; timer: number }>())
  const keyCounter = useRef(0)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [templateToAssign, setTemplateToAssign] = useState<TemplateWithMeta | null>(null)
  const [assignStudentId, setAssignStudentId] = useState('')
  const [assignSearch, setAssignSearch] = useState('')
  const [assignNotify, setAssignNotify] = useState(true)
  const [assignError, setAssignError] = useState('')
  const [assigning, setAssigning] = useState(false)

  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const reload = () => setReloadKey((key) => key + 1)

  useEffect(() => {
    let active = true
    void supabase
      .from('assigned_workouts')
      .select('weekday, position')
      .limit(1)
      .then(({ error }) => {
        if (active) setRotinaSql(!error)
      })
    void supabase
      .from('assigned_workouts')
      .select('rotate_days')
      .limit(1)
      .then(({ error }) => {
        if (active) setRotateSql(!error)
      })
    return () => {
      active = false
    }
  }, [supabase])

  useEffect(() => {
    let active = true
    void supabase
      .from('workout_template_exercises')
      .select('essential, alternatives')
      .limit(1)
      .then(({ error }) => {
        if (active) setSwapSql(!error)
      })
    return () => {
      active = false
    }
  }, [supabase])

  useEffect(() => {
    if (searchParams.get('aluno') || searchParams.get('novo')) router.replace(pathname, { scroll: false })
  }, [searchParams, router, pathname])

  useEffect(() => {
    let active = true

    const load = async () => {
      const [workoutsResult, templatesResult, studentsResult, exercisesResult, templateRowsResult] = await Promise.all([
        supabase
          .from('assigned_workouts')
          .select('*, profiles(full_name, email)')
          .order('created_at', { ascending: false }),
        supabase.from('workout_templates').select('id, name').order('name'),
        // select('*'): a foto (avatar_path) só existe depois do profile.sql.
        supabase.from('profiles').select('*').eq('role', 'student').order('full_name'),
        supabase.from('exercises').select('*').order('name'),
        supabase.from('workout_template_exercises').select(TEMPLATE_SUMMARY_COLUMNS).limit(1000),
      ])
      if (!active) return

      const error = workoutsResult.error ?? templatesResult.error ?? studentsResult.error ?? exercisesResult.error
      if (error) {
        setLoadError(friendlyError(error, 'Não foi possível carregar os dados'))
        setLoading(false)
        return
      }

      const workoutList = (workoutsResult.data ?? []) as AssignedWorkout[]
      const templateList = (templatesResult.data ?? []) as TemplateWithMeta[]
      setLoadError('')
      setWorkouts(workoutList)
      setTemplates(templateList)
      setStudents((studentsResult.data ?? []) as Profile[])
      setExerciseLibrary((exercisesResult.data ?? []) as Exercise[])
      // O resumo dos modelos é um extra: se falhar, os cartões só ficam sem mapa.
      if (!templateRowsResult.error) {
        const rows = (templateRowsResult.data ?? []) as unknown as SummaryRow[]
        setSummaries((previous) => ({
          ...previous,
          ...groupSummaries(
            rows,
            'template_id',
            templateList.map((template) => template.id),
          ),
        }))
      }
      setLoading(false)

      const target = deepLink.aluno
      if (target && !deepLinkHandled.current) {
        deepLinkHandled.current = true
        const ids = workoutList.filter((workout) => workout.student_id === target).map((workout) => workout.id)
        if (ids.length > 0) {
          const { data } = await supabase
            .from('assigned_workout_exercises')
            .select(WORKOUT_SUMMARY_COLUMNS)
            .in('assigned_workout_id', ids)
          if (!active) return
          setSummaries((previous) => ({
            ...previous,
            ...groupSummaries((data ?? []) as unknown as SummaryRow[], 'assigned_workout_id', ids),
          }))
        }
        window.requestAnimationFrame(() =>
          document.getElementById(`student-${target}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        )
        window.setTimeout(() => {
          if (active) setHighlightId(null)
        }, 2400)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [supabase, reloadKey, deepLink])

  const loadWorkoutSummaries = async (ids: string[], force = false) => {
    const missing = force ? ids : ids.filter((id) => !summaries[id])
    if (missing.length === 0) return
    const { data, error } = await supabase
      .from('assigned_workout_exercises')
      .select(WORKOUT_SUMMARY_COLUMNS)
      .in('assigned_workout_id', missing)
    if (error) return
    setSummaries((previous) => ({
      ...previous,
      ...groupSummaries((data ?? []) as unknown as SummaryRow[], 'assigned_workout_id', missing),
    }))
  }

  const toggleStudent = (studentId: string) => {
    const opening = !expanded[studentId]
    setExpanded((previous) => ({ ...previous, [studentId]: opening }))
    if (opening) {
      void loadWorkoutSummaries(workouts.filter((workout) => workout.student_id === studentId).map((workout) => workout.id))
    }
  }

  const createKey = useCallback(() => `item-${keyCounter.current++}`, [])
  const toBuilderSets = (sets: PlannedSet[]): BuilderSet[] =>
    sets.map((set) => ({
      ...set,
      // Carga no formato brasileiro (42,5) para editar.
      weight: set.weight === null || set.weight === undefined || set.weight === '' ? '' : String(set.weight).replace('.', ','),
      key: createKey(),
    }))

  // ---------------------------------------------------------------------------
  // Histórico de cargas do treino
  // ---------------------------------------------------------------------------
  const handleOpenWorkoutHistory = async (workout: AssignedWorkout) => {
    setHistoryWorkout(workout)
    setHistorySessions([])
    setHistoryError('')
    setLoadingHistory(true)

    const { data: sessions, error } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('assigned_workout_id', workout.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(20)

    if (error) {
      setHistoryError(friendlyError(error, 'Não foi possível carregar o histórico'))
      setLoadingHistory(false)
      return
    }

    const sessionRows = (sessions ?? []) as WorkoutSession[]
    let setRows: HistorySet[] = []
    if (sessionRows.length > 0) {
      // Uma consulta só para todas as sessões.
      const { data: setsData, error: setsError } = await supabase
        .from('session_sets')
        .select('id, session_id, set_number, weight_kg, reps, rir, exercises(name)')
        .in(
          'session_id',
          sessionRows.map((session) => session.id),
        )
        .order('set_number', { ascending: true })

      if (setsError) setHistoryError(friendlyError(setsError, 'Algumas séries do histórico não carregaram'))
      setRows = (setsData ?? []) as unknown as HistorySet[]
    }

    setHistorySessions(groupHistory(sessionRows, setRows))
    setLoadingHistory(false)
  }

  const closeHistory = useCallback(() => setHistoryWorkout(null), [])

  // ---------------------------------------------------------------------------
  // Construtor de treino / modelo
  // ---------------------------------------------------------------------------
  const openBuilder = async (mode: BuilderMode, options: { studentId?: string; name?: string; weekday?: number | null } = {}) => {
    setBuilderError('')
    setWorkoutDay(isWeekday(options.weekday) ? String(options.weekday) : '')
    setSelectedStudent(options.studentId ?? '')
    setWorkoutName(options.name ?? '')
    setSelectedExercises([])
    setOriginalRowIds([])
    setReordering(false)
    // Treino novo avisa o aluno por padrão; edição só se o treinador pedir.
    setNotifyStudent(mode.kind === 'workout' && !mode.editingId)

    if (!mode.editingId) {
      setBuilder(mode)
      return
    }

    setOpeningId(mode.editingId)
    const table = mode.kind === 'workout' ? 'assigned_workout_exercises' : 'workout_template_exercises'
    const parentColumn = mode.kind === 'workout' ? 'assigned_workout_id' : 'template_id'
    const { data, error } = await supabase
      .from(table)
      .select('*, exercises(*)')
      .eq(parentColumn, mode.editingId)
      .order('order', { ascending: true })
    setOpeningId(null)

    if (error) {
      toast({ tone: 'error', title: 'Não foi possível abrir para edição', description: friendlyError(error) })
      return
    }

    const rows = (data ?? []) as PrescribedExercise[]
    setOriginalRowIds(rows.map((row) => row.id))
    setSelectedExercises(
      rows.map((row) => {
        const plannedSets = getPlannedSets(row)
        const secondary = row.exercises?.secondary_muscle
        return {
          key: row.id,
          rowId: row.id,
          exercise_id: row.exercise_id,
          name: row.exercises?.name || 'Exercício',
          muscle_group: row.exercises?.muscle_group || 'Geral',
          secondary: typeof secondary === 'string' ? secondary : null,
          notes: row.notes || '',
          planned_sets: toBuilderSets(plannedSets.length > 0 ? plannedSets : createDefaultPlannedSets()),
          essential: Boolean(row.essential),
          alternatives: Array.isArray(row.alternatives) ? row.alternatives : [],
        }
      }),
    )
    setBuilder(mode)
  }

  const closeBuilder = useCallback(() => setBuilder(null), [])
  const closePicker = useCallback(() => setShowExPicker(false), [])

  const updateExercise = useCallback((key: string, update: (item: BuilderExercise) => BuilderExercise) => {
    setSelectedExercises((items) => items.map((item) => (item.key === key ? update(item) : item)))
  }, [])

  const removeExercise = useCallback((key: string) => {
    setSelectedExercises((items) => items.filter((item) => item.key !== key))
  }, [])

  const handleAddExercises = (exercises: Exercise[]) => {
    const added: BuilderExercise[] = exercises.map((exercise) => ({
      key: createKey(),
      rowId: null,
      exercise_id: exercise.id,
      name: exercise.name,
      muscle_group: exercise.muscle_group || 'Geral',
      secondary: typeof exercise.secondary_muscle === 'string' ? exercise.secondary_muscle : null,
      notes: '',
      planned_sets: toBuilderSets(createDefaultPlannedSets()),
      essential: false,
      alternatives: [],
    }))
    setSelectedExercises((items) => [...items, ...added])
    setReordering(false)
    setShowExPicker(false)
    if (added.length > 0) {
      window.setTimeout(() => {
        document
          .getElementById(`builder-exercise-${added[0].key}`)
          ?.closest('article')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 260)
    }
  }

  const exerciseNames = useMemo(() => new Map(exerciseLibrary.map((exercise) => [exercise.id, exercise.name])), [exerciseLibrary])
  const altItem = altKey ? (selectedExercises.find((item) => item.key === altKey) ?? null) : null
  // Fora da lista: o próprio exercício e os que já são alternativas.
  const altLibrary = useMemo(
    () => (altItem ? exerciseLibrary.filter((exercise) => exercise.id !== altItem.exercise_id && !altItem.alternatives.includes(exercise.id)) : exerciseLibrary),
    [exerciseLibrary, altItem],
  )
  const closeAltPicker = useCallback(() => setAltKey(null), [])
  const handleAddAlternatives = (picked: Exercise[]) => {
    if (altKey) {
      updateExercise(altKey, (item) => ({
        ...item,
        alternatives: [...new Set([...item.alternatives, ...picked.map((exercise) => exercise.id)])].slice(0, SWAP_MAX_ALTERNATIVES),
      }))
    }
    setAltKey(null)
  }

  const handleMoveExercise = useCallback((index: number, direction: -1 | 1) => {
    setSelectedExercises((items) => {
      const target = index + direction
      if (target < 0 || target >= items.length) return items
      const updated = [...items]
      ;[updated[index], updated[target]] = [updated[target], updated[index]]
      return updated
    })
  }, [])

  const builderSummary = useMemo(
    () =>
      summarizeWork(
        selectedExercises.map((item) => ({
          name: item.name,
          muscle: item.muscle_group,
          secondary: item.secondary,
          sets: item.planned_sets.length,
        })),
      ),
    [selectedExercises],
  )

  const inWorkout = useMemo(() => new Set(selectedExercises.map((item) => item.exercise_id)), [selectedExercises])

  // Sugestões de nome enquanto o campo está vazio: próxima letra livre da rotação do aluno.
  const nameSuggestions = useMemo(() => {
    if (!builder || workoutName.trim()) return []
    const used = (
      builder.kind === 'workout'
        ? workouts.filter((workout) => workout.student_id === selectedStudent).map((workout) => workout.name)
        : templates.map((template) => template.name)
    ).map((name) => name.trim().toLowerCase())
    const letters = ['A', 'B', 'C', 'D', 'E']
      .map((letter) => `Treino ${letter}`)
      .filter((name) => !used.some((existing) => existing.startsWith(name.toLowerCase())))
    return [...letters.slice(0, 3), 'Full body', 'Superiores', 'Inferiores']
  }, [builder, workoutName, workouts, templates, selectedStudent])

  const buildRow = (item: BuilderExercise, index: number) => {
    const plannedSets = item.planned_sets.map((set) => {
      const weight = normalizeWeight(set.weight)
      return {
        type: set.type,
        reps: String(set.reps ?? '').trim() || '8-12',
        rir: normalizeRir(set.rir),
        // Carga-alvo só entra no JSON quando definida.
        ...(weight !== null ? { weight } : {}),
      }
    })
    return {
      exercise_id: item.exercise_id,
      order: index + 1,
      sets_count: plannedSets.length,
      target_reps: plannedSets[0]?.reps || '8-12',
      planned_sets: plannedSets,
      notes: item.notes.trim() || null,
      // Só depois do trocar-exercicio.sql: sem as colunas o salvamento falharia.
      ...(swapSql ? { essential: item.essential, alternatives: item.alternatives } : {}),
    }
  }

  // Atualiza linhas existentes, insere as novas e só então remove as que
  // saíram. Apagar tudo e reinserir deixaria o treino vazio se o insert
  // falhasse, e as séries já registradas perderiam a referência.
  const syncExercises = async (kind: BuilderMode['kind'], parentId: string) => {
    const table = kind === 'workout' ? 'assigned_workout_exercises' : 'workout_template_exercises'
    const parentColumn = kind === 'workout' ? 'assigned_workout_id' : 'template_id'

    const updates = selectedExercises
      .map((item, index) => ({ item, row: buildRow(item, index) }))
      .filter(({ item }) => item.rowId)
    const inserts = selectedExercises
      .map((item, index) => ({ item, row: buildRow(item, index) }))
      .filter(({ item }) => !item.rowId)
      .map(({ row }) => ({ ...row, [parentColumn]: parentId }))

    const updateResults = await Promise.all(
      updates.map(({ item, row }) => supabase.from(table).update(row).eq('id', item.rowId as string)),
    )
    const updateError = updateResults.find((result) => result.error)?.error
    if (updateError) throw new Error(friendlyError(updateError, 'Não foi possível atualizar os exercícios'))

    if (inserts.length > 0) {
      const { error } = await supabase.from(table).insert(inserts)
      if (error) throw new Error(friendlyError(error, 'Não foi possível adicionar os exercícios'))
    }

    const keptIds = new Set(selectedExercises.map((item) => item.rowId).filter(Boolean))
    const removedIds = originalRowIds.filter((id) => !keptIds.has(id))
    if (removedIds.length > 0) {
      const { error } = await supabase.from(table).delete().in('id', removedIds)
      if (error) {
        throw new Error(friendlyError(error, 'Os exercícios foram salvos, mas não foi possível remover os que saíram do treino'))
      }
    }
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!builder) return
    setBuilderError('')

    const name = workoutName.trim()
    if (builder.kind === 'workout' && !selectedStudent) return setBuilderError('Selecione um aluno.')
    if (!name) return setBuilderError('Informe o nome.')
    if (selectedExercises.length === 0) return setBuilderError('Adicione pelo menos 1 exercício.')
    const emptyExercise = selectedExercises.find((item) => item.planned_sets.length === 0)
    if (emptyExercise) return setBuilderError(`"${emptyExercise.name}" precisa de pelo menos 1 série.`)

    setSaving(true)
    const isNew = !builder.editingId
    let parentId = builder.editingId

    try {
      if (builder.kind === 'template') {
        if (parentId) {
          const { error } = await supabase.from('workout_templates').update({ name }).eq('id', parentId)
          if (error) throw new Error(friendlyError(error, 'Não foi possível salvar o modelo'))
        } else {
          const { data, error } = await supabase.from('workout_templates').insert({ name }).select('id').single()
          if (error || !data) throw new Error(friendlyError(error, 'Não foi possível criar o modelo'))
          parentId = data.id as string
        }
      } else if (parentId) {
        const { error } = await supabase
          .from('assigned_workouts')
          .update({ name, student_id: selectedStudent, ...(rotinaSql ? { weekday: workoutDay === '' ? null : Number(workoutDay) } : {}) })
          .eq('id', parentId)
        if (error) throw new Error(friendlyError(error, 'Não foi possível salvar o treino'))
      } else {
        const { data, error } = await supabase
          .from('assigned_workouts')
          .insert({
            student_id: selectedStudent,
            name,
            is_current: true,
            // Treino novo entra no fim da ordem do aluno, com o dia escolhido (se houver).
            ...(rotinaSql ? { weekday: workoutDay === '' ? null : Number(workoutDay), position: nextPositionFor(selectedStudent) } : {}),
          })
          .select('id')
          .single()
        if (error || !data) throw new Error(friendlyError(error, 'Não foi possível criar o treino'))
        parentId = data.id as string
      }

      // Se algo falhar daqui em diante, um novo "Salvar" edita o registro já
      // criado em vez de duplicá-lo.
      setBuilder({ kind: builder.kind, editingId: parentId })
      await syncExercises(builder.kind, parentId as string)

      let notified = false
      if (builder.kind === 'workout' && notifyStudent) {
        const { error } = await supabase.from('notifications').insert({
          recipient_id: selectedStudent,
          type: 'workout_updated',
          title: isNew ? 'Treino lançado! 💪' : 'Treino atualizado ✏️',
          message: isNew ? `Seu treinador atribuiu o treino: ${name}.` : `Seu treinador atualizou o treino: ${name}.`,
        })
        notified = !error
        if (notified) requestPushDelivery()
      }

      setBuilder(null)
      toast({
        tone: 'success',
        title: builder.kind === 'template' ? 'Modelo salvo' : 'Treino salvo',
        description:
          builder.kind === 'workout' && notifyStudent
            ? notified
              ? 'O aluno foi avisado no app.'
              : 'Salvo, mas o aviso ao aluno não pôde ser enviado.'
            : name,
      })
      if (builder.kind === 'workout') {
        setActiveTab('students')
        setExpanded((previous) => ({ ...previous, [selectedStudent]: true }))
        void loadWorkoutSummaries([parentId as string], true)
      }
      reload()
    } catch (error) {
      setBuilderError(friendlyError(error, 'Não foi possível salvar'))
      // Recarrega para o próximo salvamento comparar com o estado real do banco.
      if (parentId) void reopenAfterPartialSave(builder.kind, parentId)
    } finally {
      setSaving(false)
    }
  }

  const reopenAfterPartialSave = async (kind: BuilderMode['kind'], parentId: string) => {
    const table = kind === 'workout' ? 'assigned_workout_exercises' : 'workout_template_exercises'
    const parentColumn = kind === 'workout' ? 'assigned_workout_id' : 'template_id'
    const { data } = await supabase.from(table).select('id, exercise_id, order').eq(parentColumn, parentId)
    const rows = (data ?? []) as { id: string; exercise_id: string; order: number | null }[]
    setOriginalRowIds(rows.map((row) => row.id))
    // Liga itens novos às linhas que chegaram a ser inseridas (mesmo exercício e posição).
    setSelectedExercises((items) =>
      items.map((item, index) => {
        if (item.rowId) return item
        const inserted = rows.find((row) => row.exercise_id === item.exercise_id && row.order === index + 1)
        return inserted ? { ...item, rowId: inserted.id } : item
      }),
    )
  }

  // ---------------------------------------------------------------------------
  // Ações nos cartões
  // ---------------------------------------------------------------------------
  const handleToggleActive = async (workout: AssignedWorkout) => {
    const next = !workout.is_current
    // Otimista: o cartão muda na hora e volta se o banco recusar.
    setWorkouts((items) => items.map((item) => (item.id === workout.id ? { ...item, is_current: next } : item)))
    const { error } = await supabase.from('assigned_workouts').update({ is_current: next }).eq('id', workout.id)
    if (error) {
      setWorkouts((items) =>
        items.map((item) => (item.id === workout.id ? { ...item, is_current: workout.is_current } : item)),
      )
      toast({ tone: 'error', title: 'Não foi possível alterar o status', description: friendlyError(error) })
      return
    }
    toast({ tone: 'success', title: next ? 'Treino reativado' : 'Treino arquivado', description: workout.name })
  }

  const askDeleteWorkout = (workout: AssignedWorkout) =>
    setConfirmState({
      title: 'Apagar treino?',
      description: `"${workout.name}" sai da lista do aluno. Se ele já registrou cargas nesse treino, prefira arquivar.`,
      confirmLabel: 'Apagar',
      run: async () => {
        const { error } = await supabase.from('assigned_workouts').delete().eq('id', workout.id)
        if (error) {
          toast({
            tone: 'error',
            title: 'Não foi possível apagar',
            description: error.code === '23503' ? 'Este treino já tem histórico de cargas. Prefira arquivá-lo.' : friendlyError(error),
          })
          return
        }
        toast({ tone: 'success', title: 'Treino apagado', description: workout.name })
        reload()
      },
    })

  const askDeleteTemplate = (template: TemplateWithMeta) =>
    setConfirmState({
      title: 'Apagar modelo?',
      description: `"${template.name}" sai da pastinha. Os treinos já lançados para alunos não mudam.`,
      confirmLabel: 'Apagar',
      run: async () => {
        const { error } = await supabase.from('workout_templates').delete().eq('id', template.id)
        if (error) {
          toast({ tone: 'error', title: 'Não foi possível apagar o modelo', description: friendlyError(error) })
          return
        }
        toast({ tone: 'success', title: 'Modelo apagado', description: template.name })
        reload()
      },
    })

  const runConfirm = async () => {
    if (!confirmState) return
    setConfirmBusy(true)
    try {
      await confirmState.run()
    } finally {
      setConfirmBusy(false)
      setConfirmState(null)
    }
  }

  const closeConfirm = useCallback(() => {
    if (!confirmBusy) setConfirmState(null)
  }, [confirmBusy])

  const openAssign = (template: TemplateWithMeta) => {
    setTemplateToAssign(template)
    setAssignStudentId('')
    setAssignSearch('')
    setAssignNotify(true)
    setAssignError('')
  }

  const closeAssign = useCallback(() => setTemplateToAssign(null), [])

  const handleAssignTemplateToStudent = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!templateToAssign) return
    if (!assignStudentId) {
      setAssignError('Escolha um aluno.')
      return
    }
    setAssigning(true)
    setAssignError('')

    try {
      const { data: templateRows, error: templateError } = await supabase
        .from('workout_template_exercises')
        .select('*')
        .eq('template_id', templateToAssign.id)
        .order('order', { ascending: true })
      if (templateError) throw new Error(friendlyError(templateError, 'Não foi possível ler o modelo'))

      const { data: newWorkout, error: workoutError } = await supabase
        .from('assigned_workouts')
        .insert({
          student_id: assignStudentId,
          name: templateToAssign.name,
          is_current: true,
          // Refazer um treino que o aluno já tem mantém o dia e a ordem dele; senão entra no fim.
          ...(rotinaSql ? sameNameSchedule(assignStudentId, templateToAssign.name) : {}),
        })
        .select('id')
        .single()
      if (workoutError || !newWorkout) throw new Error(friendlyError(workoutError, 'Não foi possível lançar o treino'))

      const rows = (templateRows ?? []) as PrescribedExercise[]
      if (rows.length > 0) {
        const { error } = await supabase.from('assigned_workout_exercises').insert(
          rows.map((row) => ({
            assigned_workout_id: newWorkout.id,
            exercise_id: row.exercise_id,
            order: row.order,
            sets_count: row.sets_count,
            target_reps: row.target_reps,
            planned_sets: row.planned_sets,
            notes: row.notes,
            ...(swapSql ? { essential: Boolean(row.essential), alternatives: row.alternatives ?? [] } : {}),
          })),
        )
        if (error) {
          await supabase.from('assigned_workouts').delete().eq('id', newWorkout.id)
          throw new Error(friendlyError(error, 'Não foi possível copiar os exercícios'))
        }
      }

      let notified = false
      if (assignNotify) {
        const { error: notificationError } = await supabase.from('notifications').insert({
          recipient_id: assignStudentId,
          type: 'workout_updated',
          title: 'Treino lançado! 💪',
          message: `Seu treinador atribuiu o treino: ${templateToAssign.name}.`,
        })
        notified = !notificationError
        if (notified) requestPushDelivery()
      }

      setTemplateToAssign(null)
      setActiveTab('students')
      setExpanded((previous) => ({ ...previous, [assignStudentId]: true }))
      void loadWorkoutSummaries([newWorkout.id as string], true)
      toast({
        tone: 'success',
        title: 'Treino lançado',
        description: assignNotify
          ? notified
            ? 'O aluno foi avisado no app.'
            : 'O aviso ao aluno não pôde ser enviado.'
          : templateToAssign.name,
      })
      reload()
    } catch (error) {
      setAssignError(friendlyError(error, 'Não foi possível lançar o treino'))
    } finally {
      setAssigning(false)
    }
  }

  // ---- Rotina da semana: ordem e dia de cada treino (supabase/rotina-semanal.sql).
  // Treino novo entra depois dos que o aluno já tem (os sem posição contam pela ordem do nome).
  const nextPositionFor = (studentId: string) =>
    orderWorkouts(workouts.filter((workout) => workout.student_id === studentId && workout.is_current)).reduce(
      (max, workout, index) => Math.max(max, workout.position ?? index + 1),
      0,
    ) + 1

  const sameNameSchedule = (studentId: string, name: string) => {
    const same = workouts.find((workout) => workout.student_id === studentId && workout.is_current && normalizeText(workout.name.trim()) === normalizeText(name.trim()))
    return same ? { weekday: same.weekday ?? null, position: same.position ?? nextPositionFor(studentId) } : { weekday: null, position: nextPositionFor(studentId) }
  }

  const rotinaError = (error: { message?: string; code?: string } | null) =>
    error?.code === 'PGRST204' || error?.code === '42703'
      ? 'Rode o arquivo supabase/rotina-semanal.sql no Supabase para usar dia e ordem.'
      : friendlyError(error, 'Não foi possível salvar')

  // Descanso rotativo: liga ou desliga para todos os treinos do aluno de uma vez.
  const toggleRotation = async (studentId: string, on: boolean) => {
    const own = workouts.filter((workout) => workout.student_id === studentId)
    const before = new Map(own.map((workout) => [workout.id, workout.rotate_days ?? false]))
    setWorkouts((items) => items.map((item) => (item.student_id === studentId ? { ...item, rotate_days: on } : item)))
    const { error } = await supabase.from('assigned_workouts').update({ rotate_days: on }).eq('student_id', studentId)
    if (error) {
      setWorkouts((items) => items.map((item) => (before.has(item.id) ? { ...item, rotate_days: before.get(item.id) } : item)))
      toast({ tone: 'error', title: 'Não foi possível mudar o descanso rotativo', description: rotinaError(error) })
      return
    }
    toast({
      tone: 'success',
      title: on ? 'Descanso rotativo ligado' : 'Descanso rotativo desligado',
      description: on ? 'A cada semana os dias dos treinos andam um dia.' : 'Os dias voltam a ser sempre os mesmos.',
      duration: 5000,
    })
  }

  const changeWorkoutDay = (workout: AssignedWorkout, value: string) => {
    const weekday = value === '' ? null : Number(value)
    const pending = dayTimers.current.get(workout.id)
    const before = pending ? pending.before : (workout.weekday ?? null)
    if (pending) window.clearTimeout(pending.timer)
    setWorkouts((items) => items.map((item) => (item.id === workout.id ? { ...item, weekday } : item)))
    const timer = window.setTimeout(async () => {
      dayTimers.current.delete(workout.id)
      const { error } = await supabase.from('assigned_workouts').update({ weekday }).eq('id', workout.id)
      if (error) {
        setWorkouts((items) => items.map((item) => (item.id === workout.id ? { ...item, weekday: before } : item)))
        toast({ tone: 'error', title: 'Não foi possível salvar o dia', description: rotinaError(error) })
        return
      }
      toast({
        tone: 'success',
        title: weekday === null ? `${workout.name}: sem dia fixo` : `${workout.name}: ${WEEKDAY_NAMES[weekday]}`,
        description: 'O aluno já vê a semana atualizada.',
        duration: 5000,
      })
    }, 700)
    dayTimers.current.set(workout.id, { before, timer })
  }

  const moveWorkout = async (workout: AssignedWorkout, direction: -1 | 1) => {
    if (movingStudent) return
    const active = orderWorkouts(workouts.filter((item) => item.student_id === workout.student_id && item.is_current))
    const index = active.findIndex((item) => item.id === workout.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= active.length) return
    const reordered = [...active]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    const changes = reordered.map((item, position) => ({ id: item.id, position: position + 1 })).filter((change) => change.position !== (workouts.find((item) => item.id === change.id)?.position ?? null))
    const positions = new Map(changes.map((change) => [change.id, change.position]))
    setMovingStudent(workout.student_id)
    setWorkouts((items) => items.map((item) => (positions.has(item.id) ? { ...item, position: positions.get(item.id) as number } : item)))
    const results = await Promise.all(changes.map((change) => supabase.from('assigned_workouts').update({ position: change.position }).eq('id', change.id)))
    setMovingStudent(null)
    const failed = results.find((result) => result.error)?.error
    if (failed) {
      // Pode ter salvado só uma parte: recarrega o que está no banco em vez de adivinhar.
      toast({ tone: 'error', title: 'Não foi possível mudar a ordem', description: rotinaError(failed) })
      reload()
      return
    }
    toast({
      tone: 'success',
      title: `${workout.name} ${direction < 0 ? 'subiu' : 'desceu'}: agora é o ${target + 1}º de ${active.length}`,
      description: 'O aluno já vê a semana atualizada.',
      duration: 5000,
    })
    // O botão que acabou de ser usado pode ter ficado desligado (topo ou fim): o foco vai para ele ou para o oposto.
    window.setTimeout(() => {
      const same = document.querySelector<HTMLButtonElement>(`[data-move="${workout.id}:${direction}"]`)
      const other = document.querySelector<HTMLButtonElement>(`[data-move="${workout.id}:${-direction}"]`)
      ;(same && !same.disabled ? same : other)?.focus()
    }, 60)
  }

  const term = normalizeText(search.trim())
  const studentGroups = students
    .filter((student) => !term || normalizeText(`${student.full_name ?? ''} ${student.email ?? ''}`).includes(term))
    .map((student) => {
      const own = workouts.filter((workout) => workout.student_id === student.id)
      // Ativos na ordem da rotina (a do treinador, senão a do nome); arquivados depois.
      return { student, workouts: [...orderWorkouts(own.filter((workout) => workout.is_current)), ...own.filter((workout) => !workout.is_current)] }
    })

  const assignTerm = normalizeText(assignSearch.trim())
  const assignOptions = students.filter(
    (student) => !assignTerm || normalizeText(`${student.full_name ?? ''} ${student.email ?? ''}`).includes(assignTerm),
  )
  const assignSummary = templateToAssign ? summaries[templateToAssign.id] : undefined

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <Eyebrow>Prescrição</Eyebrow>
          <h1 className="mt-1 font-display text-[2.75rem] font-bold uppercase leading-[0.9]">Treinos</h1>
        </div>
        <m.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={() => openBuilder({ kind: activeTab === 'templates' ? 'template' : 'workout', editingId: null })}
          className="flex h-11 items-center gap-1.5 rounded-2xl bg-white px-4 text-xs font-black uppercase tracking-wider text-black"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>
            <span className="sr-only">Criar </span>
            {activeTab === 'templates' ? 'Modelo' : 'Treino'}
          </span>
        </m.button>
      </div>

      <SegmentedControl
        label="Ver treinos"
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: 'students', label: `Alunos · ${students.length}` },
          { value: 'templates', label: `Pastinha · ${templates.length}` },
        ]}
      />

      {loadError && (
        <Alert
          variant="error"
          onRetry={() => {
            setLoadError('')
            setLoading(true)
            reload()
          }}
        >
          {loadError}
        </Alert>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {activeTab === 'students' ? (
          <m.section
            key="students"
            aria-label="Treinos por aluno"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
            className="space-y-3"
          >
            {students.length > 4 && (
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar aluno..."
                  aria-label="Buscar aluno"
                  className={cn(inputClassName, 'h-12 py-0 pl-11')}
                />
              </div>
            )}

            {loading ? (
              <div className="space-y-2.5" role="status" aria-label="Carregando treinos">
                {[0, 1, 2].map((item) => (
                  <Skeleton key={item} className="h-[4.75rem] rounded-3xl" />
                ))}
              </div>
            ) : students.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line-strong p-8 text-center">
                <UserPlus className="h-9 w-9 text-zinc-600" aria-hidden="true" />
                <p className="text-sm font-semibold text-zinc-300">Cadastre um aluno para prescrever treinos.</p>
                <Link
                  href="/admin/students?novo=1"
                  className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-black"
                >
                  Cadastrar aluno
                </Link>
              </div>
            ) : studentGroups.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-line-strong p-8 text-center text-sm text-zinc-400">
                Nenhum aluno encontrado.
              </p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
                {studentGroups.map(({ student, workouts: studentWorkouts }) => {
                  const isExpanded = Boolean(expanded[student.id])
                  const activeCount = studentWorkouts.filter((workout) => workout.is_current).length
                  const archivedCount = studentWorkouts.length - activeCount

                  return (
                    <div
                      key={student.id}
                      id={`student-${student.id}`}
                      className={cn(
                        'scroll-mt-24 overflow-hidden rounded-3xl border bg-surface transition-[border-color,box-shadow] duration-700',
                        highlightId === student.id ? 'border-brand/60 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]' : 'border-line',
                      )}
                    >
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => toggleStudent(student.id)}
                        className="flex w-full items-center gap-3.5 p-4 text-left transition-colors hover:bg-white/[0.02]"
                      >
                        <Avatar name={student.full_name ?? student.email} seed={student.id} src={avatarUrlOf(student)} size="md" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-white">
                            {student.full_name || student.email || 'Aluno sem nome'}
                          </span>
                          <span className="block text-xs text-zinc-500">
                            {plural(activeCount, 'treino ativo', 'treinos ativos')}
                            {archivedCount > 0 && ` · ${plural(archivedCount, 'arquivado', 'arquivados')}`}
                          </span>
                        </span>
                        <m.span
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.25, ease }}
                          className={cn('shrink-0', isExpanded ? 'text-white' : 'text-zinc-500')}
                        >
                          <ChevronDown className="h-5 w-5" aria-hidden="true" />
                        </m.span>
                      </button>

                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <m.div
                            key="content"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-2.5 border-t border-line p-3">
                              {rotateSql && rotinaSql && studentWorkouts.some((workout) => workout.is_current && isWeekday(workout.weekday)) && (
                                <div className="flex items-start gap-3 rounded-2xl border border-line bg-black/30 p-3">
                                  <div className="min-w-0 flex-1">
                                    <p id={`rot-${student.id}`} className="text-sm font-bold text-white">
                                      Descanso rotativo
                                    </p>
                                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                                      O dia de descanso gira: a cada semana os dias dos treinos andam um dia.
                                      {studentWorkouts.some((workout) => workout.is_current && workout.rotate_days) &&
                                        ` Esta semana: ${studentWorkouts
                                          .filter((workout) => workout.is_current && isWeekday(workout.weekday))
                                          .map((workout) => `${workout.name.split(' - ')[0]} ${WEEKDAY_NAMES[weekdayThisWeek(workout, new Date()) as number]}`)
                                          .join(', ')}.`}
                                    </p>
                                  </div>
                                  <Switch
                                    checked={studentWorkouts.some((workout) => workout.is_current && workout.rotate_days)}
                                    onChange={(on) => void toggleRotation(student.id, on)}
                                    label={`Descanso rotativo de ${student.full_name || student.email || 'aluno'}`}
                                  />
                                </div>
                              )}

                              {studentWorkouts.length === 0 && (
                                <p className="p-3 text-center text-xs text-zinc-500">Nenhum treino prescrito para este aluno.</p>
                              )}

                              {studentWorkouts.map((workout) => {
                                const summary = summaries[workout.id]
                                return (
                                  <article
                                    key={workout.id}
                                    className={cn(
                                      'rounded-2xl border p-3 transition-colors',
                                      workout.is_current ? 'border-line bg-black/30' : 'border-dashed border-line-strong',
                                    )}
                                  >
                                    <div className="flex gap-3">
                                      {/* Arquivado: só o mapa (decorativo) fica apagado; os textos mantêm o contraste. */}
                                      <SummaryMap
                                        summary={summary}
                                        className={cn('w-[4.5rem] transition', !workout.is_current && 'opacity-40 grayscale')}
                                      />
                                      <div className="min-w-0 flex-1 py-0.5">
                                        <div className="flex items-center gap-2">
                                          <h3
                                            className={cn(
                                              'truncate text-sm font-bold',
                                              workout.is_current ? 'text-white' : 'text-zinc-300',
                                            )}
                                          >
                                            {workout.name}
                                          </h3>
                                          {!workout.is_current && (
                                            <span className="shrink-0 rounded-md border border-line-strong px-1.5 py-0.5 text-xs font-black uppercase text-zinc-400">
                                              Arquivado
                                            </span>
                                          )}
                                        </div>
                                        <p className="mt-0.5 text-xs text-zinc-500">
                                          {summary ? summaryLine(summary) : 'Carregando resumo...'}
                                        </p>
                                        {summary && summary.focus.length > 0 && (
                                          <p className="mt-1 truncate text-xs font-semibold text-brand">
                                            {summary.focus.join(' · ')}
                                          </p>
                                        )}
                                        <p className="mt-1 text-xs text-zinc-600">
                                          Criado em {new Date(workout.created_at).toLocaleDateString('pt-BR')}
                                        </p>
                                      </div>
                                    </div>

                                    {rotinaSql && workout.is_current && (
                                      <div className="mt-3 flex items-center gap-1.5">
                                        <label htmlFor={`day-${workout.id}`} className="sr-only">
                                          Dia da semana de {workout.name}
                                        </label>
                                        <select
                                          id={`day-${workout.id}`}
                                          value={isWeekday(workout.weekday) ? String(workout.weekday) : ''}
                                          onChange={(event) => changeWorkoutDay(workout, event.target.value)}
                                          className={cn(inputClassName, 'h-11 min-w-0 flex-1 py-0')}
                                        >
                                          <option value="">Sem dia fixo</option>
                                          {WEEKDAY_ORDER.map((day) => (
                                            <option key={day} value={day}>
                                              {WEEKDAY_NAMES[day]}
                                            </option>
                                          ))}
                                        </select>
                                        <IconButton
                                          label={`Subir ${workout.name} na ordem`}
                                          dataMove={`${workout.id}:-1`}
                                          disabled={movingStudent !== null || studentWorkouts.filter((item) => item.is_current).findIndex((item) => item.id === workout.id) === 0}
                                          onClick={() => void moveWorkout(workout, -1)}
                                        >
                                          <ArrowUp className="h-4 w-4" aria-hidden="true" />
                                        </IconButton>
                                        <IconButton
                                          label={`Descer ${workout.name} na ordem`}
                                          dataMove={`${workout.id}:1`}
                                          disabled={movingStudent !== null || studentWorkouts.filter((item) => item.is_current).findIndex((item) => item.id === workout.id) === studentWorkouts.filter((item) => item.is_current).length - 1}
                                          onClick={() => void moveWorkout(workout, 1)}
                                        >
                                          <ArrowDown className="h-4 w-4" aria-hidden="true" />
                                        </IconButton>
                                      </div>
                                    )}

                                    <div className="mt-3 flex gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenWorkoutHistory(workout)}
                                        className="flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] px-2 text-xs font-bold text-zinc-200 transition hover:bg-white/10"
                                      >
                                        <History className="h-4 w-4 shrink-0" aria-hidden="true" />
                                        <span className="truncate">Ver cargas registradas</span>
                                      </button>
                                      <IconButton
                                        label={`Editar ${workout.name}`}
                                        tone="brand"
                                        disabled={openingId !== null}
                                        onClick={() =>
                                          openBuilder(
                                            { kind: 'workout', editingId: workout.id },
                                            { studentId: workout.student_id, name: workout.name, weekday: workout.weekday },
                                          )
                                        }
                                      >
                                        {openingId === workout.id ? (
                                          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                                        ) : (
                                          <Pencil className="h-4 w-4" aria-hidden="true" />
                                        )}
                                      </IconButton>
                                      <IconButton
                                        label={workout.is_current ? `Arquivar ${workout.name}` : `Reativar ${workout.name}`}
                                        onClick={() => handleToggleActive(workout)}
                                      >
                                        {workout.is_current ? (
                                          <Archive className="h-4 w-4" aria-hidden="true" />
                                        ) : (
                                          <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                                        )}
                                      </IconButton>
                                      <IconButton label={`Apagar ${workout.name}`} tone="danger" onClick={() => askDeleteWorkout(workout)}>
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                      </IconButton>
                                    </div>
                                  </article>
                                )
                            })}

                            <button
                              type="button"
                              onClick={() => openBuilder({ kind: 'workout', editingId: null }, { studentId: student.id })}
                              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong text-xs font-bold uppercase tracking-wider text-zinc-400 transition hover:border-brand/50 hover:text-white"
                            >
                              <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar treino
                            </button>
                          </div>
                        </m.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
                })}
              </div>
            )}
          </m.section>
        ) : (
          <m.section
            key="templates"
            aria-label="Pastinha de modelos"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.18 }}
            className="space-y-3"
          >
            <p className="px-1 text-xs text-zinc-500">Modelos prontos para lançar a qualquer aluno com um toque.</p>
            {loading ? (
              <div className="space-y-2.5" role="status" aria-label="Carregando modelos">
                {[0, 1].map((item) => (
                  <Skeleton key={item} className="h-40 rounded-3xl" />
                ))}
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line-strong p-8 text-center">
                <FolderKanban className="h-10 w-10 text-zinc-600" aria-hidden="true" />
                <p className="text-sm font-semibold text-zinc-300">Pastinha de modelos vazia.</p>
                <button
                  type="button"
                  onClick={() => openBuilder({ kind: 'template', editingId: null })}
                  className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-black"
                >
                  Criar modelo
                </button>
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
                {templates.map((template) => {
                  const summary = summaries[template.id]
                  return (
                    <article key={template.id} className="rounded-3xl border border-line bg-surface p-4">
                      <div className="flex gap-3.5">
                        <SummaryMap summary={summary} className="w-24" />
                        <div className="min-w-0 flex-1 py-0.5">
                          <p className="text-xs font-black uppercase tracking-[0.1em] text-gold">Modelo</p>
                          <h3 className="mt-0.5 truncate text-base font-bold text-white">{template.name}</h3>
                          <p className="mt-1 text-xs text-zinc-500">{summary ? summaryLine(summary) : 'Carregando resumo...'}</p>
                          {summary && summary.focus.length > 0 && (
                            <p className="mt-1 truncate text-xs font-semibold text-brand">{summary.focus.join(' · ')}</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3.5 flex gap-1.5">
                        <m.button
                          type="button"
                          whileTap={{ scale: 0.97 }}
                          onClick={() => openAssign(template)}
                          className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-xs font-black uppercase tracking-wider text-black"
                        >
                          <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="truncate">Atribuir a um aluno</span>
                        </m.button>
                        <IconButton
                          label={`Editar modelo ${template.name}`}
                          tone="brand"
                          disabled={openingId !== null}
                          onClick={() => openBuilder({ kind: 'template', editingId: template.id }, { name: template.name })}
                        >
                          {openingId === template.id ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          )}
                        </IconButton>
                        <IconButton label={`Apagar modelo ${template.name}`} tone="danger" onClick={() => askDeleteTemplate(template)}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </m.section>
        )}
      </AnimatePresence>

      {/* Histórico de cargas do treino */}
      <Modal
        open={historyWorkout !== null}
        onClose={closeHistory}
        variant="sheet"
        title={historyWorkout?.name}
        description={`Cargas registradas por ${historyWorkout?.profiles?.full_name || historyWorkout?.profiles?.email || 'aluno'}`}
      >
        <WorkoutHistory sessions={historySessions} loading={loadingHistory} error={historyError} />
      </Modal>

      {/* Construtor / editor */}
      <Modal
        open={builder !== null}
        onClose={closeBuilder}
        variant="sheet"
        title={
          builder?.kind === 'template'
            ? builder.editingId
              ? 'Editar modelo'
              : 'Novo modelo'
            : builder?.editingId
              ? 'Editar treino'
              : 'Novo treino'
        }
      >
        <form onSubmit={handleSave} className="space-y-5">
          {builder?.kind === 'workout' && (
            <div>
              <label htmlFor="builder-student" className={labelClassName}>
                Aluno
              </label>
              <select
                id="builder-student"
                required
                value={selectedStudent}
                onChange={(event) => setSelectedStudent(event.target.value)}
                className={inputClassName}
              >
                <option value="">Selecione um aluno...</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name || student.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="builder-name" className={labelClassName}>
              Nome
            </label>
            <input
              ref={nameInputRef}
              id="builder-name"
              type="text"
              required
              value={workoutName}
              onChange={(event) => setWorkoutName(event.target.value)}
              placeholder="Ex: Treino A - Peito e tríceps"
              className={inputClassName}
            />
            {nameSuggestions.length > 0 && (
              <div role="group" aria-label="Sugestões de nome" className="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4">
                {nameSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setWorkoutName(suggestion)
                      nameInputRef.current?.focus()
                    }}
                    className="h-8 shrink-0 rounded-full border border-line px-3 text-xs font-bold text-zinc-300 transition hover:border-line-strong hover:text-white"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {rotinaSql && builder?.kind === 'workout' && (
            <div>
              <label htmlFor="builder-day" className={labelClassName}>
                Dia da semana (opcional)
              </label>
              <select id="builder-day" aria-describedby="builder-day-hint" value={workoutDay} onChange={(event) => setWorkoutDay(event.target.value)} className={inputClassName}>
                <option value="">Sem dia fixo</option>
                {WEEKDAY_ORDER.map((day) => (
                  <option key={day} value={day}>
                    {WEEKDAY_NAMES[day]}
                  </option>
                ))}
              </select>
              <p id="builder-day-hint" className="mt-1.5 text-xs text-zinc-400">Com dia marcado, a tela Hoje do aluno mostra este treino nesse dia. A semana começa na segunda.</p>
            </div>
          )}

          {selectedExercises.length > 0 && (
            <div className="rounded-3xl border border-line bg-surface p-4">
              <Eyebrow>Resumo do treino</Eyebrow>
              <p className="mt-2 text-sm font-bold leading-snug text-white">
                {builderSummary.focus.join(' · ') || 'Grupo muscular não identificado'}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Regiões mais trabalhadas, pelo número de séries.</p>
              {/* Cada exercício novo acende os músculos no corpo 3D. */}
              <Body3D
                fills={builderSummary.fills}
                label={`Músculos do treino: ${builderSummary.focus.join(', ') || 'nenhum identificado'}`}
                heightClassName="h-72"
                showChips={false}
                className="mt-3"
              />
              <dl className="mt-3 grid grid-cols-3 divide-x divide-line border-t border-line pt-3 text-center">
                <div>
                  <dt className="text-xs font-black uppercase tracking-wider text-zinc-500">Exercícios</dt>
                  <dd className="font-display text-3xl font-bold leading-tight">
                    <AnimatedNumber value={builderSummary.exercises} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-black uppercase tracking-wider text-zinc-500">Séries</dt>
                  <dd className="font-display text-3xl font-bold leading-tight">
                    <AnimatedNumber value={builderSummary.sets} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-black uppercase tracking-wider text-zinc-500">Duração</dt>
                  <dd className="font-display text-3xl font-bold leading-tight text-zinc-300">
                    <AnimatedNumber value={builderSummary.minutes} format={(value) => `≈${Math.round(value)}`} />
                    <span className="ml-0.5 text-sm text-zinc-500">min</span>
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <section aria-labelledby="builder-exercises-title" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 id="builder-exercises-title" className="text-xs font-black uppercase tracking-[0.1em] text-zinc-400">
                Exercícios ({selectedExercises.length})
              </h3>
              <div className="flex gap-1.5">
                {selectedExercises.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setReordering((value) => !value)}
                    className={cn(
                      'flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition',
                      reordering
                        ? 'border-brand/50 bg-brand-soft text-brand'
                        : 'border-line-strong text-zinc-300 hover:text-white',
                    )}
                  >
                    {reordering ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ArrowDownUp className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {reordering ? 'Concluir' : 'Reordenar'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowExPicker(true)}
                  className="flex h-9 items-center gap-1 rounded-xl bg-white px-3 text-xs font-bold text-black"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Adicionar
                </button>
              </div>
            </div>

            {selectedExercises.length === 0 ? (
              <button
                type="button"
                onClick={() => setShowExPicker(true)}
                className="flex w-full flex-col items-center gap-2 rounded-3xl border border-dashed border-line-strong p-8 text-center transition hover:border-brand/50"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <Plus className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="text-sm font-bold text-white">Escolher exercícios</span>
                <span className="text-xs text-zinc-500">Marque vários da biblioteca de uma vez.</span>
              </button>
            ) : reordering && selectedExercises.length > 1 ? (
              <>
                <p className="text-xs text-zinc-500">Arraste pela alça ou use as setas para mudar a ordem.</p>
                <ReorderList items={selectedExercises} onReorder={setSelectedExercises} onMove={handleMoveExercise} />
              </>
            ) : (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {selectedExercises.map((item, index) => (
                    <m.div
                      key={item.key}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease }}
                    >
                      <BuilderExerciseCard
                        item={item}
                        index={index}
                        onChange={updateExercise}
                        onRemove={removeExercise}
                        createKey={createKey}
                        swapEnabled={swapSql}
                        exerciseNames={exerciseNames}
                        onPickAlternatives={setAltKey}
                      />
                    </m.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>

          {builder?.kind === 'workout' && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">Avisar o aluno</p>
                <p className="text-xs text-zinc-500">
                  {builder.editingId ? 'Envia um aviso de treino atualizado.' : 'Envia um aviso de treino novo no app.'}
                </p>
              </div>
              <Switch checked={notifyStudent} onChange={setNotifyStudent} label="Avisar o aluno" />
            </div>
          )}

          {builderError && <Alert variant="error">{builderError}</Alert>}

          <SheetFooter>
            <m.button
              type="submit"
              disabled={saving}
              whileTap={{ scale: 0.98 }}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-white text-sm font-black uppercase tracking-[0.16em] text-black disabled:opacity-60"
            >
              {saving ? (
                <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Salvando" />
              ) : builder?.kind === 'template' ? (
                'Salvar modelo'
              ) : (
                'Salvar treino'
              )}
            </m.button>
          </SheetFooter>
        </form>
      </Modal>

      <ExercisePicker
        open={showExPicker}
        onClose={closePicker}
        library={exerciseLibrary}
        inWorkout={inWorkout}
        onAdd={handleAddExercises}
      />

      <ExercisePicker
        open={altKey !== null}
        onClose={closeAltPicker}
        library={altLibrary}
        inWorkout={NO_EXERCISES}
        onAdd={handleAddAlternatives}
        title="Alternativas de troca"
        description="Exercícios que o aluno pode fazer no lugar, se precisar trocar."
        confirmLabel="Usar como alternativa"
        max={SWAP_MAX_ALTERNATIVES - (altItem?.alternatives.length ?? 0)}
      />

      {/* Atribuir modelo */}
      <Modal
        open={templateToAssign !== null}
        onClose={closeAssign}
        title="Lançar treino"
        description="Copia o modelo para o aluno escolhido."
      >
        <form onSubmit={handleAssignTemplateToStudent} className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-black/30 p-3">
            <SummaryMap summary={assignSummary} className="w-16 p-1" />
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-gold">Modelo</p>
              <p className="truncate text-sm font-bold text-white">{templateToAssign?.name}</p>
              {assignSummary && <p className="text-xs text-zinc-500">{summaryLine(assignSummary)}</p>}
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className={labelClassName}>Escolha o aluno</legend>
            {students.length > 6 && (
              <input
                type="search"
                value={assignSearch}
                onChange={(event) => setAssignSearch(event.target.value)}
                placeholder="Buscar aluno..."
                aria-label="Buscar aluno para lançar"
                className={cn(inputClassName, 'h-11 py-0')}
              />
            )}
            <div className="max-h-[38vh] space-y-1.5 overflow-y-auto">
              {assignOptions.map((student) => {
                const checked = assignStudentId === student.id
                return (
                  <label
                    key={student.id}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 pr-3.5 transition has-[:checked]:border-brand/60 has-[:checked]:bg-brand-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand"
                  >
                    <input
                      type="radio"
                      name="assign-student"
                      value={student.id}
                      checked={checked}
                      onChange={() => setAssignStudentId(student.id)}
                      className="sr-only"
                    />
                    <Avatar name={student.full_name ?? student.email} seed={student.id} src={avatarUrlOf(student)} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                      {student.full_name || student.email}
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors',
                        checked ? 'border-brand bg-brand text-black' : 'border-line-strong',
                      )}
                    >
                      {checked && <Check className="h-3 w-3 stroke-[3]" />}
                    </span>
                  </label>
                )
              })}
              {assignOptions.length === 0 && (
                <p className="py-4 text-center text-xs text-zinc-500">Nenhum aluno encontrado.</p>
              )}
            </div>
          </fieldset>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3.5">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">Avisar o aluno</p>
              <p className="text-xs text-zinc-500">Envia um aviso de treino novo no app.</p>
            </div>
            <Switch checked={assignNotify} onChange={setAssignNotify} label="Avisar o aluno" />
          </div>

          {assignError && <Alert variant="error">{assignError}</Alert>}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={closeAssign}
              className="h-12 rounded-2xl border border-line-strong text-xs font-black uppercase tracking-wider text-zinc-200"
            >
              Cancelar
            </button>
            <m.button
              type="submit"
              disabled={assigning}
              whileTap={{ scale: 0.97 }}
              className="flex h-12 items-center justify-center rounded-2xl bg-white text-xs font-black uppercase tracking-wider text-black disabled:opacity-60"
            >
              {assigning ? <LoaderCircle className="h-4 w-4 animate-spin" aria-label="Lançando" /> : 'Lançar treino'}
            </m.button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.title ?? ''}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel ?? 'Confirmar'}
        busy={confirmBusy}
        onConfirm={runConfirm}
        onClose={closeConfirm}
      />
    </div>
  )
}
