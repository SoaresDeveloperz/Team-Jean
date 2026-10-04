'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { Calendar, Loader2 } from 'lucide-react'

export default function StudentWeekPage() {
  const [workout, setWorkout] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const days = [
    { name: 'Segunda-feira', short: 'SEG' },
    { name: 'Terça-feira', short: 'TER' },
    { name: 'Quarta-feira', short: 'QUA' },
    { name: 'Quinta-feira', short: 'QUI' },
    { name: 'Sexta-feira', short: 'SEX' },
    { name: 'Sábado', short: 'SÁB' },
    { name: 'Domingo', short: 'DOM' },
  ]

  useEffect(() => {
    loadWorkout()
  }, [])

  const loadWorkout = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('assigned_workouts')
        .select('*')
        .eq('student_id', user.id)
        .eq('is_current', true)
        .limit(1)
        .single()

      if (data) setWorkout(data)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-wide">Sua Semana</h1>
        <p className="text-xs text-zinc-500 font-medium">Cronograma de treinos</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-zinc-500">
          <Loader2 className="animate-spin w-8 h-8" />
        </div>
      ) : (
        <div className="space-y-3">
          {days.map((day, idx) => (
            <div
              key={idx}
              className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center font-black text-xs text-zinc-400 border border-zinc-800">
                  {day.short}
                </span>
                <div>
                  <h3 className="font-bold text-sm text-white">{day.name}</h3>
                  <p className="text-xs text-zinc-500">
                    {workout ? workout.name : 'Descanso / Livre'}
                  </p>
                </div>
              </div>
              {workout ? (
                <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-lg">
                  Prescrito
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase text-zinc-600 bg-zinc-900 px-2.5 py-1 rounded-lg">
                  Livre
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
