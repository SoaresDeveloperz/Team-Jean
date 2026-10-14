'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'
import {
  ClipboardList,
  Plus,
  Trash2,
  Pencil,
  Dumbbell,
  Loader2,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FolderKanban,
  Send,
  Users,
  Sparkles,
  Eye,
  Calendar,
  Award,
  History,
} from 'lucide-react'

export default function AdminWorkoutsPage() {
  const [activeTab, setActiveTab] = useState<'students' | 'templates'>('students')

  const [workouts, setWorkouts] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [exerciseLibrary, setExerciseLibrary] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Controle de Sanfona dos Alunos
  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({})

  // Modal e Estado do Visualizador de Cargas do Treino (NOVO!)
  const [showWorkoutHistoryModal, setShowWorkoutHistoryModal] = useState(false)
  const [selectedWorkoutForHistory, setSelectedWorkoutForHistory] = useState<any>(null)
  const [workoutSessionsHistory, setWorkoutSessionsHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Modais de Construtor
  const [showBuilder, setShowBuilder] = useState(false)
  const [isTemplateMode, setIsTemplateModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedStudent, setSelectedStudent] = useState('')
  const [workoutName, setWorkoutName] = useState('')
  const [selectedExercises, setSelectedExercises] = useState<any[]>([])

  const [showAssignModal, setShowAssignModal] = useState(false)
  const [templateToAssign, setTemplateToAssign] = useState<any>(null)
  const [assignStudentId, setAssignStudentId] = useState('')

  const [showExPicker, setShowExPicker] = useState(false)
  const [exSearch, setExSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const supabase = createClient()
  const REP_PRESETS = ['6-8', '8-10', '8-12', '10-12', '12-15', '15-20', 'Até a Falha']

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: w } = await supabase
      .from('assigned_workouts')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false })

    const { data: t } = await supabase
      .from('workout_templates')
      .select('*')
      .order('name', { ascending: true })

    const { data: s } = await supabase.from('profiles').select('*').eq('role', 'student')
    const { data: ex } = await supabase.from('exercises').select('*').order('name')

    if (w) setWorkouts(w)
    if (t) setTemplates(t)
    if (s) setStudents(s)
    if (ex) setExerciseLibrary(ex)
    setLoading(false)
  }

  const toggleStudentAccordion = (studentId: string) => {
    setExpandedStudents((prev) => ({ ...prev, [studentId]: !prev[studentId] }))
  }

  // CARREGAR CARGAS REGISTRADAS DO TREINO ESPECÍFICO
  const handleOpenWorkoutHistory = async (workout: any) => {
    setSelectedWorkoutForHistory(workout)
    setShowWorkoutHistoryModal(true)
    setLoadingHistory(true)

    // Busca as sessões concluídas deste treino específico
    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('assigned_workout_id', workout.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })

    if (sessions && sessions.length > 0) {
      const detailedSessions = await Promise.all(
        sessions.map(async (sess) => {
          const { data: sets } = await supabase
            .from('session_sets')
            .select('*, exercises(name, muscle_group)')
            .eq('session_id', sess.id)
            .order('set_number', { ascending: true })

          return {
            ...sess,
            sets: sets || [],
          }
        })
      )
      setWorkoutSessionsHistory(detailedSessions)
    } else {
      setWorkoutSessionsHistory([])
    }

    setLoadingHistory(false)
  }

  const handleEditWorkout = async (workout: any) => {
    setErrorMessage('')
    setIsTemplateModal(false)
    setEditingId(workout.id)
    setSelectedStudent(workout.student_id)
    setWorkoutName(workout.name)

    const { data: ex } = await supabase
      .from('assigned_workout_exercises')
      .select('*, exercises(name, muscle_group, secondary_muscle)')
      .eq('assigned_workout_id', workout.id)
      .order('order', { ascending: true })

    if (ex && ex.length > 0) {
      setSelectedExercises(
        ex.map((item) => ({
          exercise_id: item.exercise_id,
          name: item.exercises?.name || 'Exercício',
          muscle_group: item.exercises?.muscle_group || 'Geral',
          notes: item.notes || '',
          planned_sets: item.planned_sets || [
            { type: 'warmup', reps: '15-20', rir: 4 },
            { type: 'working', reps: '6-8', rir: 0 },
          ],
        }))
      )
    } else {
      setSelectedExercises([])
    }
    setShowBuilder(true)
  }

  const handleEditTemplate = async (template: any) => {
    setErrorMessage('')
    setIsTemplateModal(true)
    setEditingId(template.id)
    setSelectedStudent('')
    setWorkoutName(template.name)

    const { data: ex } = await supabase
      .from('workout_template_exercises')
      .select('*, exercises(name, muscle_group, secondary_muscle)')
      .eq('template_id', template.id)
      .order('order', { ascending: true })

    if (ex && ex.length > 0) {
      setSelectedExercises(
        ex.map((item) => ({
          exercise_id: item.exercise_id,
          name: item.exercises?.name || 'Exercício',
          muscle_group: item.exercises?.muscle_group || 'Geral',
          notes: item.notes || '',
          planned_sets: item.planned_sets || [
            { type: 'warmup', reps: '15-20', rir: 4 },
            { type: 'working', reps: '6-8', rir: 0 },
          ],
        }))
      )
    } else {
      setSelectedExercises([])
    }
    setShowBuilder(true)
  }

  const handleCreateNewWorkout = (studentId?: string) => {
    setErrorMessage('')
    setIsTemplateModal(false)
    setEditingId(null)
    setSelectedStudent(studentId || '')
    setWorkoutName('')
    setSelectedExercises([])
    setShowBuilder(true)
  }

  const handleCreateNewTemplate = () => {
    setErrorMessage('')
    setIsTemplateModal(true)
    setEditingId(null)
    setSelectedStudent('')
    setWorkoutName('')
    setSelectedExercises([])
    setShowBuilder(true)
  }

  const handleAddExerciseToWorkout = (ex: any) => {
    setSelectedExercises([
      ...selectedExercises,
      {
        exercise_id: ex.id,
        name: ex.name,
        muscle_group: ex.muscle_group,
        notes: '',
        planned_sets: [
          { type: 'warmup', reps: '15-20', rir: 4 },
          { type: 'feeder', reps: '10-12', rir: 2 },
          { type: 'working', reps: '8-10', rir: 0 },
        ],
      },
    ])
    setShowExPicker(false)
  }

  const handleMoveExercise = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === selectedExercises.length - 1)
    ) return
    const updated = [...selectedExercises]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    setSelectedExercises(updated)
  }

  const handleAddSetToExercise = (exIdx: number) => {
    const updated = [...selectedExercises]
    const currentSets = updated[exIdx].planned_sets || []
    updated[exIdx].planned_sets = [...currentSets, { type: 'working', reps: '8-12', rir: 1 }]
    setSelectedExercises(updated)
  }

  const handleRemoveSetFromExercise = (exIdx: number, setIdx: number) => {
    const updated = [...selectedExercises]
    updated[exIdx].planned_sets = updated[exIdx].planned_sets.filter((_: any, i: number) => i !== setIdx)
    setSelectedExercises(updated)
  }

  const handleUpdateIndividualSet = (exIdx: number, setIdx: number, field: string, value: any) => {
    const updated = [...selectedExercises]
    updated[exIdx].planned_sets[setIdx][field] = value
    setSelectedExercises(updated)
  }

  const handleApplyPresetToAllSets = (exIdx: number, presetReps: string) => {
    const updated = [...selectedExercises]
    updated[exIdx].planned_sets = updated[exIdx].planned_sets.map((s: any) => ({ ...s, reps: presetReps }))
    setSelectedExercises(updated)
  }

  const handleRemoveExercise = (index: number) => {
    setSelectedExercises(selectedExercises.filter((_, i) => i !== index))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!isTemplateMode && !selectedStudent) {
      setErrorMessage('Selecione um aluno.')
      return
    }
    if (!workoutName) {
      setErrorMessage('Informe o nome.')
      return
    }
    if (selectedExercises.length === 0) {
      setErrorMessage('Adicione pelo menos 1 exercício.')
      return
    }

    setSaving(true)

    try {
      if (isTemplateMode) {
        let templateId = editingId
        if (templateId) {
          await supabase.from('workout_templates').update({ name: workoutName }).eq('id', templateId)
          await supabase.from('workout_template_exercises').delete().eq('template_id', templateId)
        } else {
          const { data: newT } = await supabase.from('workout_templates').insert([{ name: workoutName }]).select().single()
          if (newT) templateId = newT.id
        }

        const rows = selectedExercises.map((item, idx) => ({
          template_id: templateId,
          exercise_id: item.exercise_id,
          order: idx + 1,
          sets_count: item.planned_sets.length,
          target_reps: item.planned_sets[0]?.reps || '8-12',
          planned_sets: item.planned_sets,
          notes: item.notes || null,
        }))

        await supabase.from('workout_template_exercises').insert(rows)
      } else {
        let currentWorkoutId = editingId
        if (currentWorkoutId) {
          await supabase.from('assigned_workouts').update({ name: workoutName, student_id: selectedStudent }).eq('id', currentWorkoutId)
          await supabase.from('assigned_workout_exercises').delete().eq('assigned_workout_id', currentWorkoutId)
        } else {
          const { data: newW } = await supabase.from('assigned_workouts').insert([{ student_id: selectedStudent, name: workoutName, is_current: true }]).select().single()
          if (newW) currentWorkoutId = newW.id
        }

        const rows = selectedExercises.map((item, idx) => ({
          assigned_workout_id: currentWorkoutId,
          exercise_id: item.exercise_id,
          order: idx + 1,
          sets_count: item.planned_sets.length,
          target_reps: item.planned_sets[0]?.reps || '8-12',
          planned_sets: item.planned_sets,
          notes: item.notes || null,
        }))

        await supabase.from('assigned_workout_exercises').insert(rows)
      }

      setShowBuilder(false)
      loadData()
    } catch (err: any) {
      setErrorMessage(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAssignTemplateToStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!templateToAssign || !assignStudentId) return
    setSaving(true)

    try {
      const { data: tExercises } = await supabase
        .from('workout_template_exercises')
        .select('*')
        .eq('template_id', templateToAssign.id)

      const { data: newWorkout, error: wErr } = await supabase
        .from('assigned_workouts')
        .insert([{ student_id: assignStudentId, name: templateToAssign.name, is_current: true }])
        .select()
        .single()

      if (wErr || !newWorkout) throw new Error('Erro ao atribuir: ' + wErr?.message)

      if (tExercises && tExercises.length > 0) {
        const rows = tExercises.map((item) => ({
          assigned_workout_id: newWorkout.id,
          exercise_id: item.exercise_id,
          order: item.order,
          sets_count: item.sets_count,
          target_reps: item.target_reps,
          planned_sets: item.planned_sets,
          notes: item.notes,
        }))

        await supabase.from('assigned_workout_exercises').insert(rows)
      }

      await supabase.from('notifications').insert([{ recipient_id: assignStudentId, type: 'workout_updated', title: 'Treino Lançado! 💪', message: `O treinador Jean atribuiu o treino: ${templateToAssign.name}.` }])

      setShowAssignModal(false)
      setActiveTab('students')
      setExpandedStudents((prev) => ({ ...prev, [assignStudentId]: true }))
      loadData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteWorkout = async (id: string) => {
    if (!confirm('Deseja apagar este treino?')) return
    await supabase.from('assigned_workouts').delete().eq('id', id)
    loadData()
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Deseja apagar este modelo pré-definido?')) return
    await supabase.from('workout_templates').delete().eq('id', id)
    loadData()
  }

  const filteredLibrary = exerciseLibrary.filter(
    (ex) => ex.name.toLowerCase().includes(exSearch.toLowerCase()) || ex.muscle_group.toLowerCase().includes(exSearch.toLowerCase())
  )

  const studentGroups = students.map((student) => ({
    student,
    workouts: workouts.filter((w) => w.student_id === student.id),
  }))

  return (
    <div className="space-y-6 pb-20">
      {/* SELETOR DE ABAS DO TOPO */}
      <div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-zinc-900 shadow-xl">
        <button
          onClick={() => setActiveTab('students')}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
            activeTab === 'students' ? 'bg-white text-black shadow-lg' : 'text-zinc-500 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" /> Alunos ({students.length})
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
            activeTab === 'templates' ? 'bg-white text-black shadow-lg' : 'text-zinc-500 hover:text-white'
          }`}
        >
          <FolderKanban className="w-4 h-4" /> Pastinha ({templates.length})
        </button>
      </div>

      {/* ABA 1: TREINOS DOS ALUNOS */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black uppercase tracking-wide">Treinos Atribuídos</h1>
              <p className="text-xs text-zinc-500 font-medium">Veja as cargas e prescreva treinos</p>
            </div>
            <button
              onClick={() => handleCreateNewWorkout()}
              className="bg-white text-black font-extrabold px-4 py-2.5 rounded-xl text-xs uppercase flex items-center gap-1.5 shadow-lg active:scale-95"
            >
              <Plus className="w-4 h-4" /> Criar Treino
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12 text-zinc-500"><Loader2 className="animate-spin w-8 h-8" /></div>
          ) : (
            <div className="space-y-4">
              {studentGroups.map(({ student, workouts: sWorkouts }) => {
                const isExpanded = !!expandedStudents[student.id]
                return (
                  <div key={student.id} className="bg-zinc-950 border border-zinc-900 rounded-3xl overflow-hidden shadow-xl">
                    <div
                      onClick={() => toggleStudentAccordion(student.id)}
                      className="p-5 flex items-center justify-between cursor-pointer hover:bg-zinc-900/50 transition-colors select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-zinc-900 rounded-2xl flex items-center justify-center font-black text-white text-sm border border-zinc-800">
                          {student.full_name ? student.full_name.substring(0, 2).toUpperCase() : 'AL'}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-base text-white">{student.full_name || 'Aluno sem nome'}</h3>
                          <p className="text-[11px] text-zinc-500 font-medium">{sWorkouts.length} {sWorkouts.length === 1 ? 'Treino Prescrito' : 'Treinos Prescritos'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-1 rounded-lg">{sWorkouts.length}</span>
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-white" /> : <ChevronDown className="w-5 h-5 text-zinc-500" />}
                      </div>
                    </div>

                    {/* TREINOS DO ALUNO EXPANDIDOS */}
                    {isExpanded && (
                      <div className="border-t border-zinc-900 bg-black/60 p-4 space-y-3">
                        {sWorkouts.length === 0 ? (
                          <div className="p-4 text-center text-xs text-zinc-600 font-medium space-y-2">
                            <p>Nenhum treino prescrito para este aluno.</p>
                            <button onClick={() => handleCreateNewWorkout(student.id)} className="text-emerald-400 font-bold hover:underline">+ Prescrever Treino</button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {sWorkouts.map((w) => (
                              <div key={w.id} className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h4 className="font-extrabold text-base text-white">{w.name}</h4>
                                    <span className="text-[9px] font-bold text-zinc-500 block mt-0.5">
                                      Criado em {new Date(w.created_at).toLocaleDateString('pt-BR')}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <button onClick={() => handleEditWorkout(w)} className="p-2 bg-zinc-950 border border-zinc-800 rounded-xl text-emerald-400 hover:text-white" title="Editar Treino"><Pencil className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteWorkout(w.id)} className="p-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-500 hover:text-red-400" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                </div>

                                {/* BOTÃO NOVO PARA O JEAN VER AS CARGAS REGISTRADAS DESTE TREINO! */}
                                <button
                                  onClick={() => handleOpenWorkoutHistory(w)}
                                  className="w-full bg-zinc-950 hover:bg-emerald-500 hover:text-black border border-zinc-800 text-emerald-400 font-bold text-xs uppercase py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                                >
                                                                    <Eye className="w-4 h-4" /> Ver Cargas Registradas do Aluno
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          onClick={() => handleCreateNewWorkout(student.id)}
                          className="w-full py-3 bg-zinc-900 border border-dashed border-zinc-800 rounded-2xl text-xs font-bold text-zinc-400 hover:text-white uppercase flex items-center justify-center gap-1.5 transition-all mt-2"
                        >
                          <Plus className="w-4 h-4" /> Adicionar Mais um Treino
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

      {/* ABA 2: PASTINHA DE MODELOS PRONTOS */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black uppercase tracking-wide">Modelos Prontos</h1>
              <p className="text-xs text-zinc-500 font-medium">Treinos pré-definidos para reusar</p>
            </div>
            <button
              onClick={() => handleCreateNewTemplate()}
              className="bg-white text-black font-extrabold px-4 py-2.5 rounded-xl text-xs uppercase flex items-center gap-1.5 shadow-lg active:scale-95"
            >
              <Plus className="w-4 h-4" /> Criar Modelo
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12 text-zinc-500"><Loader2 className="animate-spin w-8 h-8" /></div>
          ) : templates.length === 0 ? (
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center space-y-3">
              <FolderKanban className="w-10 h-10 text-zinc-700 mx-auto" />
              <p className="text-sm font-semibold text-zinc-400">Pastinha de modelos vazia.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((t) => (
                <div key={t.id} className="bg-zinc-950 border border-zinc-900 rounded-3xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-950/60 border border-amber-800/40 px-2 py-0.5 rounded-md">MODELO PRÉ-DEFINIDO</span>
                      <h3 className="font-extrabold text-base text-white mt-1">{t.name}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEditTemplate(t)} className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-emerald-400"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteTemplate(t.id)} className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setTemplateToAssign(t)
                      setAssignStudentId('')
                      setShowAssignModal(true)
                    }}
                    className="w-full bg-zinc-900 hover:bg-white hover:text-black border border-zinc-800 text-white font-black text-xs uppercase py-3 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Send className="w-4 h-4" /> Atribuir a um Aluno
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 👁️ VISUALIZADOR DE CARGAS REGISTRADAS DESTE TREINO */}
      {showWorkoutHistoryModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col justify-between p-4 overflow-y-auto">
          <div className="max-w-md mx-auto w-full space-y-6 pb-20">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">
                  CARGAS REGISTRADAS PELO ALUNO
                </span>
                <h2 className="text-lg font-black uppercase text-white">
                  {selectedWorkoutForHistory?.name}
                </h2>
                <p className="text-xs text-zinc-500">
                  Atleta: {selectedWorkoutForHistory?.profiles?.full_name || selectedWorkoutForHistory?.profiles?.email}
                </p>
              </div>
              <button onClick={() => setShowWorkoutHistoryModal(false)} className="p-2 text-zinc-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-500">
                <Loader2 className="animate-spin w-8 h-8 text-white" />
                <p className="text-xs uppercase font-bold tracking-widest">Buscando histórico de cargas...</p>
              </div>
            ) : workoutSessionsHistory.length === 0 ? (
              <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center space-y-3">
                <History className="w-10 h-10 text-zinc-700 mx-auto" />
                <p className="text-sm font-semibold text-zinc-400">Nenhum registro de execução ainda.</p>
                <p className="text-xs text-zinc-600">Assim que o aluno treinar na academia e marcar as séries, os pesos (kg) e repetições aparecem aqui!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {workoutSessionsHistory.map((session) => (
                  <div key={session.id} className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                      <div>
                        <span className="text-[9px] font-black uppercase text-zinc-500 block">SESSÃO CONCLUÍDA</span>
                        <p className="text-xs font-extrabold text-white flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                          {new Date(session.completed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl text-right">
                        <span className="text-[8px] font-bold text-zinc-500 uppercase block">Esforço</span>
                        <span className="text-xs font-black text-amber-400">RPE {session.session_rpe || '-'}/10</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {session.sets && session.sets.length > 0 ? (
                        session.sets.reduce((acc: any[], setItem: any) => {
                          const exName = setItem.exercises?.name || 'Exercício'
                          const existing = acc.find((e) => e.name === exName)
                          if (existing) { existing.sets.push(setItem) } else { acc.push({ name: exName, sets: [setItem] }) }
                          return acc
                        }, []).map((group: any, gIdx: number) => (
                          <div key={gIdx} className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-3.5 space-y-2">
                            <h4 className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                              <Dumbbell className="w-3.5 h-3.5" /> {group.name}
                            </h4>

                            <div className="space-y-1.5 pt-1">
                              {group.sets.map((s: any, sIdx: number) => (
                                <div key={sIdx} className="flex items-center justify-between bg-black/60 px-3 py-2 rounded-xl text-xs">
                                  <span className="font-bold text-zinc-400 text-[11px]">Série #{s.set_number}</span>
                                  <div className="flex items-center gap-3 font-extrabold text-white">
                                    <span className="text-emerald-400">{s.weight_kg} kg</span>
                                    <span className="text-zinc-500">×</span>
                                    <span>{s.reps} reps</span>
                                    {s.rir !== null && <span className="text-[10px] font-medium text-zinc-500 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">RIR {s.rir}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-zinc-600 text-center py-2">Nenhuma série registrada.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL CONSTRUTOR / EDITOR */}
      {showBuilder && (
        <div className="fixed inset-0 bg-black/95 z-50 p-4 overflow-y-auto">
          <div className="max-w-md mx-auto space-y-6 pb-20">
            <div className="flex justify-between border-b border-zinc-800 pb-4">
              <h2 className="text-lg font-black uppercase">{isTemplateMode ? '📁 Modelo' : '⚡ Treino'}</h2>
              <button onClick={() => setShowBuilder(false)} className="text-zinc-400"><X className="w-6 h-6" /></button>
            </div>

            {errorMessage && <p className="text-xs text-red-400 font-bold">{errorMessage}</p>}

            <form onSubmit={handleSave} className="space-y-4">
              {!isTemplateMode && (
                <select required value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white">
                  <option value="">Selecione um aluno...</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
                </select>
              )}

              <input type="text" required value={workoutName} onChange={(e) => setWorkoutName(e.target.value)} placeholder="Nome" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white" />

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase text-zinc-400">Exercícios ({selectedExercises.length})</span>
                  <button type="button" onClick={() => setShowExPicker(true)} className="bg-white text-black font-bold text-xs p-2 rounded-lg">+ Adicionar</button>
                </div>

                {selectedExercises.map((item, exIdx) => (
                  <div key={exIdx} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between border-b border-zinc-800 pb-2">
                      <h4 className="font-extrabold text-sm text-white">#{exIdx + 1} {item.name}</h4>
                      <button type="button" onClick={() => handleRemoveExercise(exIdx)} className="text-zinc-500"><X className="w-4 h-4" /></button>
                    </div>

                    <div className="space-y-2">
                      {item.planned_sets.map((s: any, setIdx: number) => (
                        <div key={setIdx} className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 flex gap-2 items-center">
                          <span className="text-xs text-zinc-500 font-bold">#{setIdx + 1}</span>
                          <select value={s.type} onChange={(e) => handleUpdateIndividualSet(exIdx, setIdx, 'type', e.target.value)} className="bg-black text-[10px] p-1 rounded text-white border border-zinc-800">
                            <option value="warmup">Aquecimento</option>
                            <option value="feeder">Feeder</option>
                            <option value="working">Working</option>
                            <option value="top">Top Set</option>
                          </select>
                          <input type="text" value={s.reps} onChange={(e) => handleUpdateIndividualSet(exIdx, setIdx, 'reps', e.target.value)} placeholder="Reps" className="bg-black text-xs text-center p-1 rounded w-16 text-white border border-zinc-800" />
                          <input type="number" value={s.rir} onChange={(e) => handleUpdateIndividualSet(exIdx, setIdx, 'rir', e.target.value)} placeholder="RIR" className="bg-black text-xs text-center p-1 rounded w-12 text-white border border-zinc-800" />
                        </div>
                      ))}
                      <button type="button" onClick={() => handleAddSetToExercise(exIdx)} className="w-full text-[10px] text-zinc-400 border border-dashed border-zinc-800 py-1.5 rounded-lg">+ Série</button>
                    </div>
                  </div>
                ))}
              </div>

              <button type="submit" disabled={saving} className="w-full bg-white text-black font-black py-4 rounded-xl text-xs uppercase mt-4">
                {saving ? <Loader2 className="animate-spin w-4 h-4 mx-auto" /> : 'Salvar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ATRIBUIR MODELO */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black uppercase">Lançar Treino</h2>
              <button onClick={() => setShowAssignModal(false)} className="text-zinc-400"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-amber-400">Modelo Selecionado:</span>
              <p className="font-extrabold text-base text-white">{templateToAssign?.name}</p>
            </div>

            <form onSubmit={handleAssignTemplateToStudent} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase block mb-1">Escolha o Aluno</label>
                <select required value={assignStudentId} onChange={(e) => setAssignStudentId(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-sm text-white">
                  <option value="">Selecione um aluno...</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAssignModal(false)} className="w-1/2 bg-zinc-900 text-zinc-400 font-bold p-3.5 rounded-xl text-xs uppercase">Cancelar</button>
                <button type="submit" disabled={saving} className="w-1/2 bg-white text-black font-extrabold p-3.5 rounded-xl text-xs uppercase flex items-center justify-center">
                  {saving ? <Loader2 className="animate-spin w-4 h-4" /> : 'Lançar Treino'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BUSCA EXERCÍCIO */}
      {showExPicker && (
        <div className="fixed inset-0 bg-black/95 z-50 p-4">
          <div className="max-w-md mx-auto space-y-4">
            <div className="flex justify-between"><h3 className="font-bold uppercase text-sm">Adicionar Exercício</h3><button onClick={() => setShowExPicker(false)}><X className="w-5 h-5" /></button></div>
            <input type="text" value={exSearch} onChange={(e) => setExSearch(e.target.value)} placeholder="Buscar..." className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white" />
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {filteredLibrary.map((ex) => (
                <div key={ex.id} onClick={() => handleAddExerciseToWorkout(ex)} className="bg-zinc-900 p-3 rounded-xl flex justify-between cursor-pointer">
                  <span className="text-xs font-bold text-white">{ex.name}</span>
                  <Plus className="w-4 h-4 text-zinc-400" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
                          }
