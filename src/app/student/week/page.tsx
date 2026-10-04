'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { Dumbbell, Loader2, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function StudentRoutinePage() {
  const [workouts, setWorkouts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadWorkouts()
  }, [])

  const loadWorkouts = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Busca TODOS os treinos ativos do aluno
      const { data } = await supabase
        .from('assigned_workouts')
        .select('*')
        .eq('student_id', user.id)
        .eq('is_current', true)
        .order('name', { ascending: true })

      if (data) setWorkouts(data)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-wide text-white">Rotina</h1>
        <p className="text-xs text-zinc-500 font-bold tracking-widest uppercase mt-1">Seu cronograma atual</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin w-8 h-8 text-zinc-500" /></div>
      ) : workouts.length === 0 ? (
        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center space-y-4">
          <Dumbbell className="w-10 h-10 text-zinc-700 mx-auto" />
          <h3 className="font-black text-sm text-zinc-400 uppercase">Sem treinos ativos</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {workouts.map((w, idx) => (
            <div
              key={w.id}
              onClick={() => router.push(`/student/workout/${w.id}`)}
              className="bg-zinc-950 border border-zinc-900 hover:border-zinc-700 rounded-3xl p-5 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center font-black text-zinc-500 text-lg border border-zinc-800 group-hover:border-emerald-500/50 group-hover:text-emerald-400 transition-colors">
                  {String.fromCharCode(65 + idx)} {/* Transforma 0,1,2 em A, B, C */}
                </div>
                <div>
                  <h3 className="font-black text-base text-white">{w.name}</h3>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
                    Toque para iniciar
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-zinc-600 group-hover:text-white transition-colors" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
