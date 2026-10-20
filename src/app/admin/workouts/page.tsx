'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Eye,
  FolderKanban,
  History,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { AssignedWorkout, Exercise, PlannedSet, PrescribedExercise, Profile, WorkoutSession } from '@/lib/types'
import {
  REP_PRESETS,
  SET_TYPES,
  createDefaultPlannedSets,
  formatKg,
  getPlannedSets,
  normalizeRir,
} from '@/lib/workouts'
import { cn } from '@/lib/cn'
import { Alert, FeedbackAlert, type Feedback } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { PageLoader } from '@/components/ui/page-loader'

type WorkoutWithMeta = AssignedWorkout
type TemplateWithMeta = { id: string; name: string }

type BuilderExercise = {
  key: string
  rowId: string | null
  exercise_id: string
  name: string
  muscle_group: string
  notes: string
  planned_sets: PlannedSet[]
}

type HistorySet = {
  id: string
  session_id: string
  set_number: number
  weight_kg: number | null
  reps: number | null
  rir: number | null
  exercises: { name: string | null } | null
}

type HistorySession = WorkoutSession & { groups: { name: string; sets: HistorySet[] }[] }

type BuilderMode = { kind: 'workout' | 'template'; editingId: string | null }

const inputClassName =
  'w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:outline-none'

export default function AdminWorkoutsPage() {
  const [supabase] = useState(() => createClient())
  const [activeTab, setActiveTab] = useState<'students' | 'templates'>('students')

  const [workouts, setWorkouts] = useState<WorkoutWithMeta[]>([])
  const [templates, setTemplates] = useState<TemplateWithMeta[]>([])
  const [students, setStudents] = useState<Profile[]>([])
  const [exerciseLibrary, setExerciseLibrary] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({})

  const [historyWorkout, setHistoryWorkout] = useState<WorkoutWithMeta | null>(null)
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState('')

  const [builder, setBuilder] = useState<BuilderMode | null>(null)
  const [selectedStudent, setSelectedStudent] = useState('')
  const [workoutName, setWorkoutName] = useState('')
  const [selectedExercises, setSelectedExercises] = useState<BuilderExercise[]>([])
  const [originalRowIds, setOriginalRowIds] = useState<string[]>([])
  const [builderError, setBuilderError] = useState('')
  const [openingBuilder, setOpeningBuilder] = useState(false)
  const [saving, setSaving] = useState(false)

  const [templateToAssign, setTemplateToAssign] = useState<TemplateWithMeta | null>(null)
  const [assignStudentId, setAssignStudentId] = useState('')
  const [assignError, setAssignError] = useState('')

  const [showExPicker, setShowExPicker] = useState(false)
  const [exSearch, setExSearch] = useState('')
  const keyCounter = useRef(0)

  const reload = () => setReloadKey((key) => key + 1)

  useEffect(() => {
    let active = true

    const load = async () => {
      const [workoutsResult, templatesResult, studentsResult, exercisesResult] = await Promise.all([
        supabase
          .from('assigned_workouts')
          .select('*, profiles(full_name, email)')
          .order('created_at', { ascending: false }),
        supabase.from('workout_templates').select('id, name').order('name'),
        supabase.from('profiles').select('id, role, full_name, email').eq('role', 'student').order('full_name'),
        supabase.from('exercises').select('*').order('name'),
      ])
      if (!active) return

      const error = workoutsResult.error ?? templatesResult.error ?? studentsResult.error ?? exercisesResult.error
      if (error) {
        setLoadError(`Não foi possível carregar os dados: ${error.message}`)
      } else {
        setLoadError('')
        setWorkouts((workoutsResult.data ?? []) as WorkoutWithMeta[])
        setTemplates((templatesResult.data ?? []) as TemplateWithMeta[])
        setStudents((studentsResult.data ?? []) as Profile[])
        setExerciseLibrary((exercisesResult.data ?? []) as Exercise[])
      }
      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [supabase, reloadKey])

  const nextKey = () => `new-${keyCounter.current++}`

  // ---------------------------------------------------------------------------
  // Histórico de cargas do treino
  // ---------------------------------------------------------------------------
  const handleOpenWorkoutHistory = async (workout: WorkoutWithMeta) => {
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
      setHistoryError(error.message)
      setLoadingHistory(false)
      return
    }

    const sessionRows = (sessions ?? []) as WorkoutSession[]
    let setRows: HistorySet[] = []
    if (sessionRows.length > 0) {
      // Uma consulta só para todas as sessões (antes era uma por sessão).
      const { data: setsData, error: setsError } = await supabase
        .from('session_sets')
        .select('id, session_id, set_number, weight_kg, reps, rir, exercises(name)')
        .in(
          'session_id',
          sessionRows.map((session) => session.id),
        )
        .order('set_number', { ascending: true })

      if (setsError) setHistoryError(setsError.message)
      setRows = (setsData ?? []) as unknown as HistorySet[]
    }

    setHistorySessions(
      sessionRows.map((session) => {
        const groups: HistorySession['groups'] = []
        for (const set of setRows.filter((row) => row.session_id === session.id)) {
          const name = set.exercises?.name || 'Exercício'
          const group = groups.find((item) => item.name === name)
          if (group) group.sets.push(set)
          else groups.push({ name, sets: [set] })
        }
        return { ...session, groups }
      }),
    )
    setLoadingHistory(false)
  }

  const closeHistory = useCallback(() => setHistoryWorkout(null), [])

  // ---------------------------------------------------------------------------
  // Construtor de treino / modelo
  // ---------------------------------------------------------------------------
  const openBuilder = async (mode: BuilderMode, options: { studentId?: string; name?: string } = {}) => {
    setBuilderError('')
    setSelectedStudent(options.studentId ?? '')
    setWorkoutName(options.name ?? '')
    setSelectedExercises([])
    setOriginalRowIds([])

    if (!mode.editingId) {
      setBuilder(mode)
      return
    }

    setOpeningBuilder(true)
    const table = mode.kind === 'workout' ? 'assigned_workout_exercises' : 'workout_template_exercises'
    const parentColumn = mode.kind === 'workout' ? 'assigned_workout_id' : 'template_id'
    const { data, error } = await supabase
      .from(table)
      .select('*, exercises(name, muscle_group)')
      .eq(parentColumn, mode.editingId)
      .order('order', { ascending: true })
    setOpeningBuilder(false)

    if (error) {
      setFeedback({ type: 'error', message: `Não foi possível abrir para edição: ${error.message}` })
      return
    }

    const rows = (data ?? []) as PrescribedExercise[]
    setOriginalRowIds(rows.map((row) => row.id))
    setSelectedExercises(
      rows.map((row) => {
        const plannedSets = getPlannedSets(row)
        return {
          key: row.id,
          rowId: row.id,
          exercise_id: row.exercise_id,
          name: row.exercises?.name || 'Exercício',
          muscle_group: row.exercises?.muscle_group || 'Geral',
          notes: row.notes || '',
          planned_sets: plannedSets.length > 0 ? plannedSets.map((set) => ({ ...set })) : createDefaultPlannedSets(),
        }
      }),
    )
    setBuilder(mode)
  }

  const closeBuilder = useCallback(() => setBuilder(null), [])
  const closePicker = useCallback(() => setShowExPicker(false), [])

  const updateExerciseAt = (index: number, update: (item: BuilderExercise) => BuilderExercise) => {
    setSelectedExercises((items) => items.map((item, itemIndex) => (itemIndex === index ? update(item) : item)))
  }

  const updateSetAt = (exIndex: number, setIndex: number, patch: Partial<PlannedSet>) => {
    updateExerciseAt(exIndex, (item) => ({
      ...item,
      planned_sets: item.planned_sets.map((set, index) => (index === setIndex ? { ...set, ...patch } : set)),
    }))
  }

  const handleAddExercise = (exercise: Exercise) => {
    setSelectedExercises((items) => [
      ...items,
      {
        key: nextKey(),
        rowId: null,
        exercise_id: exercise.id,
        name: exercise.name,
        muscle_group: exercise.muscle_group || 'Geral',
        notes: '',
        planned_sets: createDefaultPlannedSets(),
      },
    ])
    setShowExPicker(false)
    setExSearch('')
  }

  const handleMoveExercise = (index: number, direction: -1 | 1) => {
    setSelectedExercises((items) => {
      const target = index + direction
      if (target < 0 || target >= items.length) return items
      const updated = [...items]
      ;[updated[index], updated[target]] = [updated[target], updated[index]]
      return updated
    })
  }

  const buildRow = (item: BuilderExercise, index: number) => {
    const plannedSets = item.planned_sets.map((set) => ({
      type: set.type,
      reps: String(set.reps ?? '').trim() || '8-12',
      rir: normalizeRir(set.rir),
    }))
    return {
      exercise_id: item.exercise_id,
      order: index + 1,
      sets_count: plannedSets.length,
      target_reps: plannedSets[0]?.reps || '8-12',
      planned_sets: plannedSets,
      notes: item.notes.trim() || null,
    }
  }

  // Atualiza linhas existentes, insere as novas e só então remove as que
  // saíram. Antes tudo era apagado e reinserido: se o insert falhasse, o
  // treino ficava vazio, e as séries já registradas perdiam a referência.
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
    if (updateError) throw new Error(`Erro ao atualizar exercícios: ${updateError.message}`)

    if (inserts.length > 0) {
      const { error } = await supabase.from(table).insert(inserts)
      if (error) throw new Error(`Erro ao adicionar exercícios: ${error.message}`)
    }

    const keptIds = new Set(selectedExercises.map((item) => item.rowId).filter(Boolean))
    const removedIds = originalRowIds.filter((id) => !keptIds.has(id))
    if (removedIds.length > 0) {
      const { error } = await supabase.from(table).delete().in('id', removedIds)
      if (error) {
        throw new Error(
          `Os exercícios foram salvos, mas não foi possível remover os que saíram do treino (${error.message}).`,
        )
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
    let parentId = builder.editingId

    try {
      if (builder.kind === 'template') {
        if (parentId) {
          const { error } = await supabase.from('workout_templates').update({ name }).eq('id', parentId)
          if (error) throw new Error(`Erro ao salvar o modelo: ${error.message}`)
        } else {
          const { data, error } = await supabase.from('workout_templates').insert({ name }).select('id').single()
          if (error || !data) throw new Error(`Erro ao criar o modelo: ${error?.message}`)
          parentId = data.id as string
        }
      } else if (parentId) {
        const { error } = await supabase
          .from('assigned_workouts')
          .update({ name, student_id: selectedStudent })
          .eq('id', parentId)
        if (error) throw new Error(`Erro ao salvar o treino: ${error.message}`)
      } else {
        const { data, error } = await supabase
          .from('assigned_workouts')
          .insert({ student_id: selectedStudent, name, is_current: true })
          .select('id')
          .single()
        if (error || !data) throw new Error(`Erro ao criar o treino: ${error?.message}`)
        parentId = data.id as string
      }

      // Se algo falhar daqui em diante, um novo "Salvar" edita o registro já
      // criado em vez de duplicá-lo.
      setBuilder({ kind: builder.kind, editingId: parentId })
      await syncExercises(builder.kind, parentId as string)

      setBuilder(null)
      setFeedback({ type: 'success', message: builder.kind === 'template' ? 'Modelo salvo.' : 'Treino salvo.' })
      if (builder.kind === 'workout') setExpandedStudents((previous) => ({ ...previous, [selectedStudent]: true }))
      reload()
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : 'Erro ao salvar.')
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
  const handleToggleActive = async (workout: WorkoutWithMeta) => {
    const { error } = await supabase
      .from('assigned_workouts')
      .update({ is_current: !workout.is_current })
      .eq('id', workout.id)
    if (error) {
      setFeedback({ type: 'error', message: `Não foi possível alterar o status: ${error.message}` })
      return
    }
    setFeedback({
      type: 'success',
      message: workout.is_current ? `"${workout.name}" foi arquivado.` : `"${workout.name}" está ativo de novo.`,
    })
    reload()
  }

  const handleDeleteWorkout = async (workout: WorkoutWithMeta) => {
    if (!window.confirm(`Apagar o treino "${workout.name}"? O histórico de cargas dele pode ser perdido.`)) return
    const { error } = await supabase.from('assigned_workouts').delete().eq('id', workout.id)
    if (error) {
      setFeedback({
        type: 'error',
        message: `Não foi possível apagar (${error.message}). Se o treino já tem histórico, prefira arquivá-lo.`,
      })
      return
    }
    setFeedback({ type: 'success', message: 'Treino apagado.' })
    reload()
  }

  const handleDeleteTemplate = async (template: TemplateWithMeta) => {
    if (!window.confirm(`Apagar o modelo "${template.name}"?`)) return
    const { error } = await supabase.from('workout_templates').delete().eq('id', template.id)
    if (error) {
      setFeedback({ type: 'error', message: `Não foi possível apagar o modelo: ${error.message}` })
      return
    }
    setFeedback({ type: 'success', message: 'Modelo apagado.' })
    reload()
  }

  const closeAssign = useCallback(() => setTemplateToAssign(null), [])

  const handleAssignTemplateToStudent = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!templateToAssign || !assignStudentId) return
    setSaving(true)
    setAssignError('')

    try {
      const { data: templateRows, error: templateError } = await supabase
        .from('workout_template_exercises')
        .select('*')
        .eq('template_id', templateToAssign.id)
        .order('order', { ascending: true })
      if (templateError) throw new Error(`Erro ao ler o modelo: ${templateError.message}`)

      const { data: newWorkout, error: workoutError } = await supabase
        .from('assigned_workouts')
        .insert({ student_id: assignStudentId, name: templateToAssign.name, is_current: true })
        .select('id')
        .single()
      if (workoutError || !newWorkout) throw new Error(`Erro ao atribuir: ${workoutError?.message ?? 'sem resposta'}`)

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
          })),
        )
        if (error) {
          await supabase.from('assigned_workouts').delete().eq('id', newWorkout.id)
          throw new Error(`Erro ao copiar os exercícios: ${error.message}`)
        }
      }

      const { error: notificationError } = await supabase.from('notifications').insert({
        recipient_id: assignStudentId,
        type: 'workout_updated',
        title: 'Treino lançado! 💪',
        message: `Seu treinador atribuiu o treino: ${templateToAssign.name}.`,
      })

      setTemplateToAssign(null)
      setActiveTab('students')
      setExpandedStudents((previous) => ({ ...previous, [assignStudentId]: true }))
      setFeedback(
        notificationError
          ? { type: 'success', message: 'Treino atribuído (o aviso ao aluno não pôde ser enviado).' }
          : { type: 'success', message: 'Treino atribuído e aluno avisado.' },
      )
      reload()
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : 'Erro ao atribuir.')
    } finally {
      setSaving(false)
    }
  }

  const searchTerm = exSearch.trim().toLowerCase()
  const filteredLibrary = exerciseLibrary.filter(
    (exercise) =>
      (exercise.name ?? '').toLowerCase().includes(searchTerm) ||
      (exercise.muscle_group ?? '').toLowerCase().includes(searchTerm),
  )

  const studentGroups = students.map((student) => ({
    student,
    workouts: workouts.filter((workout) => workout.student_id === student.id),
  }))

  return (
    <div className="space-y-6">
      <div className="flex rounded-2xl border border-zinc-900 bg-zinc-950 p-1.5 shadow-xl" role="tablist">
        {(
          [
            { id: 'students', label: `Alunos (${students.length})`, icon: Users },
            { id: 'templates', label: `Pastinha (${templates.length})`, icon: FolderKanban },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-xs font-black uppercase tracking-wider transition-all',
              activeTab === tab.id ? 'bg-white text-black shadow-lg' : 'text-zinc-500 hover:text-white',
            )}
          >
            <tab.icon className="h-4 w-4" aria-hidden="true" /> {tab.label}
          </button>
        ))}
      </div>

      <FeedbackAlert feedback={feedback} />
      {loadError && <Alert variant="error">{loadError}</Alert>}

      {activeTab === 'students' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black uppercase tracking-wide">Treinos atribuídos</h1>
              <p className="text-xs font-medium text-zinc-500">Prescreva treinos e veja as cargas</p>
            </div>
            <button
              type="button"
              onClick={() => openBuilder({ kind: 'workout', editingId: null })}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-extrabold uppercase text-black shadow-lg active:scale-95"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Criar treino
            </button>
          </div>

          {loading ? (
            <PageLoader label="Carregando treinos" />
          ) : studentGroups.length === 0 ? (
            <div className="rounded-3xl border border-zinc-900 bg-zinc-950 p-8 text-center text-sm font-semibold text-zinc-400">
              Cadastre um aluno na aba Alunos para prescrever treinos.
            </div>
          ) : (
            <div className="space-y-4">
              {studentGroups.map(({ student, workouts: studentWorkouts }) => {
                const isExpanded = Boolean(expandedStudents[student.id])
                const activeCount = studentWorkouts.filter((workout) => workout.is_current).length

                return (
                  <div key={student.id} className="overflow-hidden rounded-3xl border border-zinc-900 bg-zinc-950 shadow-xl">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedStudents((previous) => ({ ...previous, [student.id]: !isExpanded }))}
                      className="flex w-full items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-zinc-900/50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-sm font-black text-white">
                          {student.full_name ? student.full_name.substring(0, 2).toUpperCase() : 'AL'}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-extrabold text-white">
                            {student.full_name || student.email || 'Aluno sem nome'}
                          </h3>
                          <p className="text-[11px] font-medium text-zinc-500">
                            {activeCount} {activeCount === 1 ? 'treino ativo' : 'treinos ativos'}
                            {studentWorkouts.length > activeCount && ` · ${studentWorkouts.length - activeCount} arquivado(s)`}
                          </p>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 shrink-0 text-white" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="space-y-3 border-t border-zinc-900 bg-black/60 p-4">
                        {studentWorkouts.length === 0 && (
                          <p className="p-4 text-center text-xs font-medium text-zinc-600">
                            Nenhum treino prescrito para este aluno.
                          </p>
                        )}

                        {studentWorkouts.map((workout) => (
                          <div
                            key={workout.id}
                            className={cn(
                              'space-y-3 rounded-2xl border p-4',
                              workout.is_current ? 'border-zinc-800 bg-zinc-900/90' : 'border-zinc-900 bg-zinc-950 opacity-70',
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="truncate text-base font-extrabold text-white">{workout.name}</h4>
                                  {!workout.is_current && (
                                    <span className="rounded-md border border-zinc-800 px-1.5 py-0.5 text-[8px] font-black uppercase text-zinc-500">
                                      Arquivado
                                    </span>
                                  )}
                                </div>
                                <span className="mt-0.5 block text-[10px] font-bold text-zinc-500">
                                  Criado em {new Date(workout.created_at).toLocaleDateString('pt-BR')}
                                </span>
                              </div>

                              <div className="flex shrink-0 items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openBuilder(
                                      { kind: 'workout', editingId: workout.id },
                                      { studentId: workout.student_id, name: workout.name },
                                    )
                                  }
                                  disabled={openingBuilder}
                                  aria-label={`Editar ${workout.name}`}
                                  className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-emerald-400 hover:text-white"
                                >
                                  <Pencil className="h-4 w-4" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleActive(workout)}
                                  aria-label={workout.is_current ? `Arquivar ${workout.name}` : `Reativar ${workout.name}`}
                                  title={workout.is_current ? 'Arquivar' : 'Reativar'}
                                  className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-400 hover:text-white"
                                >
                                  {workout.is_current ? (
                                    <Archive className="h-4 w-4" aria-hidden="true" />
                                  ) : (
                                    <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteWorkout(workout)}
                                  aria-label={`Apagar ${workout.name}`}
                                  className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-500 hover:text-red-400"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleOpenWorkoutHistory(workout)}
                              className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 text-xs font-bold uppercase text-emerald-400 transition-all hover:bg-emerald-500 hover:text-black active:scale-95"
                            >
                              <Eye className="h-4 w-4" aria-hidden="true" /> Ver cargas registradas
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => openBuilder({ kind: 'workout', editingId: null }, { studentId: student.id })}
                          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900 py-3 text-xs font-bold uppercase text-zinc-400 transition-all hover:text-white"
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar treino
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black uppercase tracking-wide">Modelos prontos</h1>
              <p className="text-xs font-medium text-zinc-500">Treinos pré-definidos para reusar</p>
            </div>
            <button
              type="button"
              onClick={() => openBuilder({ kind: 'template', editingId: null })}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-extrabold uppercase text-black shadow-lg active:scale-95"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Criar modelo
            </button>
          </div>

          {loading ? (
            <PageLoader label="Carregando modelos" />
          ) : templates.length === 0 ? (
            <div className="space-y-3 rounded-3xl border border-zinc-900 bg-zinc-950 p-8 text-center">
              <FolderKanban className="mx-auto h-10 w-10 text-zinc-700" aria-hidden="true" />
              <p className="text-sm font-semibold text-zinc-400">Pastinha de modelos vazia.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div key={template.id} className="space-y-4 rounded-3xl border border-zinc-900 bg-zinc-950 p-5 shadow-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="rounded-md border border-amber-800/40 bg-amber-950/60 px-2 py-0.5 text-[9px] font-black uppercase text-amber-400">
                        Modelo pré-definido
                      </span>
                      <h3 className="mt-1 truncate text-base font-extrabold text-white">{template.name}</h3>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openBuilder({ kind: 'template', editingId: template.id }, { name: template.name })}
                        disabled={openingBuilder}
                        aria-label={`Editar modelo ${template.name}`}
                        className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-emerald-400"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(template)}
                        aria-label={`Apagar modelo ${template.name}`}
                        className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setTemplateToAssign(template)
                      setAssignStudentId('')
                      setAssignError('')
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 py-3 text-xs font-black uppercase text-white transition-all hover:bg-white hover:text-black active:scale-95"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" /> Atribuir a um aluno
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Histórico de cargas do treino */}
      <Modal
        open={historyWorkout !== null}
        onClose={closeHistory}
        variant="sheet"
        title={historyWorkout?.name}
        description={`Cargas registradas por ${historyWorkout?.profiles?.full_name || historyWorkout?.profiles?.email || 'aluno'}`}
      >
        {loadingHistory ? (
          <PageLoader label="Buscando histórico de cargas" />
        ) : (
          <div className="space-y-6">
            {historyError && <Alert variant="error">{historyError}</Alert>}
            {historySessions.length === 0 && !historyError ? (
              <div className="space-y-3 rounded-3xl border border-zinc-900 bg-zinc-950 p-8 text-center">
                <History className="mx-auto h-10 w-10 text-zinc-700" aria-hidden="true" />
                <p className="text-sm font-semibold text-zinc-400">Nenhum treino concluído ainda.</p>
                <p className="text-xs text-zinc-600">
                  Quando o aluno marcar as séries e finalizar o treino, as cargas aparecem aqui.
                </p>
              </div>
            ) : (
              historySessions.map((session) => (
                <div key={session.id} className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-xl">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                    <div>
                      <span className="block text-[9px] font-black uppercase text-zinc-500">Sessão concluída</span>
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-extrabold text-white">
                        <Calendar className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                        {session.completed_at
                          ? new Date(session.completed_at).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-right">
                      <span className="block text-[8px] font-bold uppercase text-zinc-500">Esforço</span>
                      <span className="text-xs font-black text-amber-400">RPE {session.session_rpe ?? '-'}/10</span>
                    </div>
                  </div>

                  {session.groups.length === 0 ? (
                    <p className="py-2 text-center text-xs text-zinc-600">Nenhuma série registrada.</p>
                  ) : (
                    session.groups.map((group) => (
                      <div key={group.name} className="space-y-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-3.5">
                        <h4 className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                          <Dumbbell className="h-3.5 w-3.5" aria-hidden="true" /> {group.name}
                        </h4>
                        <div className="space-y-1.5 pt-1">
                          {group.sets.map((set) => (
                            <div key={set.id} className="flex items-center justify-between rounded-xl bg-black/60 px-3 py-2 text-xs">
                              <span className="text-[11px] font-bold text-zinc-400">Série #{set.set_number}</span>
                              <div className="flex items-center gap-3 font-extrabold text-white">
                                <span className="text-emerald-400">{formatKg(Number(set.weight_kg) || 0)} kg</span>
                                <span className="text-zinc-500">×</span>
                                <span>{set.reps} reps</span>
                                {set.rir !== null && (
                                  <span className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                                    RIR {set.rir}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ))
            )}
          </div>
        )}
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
        <form onSubmit={handleSave} className="space-y-4">
          {builder?.kind === 'workout' && (
            <div>
              <label htmlFor="builder-student" className="mb-1 block text-xs font-semibold uppercase text-zinc-400">
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
            <label htmlFor="builder-name" className="mb-1 block text-xs font-semibold uppercase text-zinc-400">
              Nome
            </label>
            <input
              id="builder-name"
              type="text"
              required
              value={workoutName}
              onChange={(event) => setWorkoutName(event.target.value)}
              placeholder="Ex: Treino A - Peito e tríceps"
              className={inputClassName}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-zinc-400">Exercícios ({selectedExercises.length})</span>
              <button
                type="button"
                onClick={() => setShowExPicker(true)}
                className="flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-black"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Adicionar
              </button>
            </div>

            {selectedExercises.length === 0 && (
              <p className="rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
                Nenhum exercício ainda. Toque em &quot;Adicionar&quot;.
              </p>
            )}

            {selectedExercises.map((item, exIndex) => (
              <div key={item.key} className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-start justify-between gap-2 border-b border-zinc-800 pb-2">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-extrabold text-white">
                      #{exIndex + 1} {item.name}
                    </h4>
                    <p className="text-[10px] font-bold uppercase text-zinc-500">{item.muscle_group}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveExercise(exIndex, -1)}
                      disabled={exIndex === 0}
                      aria-label={`Mover ${item.name} para cima`}
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveExercise(exIndex, 1)}
                      disabled={exIndex === selectedExercises.length - 1}
                      aria-label={`Mover ${item.name} para baixo`}
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedExercises((items) => items.filter((_, index) => index !== exIndex))}
                      aria-label={`Remover ${item.name}`}
                      className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-red-400"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5" aria-label="Aplicar repetições a todas as séries">
                  {REP_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        updateExerciseAt(exIndex, (current) => ({
                          ...current,
                          planned_sets: current.planned_sets.map((set) => ({ ...set, reps: preset })),
                        }))
                      }
                      className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] font-bold text-zinc-400 hover:border-zinc-600 hover:text-white"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {item.planned_sets.map((set, setIndex) => (
                    <div key={setIndex} className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-2">
                      <span className="w-5 text-xs font-bold text-zinc-500">#{setIndex + 1}</span>
                      <select
                        value={set.type}
                        onChange={(event) => updateSetAt(exIndex, setIndex, { type: event.target.value })}
                        aria-label={`Tipo da série ${setIndex + 1}`}
                        className="min-w-0 flex-1 rounded border border-zinc-800 bg-black p-1 text-[11px] text-white"
                      >
                        {SET_TYPES.map((setType) => (
                          <option key={setType.value} value={setType.value}>
                            {setType.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={set.reps ?? ''}
                        onChange={(event) => updateSetAt(exIndex, setIndex, { reps: event.target.value })}
                        placeholder="Reps"
                        aria-label={`Repetições da série ${setIndex + 1}`}
                        className="w-16 rounded border border-zinc-800 bg-black p-1 text-center text-xs text-white"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={set.rir ?? ''}
                        onChange={(event) => updateSetAt(exIndex, setIndex, { rir: event.target.value })}
                        placeholder="RIR"
                        aria-label={`RIR da série ${setIndex + 1}`}
                        className="w-12 rounded border border-zinc-800 bg-black p-1 text-center text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateExerciseAt(exIndex, (current) => ({
                            ...current,
                            planned_sets: current.planned_sets.filter((_, index) => index !== setIndex),
                          }))
                        }
                        aria-label={`Remover série ${setIndex + 1}`}
                        className="rounded p-1 text-zinc-600 hover:text-red-400"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      updateExerciseAt(exIndex, (current) => ({
                        ...current,
                        planned_sets: [...current.planned_sets, { type: 'working', reps: '8-12', rir: 1 }],
                      }))
                    }
                    className="w-full rounded-lg border border-dashed border-zinc-800 py-1.5 text-[10px] text-zinc-400 hover:text-white"
                  >
                    + Série
                  </button>
                </div>

                <textarea
                  value={item.notes}
                  onChange={(event) => updateExerciseAt(exIndex, (current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Observações para o aluno (opcional)"
                  aria-label={`Observações de ${item.name}`}
                  rows={2}
                  className="w-full rounded-xl border border-zinc-800 bg-black p-2.5 text-xs text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
              </div>
            ))}
          </div>

          {builderError && <Alert variant="error">{builderError}</Alert>}

          <button
            type="submit"
            disabled={saving}
            className="mt-4 flex w-full items-center justify-center rounded-xl bg-white py-4 text-xs font-black uppercase text-black disabled:opacity-60"
          >
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-label="Salvando" /> : 'Salvar'}
          </button>
        </form>
      </Modal>

      {/* Escolher exercício da biblioteca */}
      <Modal
        open={showExPicker}
        onClose={closePicker}
        variant="sheet"
        title="Adicionar exercício"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" aria-hidden="true" />
            <input
              type="search"
              value={exSearch}
              onChange={(event) => setExSearch(event.target.value)}
              placeholder="Buscar por nome ou músculo..."
              aria-label="Buscar exercício"
              className={cn(inputClassName, 'pl-10')}
            />
          </div>
          <ul className="space-y-2">
            {filteredLibrary.map((exercise) => (
              <li key={exercise.id}>
                <button
                  type="button"
                  onClick={() => handleAddExercise(exercise)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl bg-zinc-900 p-3 text-left hover:bg-zinc-800"
                >
                  <span>
                    <span className="block text-xs font-bold text-white">{exercise.name}</span>
                    <span className="block text-[10px] font-semibold uppercase text-zinc-500">
                      {exercise.muscle_group || 'Geral'}
                    </span>
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
                </button>
              </li>
            ))}
            {filteredLibrary.length === 0 && (
              <li className="py-6 text-center text-xs text-zinc-500">Nenhum exercício encontrado.</li>
            )}
          </ul>
        </div>
      </Modal>

      {/* Atribuir modelo */}
      <Modal open={templateToAssign !== null} onClose={closeAssign} title="Lançar treino">
        <div className="mb-4 space-y-1">
          <span className="text-[10px] font-black uppercase text-amber-400">Modelo selecionado</span>
          <p className="text-base font-extrabold text-white">{templateToAssign?.name}</p>
        </div>

        <form onSubmit={handleAssignTemplateToStudent} className="space-y-4">
          <div>
            <label htmlFor="assign-student" className="mb-1 block text-xs font-semibold uppercase text-zinc-400">
              Escolha o aluno
            </label>
            <select
              id="assign-student"
              required
              value={assignStudentId}
              onChange={(event) => setAssignStudentId(event.target.value)}
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

          {assignError && <Alert variant="error">{assignError}</Alert>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={closeAssign}
              className="w-1/2 rounded-xl bg-zinc-900 p-3.5 text-xs font-bold uppercase text-zinc-400"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex w-1/2 items-center justify-center rounded-xl bg-white p-3.5 text-xs font-extrabold uppercase text-black disabled:opacity-60"
            >
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-label="Lançando" /> : 'Lançar treino'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
