'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { History, Calendar, Award, Loader2 } from 'lucide-react'

export default function StudentHistoryPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('workout_sessions')
        .select('*, assigned_workouts(name)')
        .eq('student_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })

      if (data) setSessions(data)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-wide">Histórico</h1>
        <p className="text-xs text-zinc-500 font-medium">Sessões concluídas</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-zinc-500">
          <Loader2 className="animate-spin w-8 h-8" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center space-y-2">
          <History className="w-10 h-10 text-zinc-800 mx-auto" />
          <h3 className="font-bold text-sm text-zinc-400">Nenhum treino no histórico</h3>
          <p className="text-xs text-zinc-600">Seus treinos finalizados aparecerão aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black text-sm text-white">
                  {s.assigned_workouts?.name || 'Treino Concluído'}
                </h3>
                <span className="text-[10px] font-extrabold uppercase text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-md">
                  ✓ Concluído
                </span>
              </div>
              
              <div className="flex items-center justify-between text-xs text-zinc-500 font-medium pt-1 border-t border-zinc-900">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-zinc-600" />
                  {new Date(s.completed_at).toLocaleDateString('pt-BR')}
                </div>
                <div className="flex items-center gap-1 font-bold text-zinc-300">
                  <Award className="w-3.5 h-3.5 text-zinc-400" />
                  RPE: {s.session_rpe || '-'}/10
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
