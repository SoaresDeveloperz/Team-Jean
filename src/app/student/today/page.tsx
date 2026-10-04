'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Play, Dumbbell, Loader2, Calendar, CheckCircle2 } from 'lucide-react'

export default function StudentTodayPage() {
  const [workout, setWorkout] = useState<any>(null)
  const [exercises, setExercises] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadTodayWorkout()
  }, [])

  const loadTodayWorkout = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: p } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    if (p) setProfile(p)

    const { data: w } = await supabase
      .from('assigned_workouts')
      .select('*')
      .eq('student_id', user.id)
      .eq('is_current', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (w) {
      setWorkout(w)
      const { data: ex } = await supabase
        .from('assigned_workout_exercises')
        .select('*, exercises(name, muscle_group)')
        .eq('assigned_workout_id', w.id)
        .order('order', { ascending: true })

      if (ex) setExercises(ex)
    }
    setLoading(false)
  }

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8 text-zinc-500" /></div>

  return (
    <div className="space-y-6 pb-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-black text-white">
          Fala, {profile?.full_name?.split(' ')[0] || 'Atleta'}! 💪
        </h2>
        <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> {today}
        </p>
      </div>

      {!workout ? (
        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center space-y-4 shadow-xl mt-10">
          <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto border border-zinc-800">
            <Dumbbell className="w-8 h-8 text-zinc-600" />
          </div>
          <div>
            <h3 className="font-black text-lg text-white uppercase">Dia de Descanso</h3>
            <p className="text-xs text-zinc-500 mt-1">Você não possui treino ativo para hoje. Aproveite para se recuperar!</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-zinc-900 via-zinc-950 to-black border border-zinc-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
            
            <div className="relative z-10 space-y-6">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest block mb-1">
                  SEU TREINO PRESCRITO
                </span>
                <h1 className="text-2xl font-black uppercase tracking-wide text-white leading-tight">
                  {workout.name}
                </h1>
                <p className="text-xs text-zinc-400 font-medium mt-1">
                  {exercises.length} exercícios planejados
                </p>
              </div>

              <button
                onClick={() => router.push(`/student/workout/${workout.id}`)}
                className="w-full bg-white text-black font-black text-sm uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl hover:bg-zinc-200"
              >
                <Play className="w-5 h-5 fill-black" /> INICIAR TREINO
              </button>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <h2 className="text-xs font-black uppercase text-zinc-500 tracking-widest pl-1">
              Exercícios da Sessão
            </h2>

            {exercises.map((item, idx) => {
              const setsCount = item.planned_sets ? item.planned_sets.length : item.sets_count
              return (
                <div key={item.id} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-black text-zinc-600 w-4 text-center">{idx + 1}</span>
                    <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800">
                      <Dumbbell className="w-5 h-5 text-zinc-500" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-white">{item.exercises?.name}</h3>
                      <p className="text-[10px] font-bold uppercase text-zinc-500 mt-0.5">
                        {setsCount} Séries Prescritas
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
