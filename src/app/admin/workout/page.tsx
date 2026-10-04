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
} from 'lucide-react'

export default function AdminWorkoutsPage() {
  const [workouts, setWorkouts] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [exerciseLibrary, setExerciseLibrary] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Modais e Estados de Edição
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedStudent, setSelectedStudent] = useState('')
  const [workoutName, setWorkoutName] = useState('')
  const [selectedExercises, setSelectedExercises] = useState<any[]>([])

  const [showExPicker, setShowExPicker] = useState(false)
  const [exSearch, setExSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: w } = await supabase
      .from('assigned_workouts')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false })
    const { data: s } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
    const { data: ex } = await supabase
      .from('exercises')
      .select('*')
      .order('name')

    if (w) setWorkouts(w)
    if (s) setStudents(s)
    if (ex) setExerciseLibrary(ex)
    setLoading(false)
  }

  // ABRIR PARA EDITAR TREINO
  const handleEditWorkout = async (workout: any) => {
    setErrorMessage('')
    setEditingId(workout.id)
    setSelectedStudent(workout.student_id)
    setWorkoutName(workout.name)

    const { data: ex, error } = await supabase
      .from('assigned_workout_exercises')
      .select('*, exercises(name, muscle_group, secondary_muscle)')
      .eq('assigned_workout_id', workout.id)
      .order('order', { ascending: true })

    if (error) {
      setErrorMessage('Erro ao carregar exercícios: ' + error.message)
    }

    if (ex && ex.length > 0) {
      const mapped = ex.map((item) => ({
        exercise_id: item.exercise_id,
        name: item.exercises?.name || 'Exercício',
        muscle_group: item.exercises?.muscle_group || 'Geral',
        secondary_muscle: item.exercises?.secondary_muscle || '',
        notes: item.notes || '',
        planned_sets: item.planned_sets && item.planned_sets.length > 0
          ? item.planned_sets
          : [
              { type: 'warmup', reps: '15-20', rir: 4 },
              { type: 'feeder', reps: '10-12', rir: 2 },
              { type: 'working', reps: '8-10', rir: 0 },
            ],
      }))
      setSelectedExercises(mapped)
    } else {
      setSelectedExercises([])
    }
    setShowBuilder(true)
  }

  const handleCreateNew = () => {
    setErrorMessage('')
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
        secondary_muscle: ex.secondary_muscle || '',
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

  const handleAddSetToExercise = (exIdx: number) => {
    const updated = [...selectedExercises]
    const currentSets = updated[exIdx].planned_sets || []
    updated[exIdx].planned_sets = [
      ...currentSets,
      { type: 'working', reps: '8-12', rir: 1 },
    ]
    setSelectedExercises(updated)
  }

  const handleRemoveSetFromExercise = (exIdx: number, setIdx: number) => {
    const updated = [...selectedExercises]
    updated[exIdx].planned_sets = updated[exIdx].planned_sets.filter(
      (_: any, i: number) => i !== setIdx
    )
    setSelectedExercises(updated)
  }

  const handleUpdateIndividualSet = (
    exIdx: number,
    setIdx: number,
    field: string,
    value: any
  ) => {
    const updated = [...selectedExercises]
    updated[exIdx].planned_sets[setIdx][field] = value
    setSelectedExercises(updated)
  }

  const handleRemoveExercise = (index: number) => {
    setSelectedExercises(selectedExercises.filter((_, i) => i !== index))
  }

  // SALVAR COM TRATAMENTO DE ERRO COMPLETO
  const handleSaveWorkout = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!selectedStudent) {
      setErrorMessage('Selecione um aluno.')
      return
    }
    if (!workoutName) {
      setErrorMessage('Informe o nome do treino.')
      return
    }
    if (selectedExercises.length === 0) {
      setErrorMessage('Adicione pelo menos 1 exercício ao treino.')
      return
    }

    setSaving(true)
    let currentWorkoutId = editingId

    try {
      // 1. ATUALIZA OU CRIA O CABEÇALHO DO TREINO
      if (currentWorkoutId) {
        const { error: updateErr } = await supabase
          .from('assigned_workouts')
          .update({ name: workoutName, student_id: selectedStudent, updated_at: new Date().toISOString() })
          .eq('id', currentWorkoutId)

        if (updateErr) throw new Error('Erro ao atualizar treino: ' + updateErr.message)

        // Limpa os exercícios antigos para regravar os novos
        const { error: delErr } = await supabase
          .from('assigned_workout_exercises')
          .delete()
          .eq('assigned_workout_id', currentWorkoutId)

        if (delErr) throw new Error('Erro ao apagar exercícios antigos: ' + delErr.message)
      } else {
        const { data: newW, error: createErr } = await supabase
          .from('assigned_workouts')
          .insert([
            {
              student_id: selectedStudent,
              name: workoutName,
              is_current: true,
            },
          ])
          .select()
          .single()

        if (createErr || !newW) throw new Error('Erro ao criar treino: ' + createErr?.message)
        currentWorkoutId = newW.id
      }

      // 2. GRAVA OS NOVOS EXERCÍCIOS E SÉRIES INDIVIDUAIS
      const rows = selectedExercises.map((item, idx) => ({
        assigned_workout_id: currentWorkoutId,
        exercise_id: item.exercise_id,
        order: idx + 1,
        sets_count: item.planned_sets.length,
        target_reps: item.planned_sets[0]?.reps || '8-12',
        target_rir: item.planned_sets[0]?.rir !== undefined ? Number(item.planned_sets[0].rir) : 2,
        set_type: item.planned_sets[0]?.type || 'working',
        planned_sets: item.planned_sets,
        notes: item.notes || null,
      }))

      const { error: insertExErr } = await supabase
        .from('assigned_workout_exercises')
        .insert(rows)

      if (insertExErr) throw new Error('Erro ao gravar exercícios: ' + insertExErr.message)

      // 3. NOTIFICA O ALUNO
      if (!editingId) {
        await supabase.from('notifications').insert([
          {
            recipient_id: selectedStudent,
            type: 'workout_updated',
            title: 'Novo Treino Prescrito! 💪',
            message: `O treinador Jean lançou seu novo treino: ${workoutName}.`,
          },
        ])
      }

      setShowBuilder(false)
      loadData()
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro desconhecido ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteWorkout = async (workoutId: string) => {
    if (!confirm('Deseja apagar este treino?')) return
    await supabase.from('assigned_workouts').delete().eq('id', workoutId)
    loadData()
  }

  const filteredLibrary = exerciseLibrary.filter(
    (ex) =>
      ex.name.toLowerCase().includes(exSearch.toLowerCase()) ||
      ex.muscle_group.toLowerCase().includes(exSearch.toLowerCase())
  )

  const getSetTypeBadge = (type: string) => {
    switch (type) {
      case 'warmup':
        return { label: 'AQUECIMENTO', color: 'text-amber-400 bg-amber-950/50 border-amber-800/40' }
      case 'feeder':
        return { label: 'FEEDER SET', color: 'text-sky-400 bg-sky-950/50 border-sky-800/40' }
      case 'top':
        return { label: 'TOP SET', color: 'text-rose-400 bg-rose-950/50 border-rose-800/40' }
      case 'backoff':
        return { label: 'BACK-OFF SET', color: 'text-purple-400 bg-purple-950/50 border-purple-800/40' }
      case 'cluster':
        return { label: 'CLUSTER SET', color: 'text-indigo-400 bg-indigo-950/50 border-indigo-800/40' }
      case 'myo_reps':
        return { label: 'MYO REPS', color: 'text-emerald-400 bg-emerald-950/50 border-emerald-800/40' }
      default:
        return { label: 'WORKING SET', color: 'text-zinc-300 bg-zinc-800 border-zinc-700' }
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wide">
            Treinos dos Alunos
          </h1>
          <p className="text-xs text-zinc-500 font-medium">
            Monte e prescreva séries individuais
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="bg-white text-black font-extrabold px-4 py-2.5 rounded-xl text-xs uppercase flex items-center gap-1.5 shadow-lg active:scale-95"
        >
          <Plus className="w-4 h-4" /> Montar Treino
        </button>
      </div>

      {/* Lista de Treinos */}
      {loading ? (
        <div className="flex justify-center py-12 text-zinc-500">
          <Loader2 className="animate-spin w-8 h-8" />
        </div>
      ) : workouts.length === 0 ? (
        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center space-y-2">
          <ClipboardList className="w-10 h-10 text-zinc-700 mx-auto" />
          <p className="text-sm font-semibold text-zinc-400">
            Nenhum treino montado ainda.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {workouts.map((w) => (
            <div
              key={w.id}
              className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 flex items-center justify-between"
            >
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-md">
                  Aluno: {w.profiles?.full_name || w.profiles?.email}
                </span>
                <h3 className="font-extrabold text-base text-white">
                  {w.name}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEditWorkout(w)}
                  className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white hover:bg-zinc-800 transition-all"
                  title="Editar Treino"
                >
                  <Pencil className="w-4 h-4 text-emerald-400" />
                </button>
                <button
                  onClick={() => handleDeleteWorkout(w.id)}
                  className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 hover:text-red-400 transition-all"
                  title="Excluir Treino"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CONSTRUTOR DE TREINOS */}
      {showBuilder && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col justify-between p-4 overflow-y-auto">
          <div className="max-w-md mx-auto w-full space-y-6 pb-20">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-lg font-black uppercase">
                  {editingId ? '✏️ Editar Prescrição' : '⚡ Prescrever Treino'}
                </h2>
                <p className="text-xs text-zinc-500">
                  Configure cada série individualmente
                </p>
              </div>
              <button
                onClick={() => setShowBuilder(false)}
                className="p-2 text-zinc-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-950/80 border border-red-800 rounded-2xl text-red-300 text-xs flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveWorkout} className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase block mb-1">
                  Atleta / Aluno
                </label>
                <select
                  required
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-sm text-white focus:border-white"
                >
                  <option value="">Selecione um aluno...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name || s.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase block mb-1">
                  Nome do Treino
                </label>
                <input
                  type="text"
                  required
                  value={workoutName}
                  onChange={(e) => setWorkoutName(e.target.value)}
                  placeholder="Ex: Treino A - Peitoral e Deltoides"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-sm text-white focus:border-white"
                />
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase text-zinc-300">
                    Exercícios Prescritos ({selectedExercises.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowExPicker(true)}
                    className="bg-white text-black font-bold text-xs uppercase px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-md"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Exercício
                  </button>
                </div>

                <div className="space-y-6">
                  {selectedExercises.map((item, exIdx) => (
                    <div
                      key={exIdx}
                      className="bg-zinc-950 border border-zinc-800 rounded-3xl p-4 space-y-4 shadow-xl"
                    >
                      <div className="flex items-start justify-between border-b border-zinc-900 pb-3">
                        <div>
                          <h4 className="font-extrabold text-base text-white">
                            #{exIdx + 1} {item.name}
                          </h4>
                          <p className="text-[10px] text-zinc-400 font-medium mt-0.5">
                            <span className="text-emerald-400 font-bold">
                              Alvo:
                            </span>{' '}
                            {item.muscle_group}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveExercise(exIdx)}
                          className="text-zinc-500 hover:text-red-400 p-1"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                            SÉRIES INDIVIDUAIS ({item.planned_sets.length})
                          </span>
                        </div>

                        {item.planned_sets.map((s: any, setIdx: number) => {
                          const badge = getSetTypeBadge(s.type)
                          return (
                            <div
                              key={setIdx}
                              className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-zinc-400">
                                    0{setIdx + 1}
                                  </span>
                                  <span
                                    className={`text-[9px] font-black uppercase border px-2 py-0.5 rounded-md ${badge.color}`}
                                  >
                                    {badge.label}
                                  </span>
                                </div>
                                {item.planned_sets.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveSetFromExercise(
                                        exIdx,
                                        setIdx
                                      )
                                    }
                                    className="text-zinc-600 hover:text-red-400 p-1"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-3 gap-2 pt-1">
                                <div>
                                  <label className="text-[8px] font-bold text-zinc-500 uppercase block mb-1">
                                    Tipo
                                  </label>
                                  <select
                                    value={s.type}
                                    onChange={(e) =>
                                      handleUpdateIndividualSet(
                                        exIdx,
                                        setIdx,
                                        'type',
                                        e.target.value
                                      )
                                    }
                                    className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-[10px] font-bold text-white focus:outline-none"
                                  >
                                    <option value="warmup">Aquecimento</option>
                                    <option value="feeder">Feeder Set</option>
                                    <option value="working">
                                      Working Set (Normal)
                                    </option>
                                    <option value="top">Top Set</option>
                                    <option value="backoff">
                                      Back-off Set
                                    </option>
                                    <option value="cluster">Cluster Set</option>
                                    <option value="myo_reps">Myo Reps</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="text-[8px] font-bold text-zinc-500 uppercase block mb-1">
                                    Reps Alvo
                                  </label>
                                  <input
                                    type="text"
                                    value={s.reps}
                                    onChange={(e) =>
                                      handleUpdateIndividualSet(
                                        exIdx,
                                        setIdx,
                                        'reps',
                                        e.target.value
                                      )
                                    }
                                    placeholder="Ex: 8-10"
                                    className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-center text-xs font-bold text-white focus:outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="text-[8px] font-bold text-zinc-500 uppercase block mb-1">
                                    RIR Alvo
                                  </label>
                                  <input
                                    type="number"
                                    value={s.rir}
                                    onChange={(e) =>
                                      handleUpdateIndividualSet(
                                        exIdx,
                                        setIdx,
                                        'rir',
                                        e.target.value
                                      )
                                    }
                                    placeholder="0 (Falha)"
                                    className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-center text-xs font-bold text-white focus:outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        })}

                        <button
                          type="button"
                          onClick={() => handleAddSetToExercise(exIdx)}
                          className="w-full py-2 bg-zinc-900 border border-dashed border-zinc-800 text-zinc-400 font-bold text-[10px] uppercase rounded-xl flex items-center justify-center gap-1 hover:text-white transition-all mt-2"
                        >
                          <Plus className="w-3 h-3" /> Adicionar Série
                        </button>
                      </div>

                      <div>
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) => {
                            const updated = [...selectedExercises]
                            updated[exIdx].notes = e.target.value
                            setSelectedExercises(updated)
                          }}
                          placeholder="Obs do Treinador (ex: Descanso de 3min)"
                          className="w-full bg-black/60 border border-zinc-800/80 rounded-xl p-3 text-xs text-white focus:outline-none placeholder:text-zinc-600"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || selectedExercises.length === 0}
                className="w-full bg-white text-black font-black text-sm uppercase py-4 rounded-2xl flex items-center justify-center gap-2 mt-6 active:scale-95 transition-all shadow-xl"
              >
                {saving ? (
                  <Loader2 className="animate-spin w-5 h-5" />
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />{' '}
                    {editingId
                      ? 'SALVAR E ATUALIZAR TREINO'
                      : 'ENVIAR TREINO AO ALUNO'}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {showExPicker && (
        <div className="fixed inset-0 bg-black/95 z-50 p-4 flex flex-col justify-between">
          <div className="max-w-md mx-auto w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black uppercase text-sm">
                Adicionar Exercício
              </h3>
              <button
                onClick={() => setShowExPicker(false)}
                className="text-zinc-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="text"
                value={exSearch}
                onChange={(e) => setExSearch(e.target.value)}
                placeholder="Buscar por músculo ou exercício..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white"
              />
            </div>
            <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
              {filteredLibrary.map((ex) => (
                <div
                  key={ex.id}
                  onClick={() => handleAddExerciseToWorkout(ex)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex justify-between cursor-pointer active:scale-98 transition-all"
                >
                  <div>
                    <h4 className="font-bold text-xs text-white">{ex.name}</h4>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Alvo: {ex.muscle_group}
                    </p>
                  </div>
                  <Plus className="w-4 h-4 text-zinc-400 my-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
  
