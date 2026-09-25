'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { ClipboardList, Plus, Loader2 } from 'lucide-react'

export default function AdminWorkoutsPage() {
  const [workouts, setWorkouts] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [workoutName, setWorkoutName] = useState('')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: w } = await supabase.from('assigned_workouts').select('*, profiles(full_name)')
    const { data: s } = await supabase.from('profiles').select('*').eq('role', 'student')
    
    if (w) setWorkouts(w)
    if (s) setStudents(s)
    setLoading(false)
  }

  const handleAssignWorkout = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const { error } = await supabase.from('assigned_workouts').insert([
      {
        student_id: selectedStudent,
        name: workoutName,
        is_current: true,
      }
    ])

    if (!error) {
      setWorkoutName('')
      setShowModal(false)
      loadData()
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wide">Treinos Atribuídos</h1>
          <p className="text-xs text-zinc-500 font-medium">Lançados para os alunos</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-white text-black font-extrabold px-4 py-2.5 rounded-xl text-xs uppercase flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Atribuir
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-zinc-500">
          <Loader2 className="animate-spin w-8 h-8" />
        </div>
      ) : workouts.length === 0 ? (
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-8 text-center space-y-2">
          <ClipboardList className="w-10 h-10 text-zinc-700 mx-auto" />
          <p className="text-sm font-semibold text-zinc-400">Nenhum treino lançado ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workouts.map((w) => (
            <div key={w.id} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-white">{w.name}</h3>
                <p className="text-xs text-zinc-500">Aluno: {w.profiles?.full_name || 'Sem nome'}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-black uppercase">Atribuir Treino</h2>
            <form onSubmit={handleAssignWorkout} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase block mb-1">Aluno</label>
                <select
                  required
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white"
                >
                  <option value="">Selecione...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase block mb-1">Nome do Treino</label>
                <input
                  type="text"
                  required
                  value={workoutName}
                  onChange={(e) => setWorkoutName(e.target.value)}
                  placeholder="Ex: Treino A - Peito e Tríceps"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-1/2 bg-zinc-900 text-zinc-400 font-bold p-3 rounded-xl text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-1/2 bg-white text-black font-extrabold p-3 rounded-xl text-xs uppercase flex items-center justify-center"
                >
                  {saving ? <Loader2 className="animate-spin w-4 h-4" /> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}