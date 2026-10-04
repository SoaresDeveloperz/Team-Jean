'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function StudentProgressPage() {
  const [exercises, setExercises] = useState<any[]>([])
  const [selectedEx, setSelectedEx] = useState<string>('')
  const [historySets, setHistorySets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadExercises()
  }, [])

  const loadExercises = async () => {
    setLoading(true)
    const { data } = await supabase.from('exercises').select('*').order('name')
    if (data) {
      setExercises(data)
      if (data.length > 0) {
        setSelectedEx(data[0].id)
        loadProgress(data[0].id)
      }
    }
    setLoading(false)
  }

  const loadProgress = async (exId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('session_sets')
      .select('weight_kg, reps, created_at')
      .eq('exercise_id', exId)
      .eq('completed', true)
      .order('created_at', { ascending: true })
      .limit(10)

    if (data) setHistorySets(data)
  }

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const exId = e.target.value
    setSelectedEx(exId)
    loadProgress(exId)
  }

  const maxWeight = historySets.length > 0 ? Math.max(...historySets.map((s) => s.weight_kg || 0)) : 100

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-wide">Evolução</h1>
        <p className="text-xs text-zinc-500 font-medium">Acompanhe suas cargas</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-zinc-500">
          <Loader2 className="animate-spin w-8 h-8" />
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase block mb-1">
              Selecionar Exercício
            </label>
            <select
              value={selectedEx}
              onChange={handleSelectChange}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm font-bold text-white focus:outline-none"
            >
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} ({ex.muscle_group})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 space-y-4">
            <h3 className="text-xs font-extrabold uppercase text-zinc-400 tracking-wider">
              Carga (kg) nos últimos treinos
            </h3>

            {historySets.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-6">
                Nenhum registro de carga para este exercício ainda.
              </p>
            ) : (
              <div className="h-44 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-zinc-900">
                {historySets.map((s, idx) => {
                  const heightPct = maxWeight > 0 ? Math.max(15, (s.weight_kg / maxWeight) * 100) : 10
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <span className="text-[10px] font-black text-white">{s.weight_kg}kg</span>
                      <div
                        style={{ height: `${heightPct}%` }}
                        className="w-full bg-white rounded-t-lg transition-all"
                      />
                      <span className="text-[9px] text-zinc-600 font-bold">
                        {new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
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
