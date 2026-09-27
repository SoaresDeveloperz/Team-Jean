'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'
import {
  ClipboardList,
  Plus,
  Trash2,
  Dumbbell,
  Loader2,
  Search,
  X,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'

export default function AdminWorkoutsPage() {
  const [workouts, setWorkouts] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [exerciseLibrary, setExerciseLibrary] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Estados do Modal Construtor de Treino
  const [showBuilder, setShowBuilder] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState('')
  const [workoutName, setWorkoutName] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState<number>(1)
  
  // Lista de exercícios adicionados ao novo treino
  // Array de: { exercise_id, name, muscle_group, sets_count, target_reps, target_rir, set_type, notes }
  const [selectedExercises, setSelectedExercises] = useState<any[]>([])
  
  // Modal auxiliar para buscar e escolher exercício
  const [showExPicker, setShowExPicker] = useState(false)
  const [exSearch, setExSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    // 1. Busca treinos atribuídos
    const { data: w } = await supabase
      .from('assigned_workouts')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false })

    // 2. Busca alunos
    const { data: s } = await supabase.from('profiles').select('*').eq('role', 'student')

    // 3. Busca biblioteca de exercícios
    const { data: ex } = await supabase.from('exercises').select('*').order('name')

    if (w) setWorkouts(w)
    if (s) setStudents(s)
    if (ex) setExerciseLibrary(ex)
    setLoading(false)
  }

  // Adiciona um exercício à lista do treino sendo construído
  const handleAddExerciseToWorkout = (ex: any) => {
    const newItem = {
      exercise_id: ex.id,
      name: ex.name,
      muscle_group: ex.muscle_group,
      sets_count: 3,
      target_reps: '8-12',
      target_rir: 2,
      set_type: 'normal',
      notes: '',
    }
    setSelectedExercises([...selectedExercises, newItem])
    setShowExPicker(false)
  }

  // Atualiza campo de um exercício selecionado
  const handleUpdateItem = (index: number, field: string, value: any) => {
    const updated = [...selectedExercises]
    updated[index] = { ...updated[index], [field]: value }
    setSelectedExercises(updated)
  }

  // Remove um exercício da lista em construção
  const handleRemoveItem = (index: number) => {
    setSelectedExercises(selectedExercises.filter((_, i) => i !== index))
  }

  // Salva o treino completo no banco
  const handleSaveWorkout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudent || !workoutName || selectedExercises.length === 0) return

    setSaving(true)

    // 1. Cria o registro do Treino Atribuído
    const { data: newWorkout, error: wError } = await supabase
      .from('assigned_workouts')
      .insert([
        {
          student_id: selectedStudent,
          name: workoutName,
          day_of_week: dayOfWeek,
          is_current: true,
        },
      ])
      .select()
      .single()

    if (wError || !newWorkout) {
      alert('Erro ao criar treino: ' + wError?.message)
      setSaving(false)
      return
    }

    // 2. Cria os exercícios do treino (assigned_workout_exercises)
    const exerciseRows = selectedExercises.map((item, idx) => ({
      assigned_workout_id: newWorkout.id,
      exercise_id: item.exercise_id,
      order: idx + 1,
      sets_count: Number(item.sets_count) || 3,
      target_reps: item.target_reps || '8-12',
      target_rir: item.target_rir ? Number(item.target_rir) : null,
      set_type: item.set_type || 'normal',
      notes: item.notes || null,
    }))

    const { error: exError } = await supabase
      .from('assigned_workout_exercises')
      .insert(exerciseRows)

    if (!exError) {
      // 3. Envia notificação para o aluno: "Treino Atualizado"
      await supabase.from('notifications').insert([
        {
          recipient_id: selectedStudent,
          type: 'workout_updated',
          title: 'Treino Atualizado! 💪',
          message: `O treinador Jean lançou o seu novo treino: ${workoutName}.`,
        },
      ])

      // Reseta formulário
      setWorkoutName('')
      setSelectedStudent('')
      setSelectedExercises([])
      setShowBuilder(false)
      loadData()
    } else {
      alert('Erro ao salvar exercícios: ' + exError.message)
    }

    setSaving(false)
  }

  // Deletar um treino
  const handleDeleteWorkout = async (workoutId: string) => {
    if (!confirm('Deseja realmente apagar este treino?')) return
    await supabase.from('assigned_workouts').delete().eq('id', workoutId)
    loadData()
  }

  const filteredLibrary = exerciseLibrary.filter(
    (ex) =>
      ex.name.toLowerCase().includes(exSearch.toLowerCase()) ||
      ex.muscle_group.toLowerCase().includes(exSearch.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Topo */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wide">Treinos dos Alunos</h1>
          <p className="text-xs text-zinc-500 font-medium">Monte e lance treinos</p>
        </div>
        <button
          onClick={() => setShowBuilder(true)}
          className="bg-white text-black font-extrabold px-4 py-2.5 rounded-xl text-xs uppercase flex items-center gap-1.5 active:scale-95 transition-all shadow-lg"
        >
          <Plus className="w-4 h-4" /> Montar Treino
        </button>
      </div>

      {/* Lista de Treinos Criados */}
      {loading ? (
        <div className="flex justify-center py-12 text-zinc-500">
          <Loader2 className="animate-spin w-8 h-8" />
        </div>
      ) : workouts.length === 0 ? (
        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center space-y-2">
          <ClipboardList className="w-10 h-10 text-zinc-700 mx-auto" />
          <p className="text-sm font-semibold text-zinc-400">Nenhum treino montado ainda.</p>
          <p className="text-xs text-zinc-600">Clique em "Montar Treino" para prescrever.</p>
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
                <h3 className="font-extrabold text-base text-white">{w.name}</h3>
                <p className="text-[10px] text-zinc-500">
                  Criado em {new Date(w.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>

              <button
                onClick={() => handleDeleteWorkout(w.id)}
                className="p-2 text-zinc-600 hover:text-red-400 transition-colors"
                title="Excluir"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL CONSTRUTOR DE TREINO COMPLETO (MOBILE FIRST)         */}
      {/* ========================================================= */}
      {showBuilder && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col justify-between p-4 overflow-y-auto">
          <div className="max-w-md mx-auto w-full space-y-6 pb-20">
            {/* Cabeçalho do Construtor */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-lg font-black uppercase">Montar Novo Treino</h2>
                <p className="text-xs text-zinc-500">Prescreva séries, reps e técnicas</p>
              </div>
              <button
                onClick={() => setShowBuilder(false)}
                className="p-2 text-zinc-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveWorkout} className="space-y-4">
              {/* Seleção de Aluno */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase block mb-1">
                  Selecione o Aluno
                </label>
                <select
                  required
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-white"
                >
                  <option value="">Selecione um aluno...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name || s.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nome do Treino */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase block mb-1">
                  Nome do Treino
                </label>
                <input
                  type="text"
                  required
                  value={workoutName}
                  onChange={(e) => setWorkoutName(e.target.value)}
                  placeholder="Ex: Treino A - Peito, Ombro e Tríceps"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-white"
                />
              </div>

              {/* Lista de Exercícios Adicionados ao Treino */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase text-zinc-300 tracking-wider">
                    Exercícios do Treino ({selectedExercises.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowExPicker(true)}
                    className="bg-white text-black font-bold text-xs uppercase px-3 py-1.5 rounded-lg flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                </div>

                {selectedExercises.length === 0 ? (
                  <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl p-6 text-center space-y-2">
                    <Dumbbell className="w-8 h-8 text-zinc-700 mx-auto" />
                    <p className="text-xs text-zinc-500">Nenhum exercício adicionado ainda.</p>
                    <p className="text-[10px] text-zinc-600">
                      Clique em "+ Adicionar" para buscar na biblioteca.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedExercises.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3 relative"
                      >
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                          <div>
                            <span className="text-[10px] font-black text-zinc-500">
                              #{idx + 1}
                            </span>
                            <h4 className="font-extrabold text-sm text-white ml-2 inline">
                              {item.name}
                            </h4>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-zinc-500 hover:text-red-400 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Campos de Configuração do Exercício */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-zinc-500 uppercase block mb-1">
                              Séries
                            </label>
                            <input
                              type="number"
                              value={item.sets_count}
                              onChange={(e) =>
                                handleUpdateItem(idx, 'sets_count', e.target.value)
                              }
                              className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-center text-xs font-bold text-white"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-zinc-500 uppercase block mb-1">
                              Reps Alvo
                            </label>
                            <input
                              type="text"
                              value={item.target_reps}
                              onChange={(e) =>
                                handleUpdateItem(idx, 'target_reps', e.target.value)
                              }
                              placeholder="8-12"
                              className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-center text-xs font-bold text-white"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-zinc-500 uppercase block mb-1">
                              Técnica
                            </label>
                            <select
                              value={item.set_type}
                              onChange={(e) =>
                                handleUpdateItem(idx, 'set_type', e.target.value)
                              }
                              className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-center text-[10px] font-bold text-white"
                            >
                              <option value="normal">Normal</option>
                              <option value="cluster">Cluster Set</option>
                              <option value="myo_reps">Myo Reps</option>
                            </select>
                          </div>
                        </div>

                        {/* Observação / Instrução do Treinador */}
                        <div>
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(e) =>
                              handleUpdateItem(idx, 'notes', e.target.value)
                            }
                            placeholder="Obs do treinador (ex: Pausa de 2s no pico de contração)"
                            className="w-full bg-black/50 border border-zinc-800/80 rounded-lg p-2.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botão de Salvar Treino Completo */}
              <button
                type="submit"
                disabled={saving || selectedExercises.length === 0}
                className="w-full bg-white text-black font-extrabold text-sm uppercase py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl disabled:opacity-50 mt-6"
              >
                {saving ? (
                  <Loader2 className="animate-spin w-5 h-5" />
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" /> SALVAR E ENVIAR AO ALUNO
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AUXILIAR: BUSCAR E SELECIONAR EXERCÍCIO DA BIBLIOTECA */}
      {showExPicker && (
        <div className="fixed inset-0 bg-black/95 z-50 p-4 flex flex-col justify-between">
          <div className="max-w-md mx-auto w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black uppercase text-sm">Selecionar Exercício</h3>
              <button onClick={() => setShowExPicker(false)} className="p-2 text-zinc-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="text"
                value={exSearch}
                onChange={(e) => setExSearch(e.target.value)}
                placeholder="Buscar por nome ou músculo..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
              {filteredLibrary.map((ex) => (
                <div
                  key={ex.id}
                  onClick={() => handleAddExerciseToWorkout(ex)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center justify-between active:scale-98 transition-all cursor-pointer hover:border-zinc-700"
                >
                  <div>
                    <h4 className="font-bold text-xs text-white">{ex.name}</h4>
                    <span className="text-[9px] font-extrabold text-zinc-500 uppercase">
                      {ex.muscle_group}
                    </span>
                  </div>
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