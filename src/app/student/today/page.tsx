'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import { Play, Dumbbell, Loader2, Calendar, Activity, Flame, Clock, ChevronRight } from 'lucide-react'

export default function StudentTodayPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [workout, setWorkout] = useState<any>(null)
  const [exercises, setExercises] = useState<any[]>([])
  const [completedCount, setCompletedCount] = useState(0)
  const [readiness, setReadiness] = useState(80)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setUserId(user.id)

    // Pega o perfil do Aluno
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (p) {
      setProfile(p)
      if (p.readiness_score !== undefined && p.readiness_score !== null) {
        setReadiness(p.readiness_score)
      }
    }

    // Contagem de Treinos Concluídos no Mês (Streak Nike)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count } = await supabase
      .from('workout_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', startOfMonth.toISOString())

    setCompletedCount(count || 0)

    // Treino Ativo Prescrito
    const { data: w } = await supabase
      .from('assigned_workouts')
      .select('*')
      .eq('student_id', user.id)
      .eq('is_current', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (w) {
      setWorkout(w)
      const { data: ex } = await supabase
        .from('assigned_workout_exercises')
        .select('*, exercises(name, muscle_group, secondary_muscle)')
        .eq('assigned_workout_id', w.id)
        .order('order', { ascending: true })

      if (ex) setExercises(ex)
    }
    setLoading(false)
  }

  // Atualiza no banco o nível de recuperação (para o Treinador Jean ver)
  const handleReadinessChange = async (value: number) => {
    setReadiness(value)
    if (userId) {
      await supabase
        .from('profiles')
        .update({
          readiness_score: value,
          readiness_updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
    }
  }

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-28">
      {/* Topo NIKE STYLE: Nome + Sequência Streak */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block">
            {today}
          </span>
          <h1 className="text-3xl font-black text-white leading-none uppercase">
            Fala, {profile?.full_name?.split(' ')[0] || 'Atleta'}!
          </h1>
        </div>

        {/* STREAK COUNTER NIKE */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl px-3.5 py-2 flex items-center gap-2 shadow-xl">
          <Flame className="w-5 h-5 text-amber-500 animate-pulse fill-amber-500" />
          <div className="text-right">
            <span className="text-xs font-black text-white block leading-none">{completedCount}</span>
            <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider">No Mês</span>
          </div>
        </div>
      </div>

      {/* Termômetro de Prontidão (Whoop/NTC) */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-black uppercase tracking-wider text-zinc-300">
              Prontidão de Treino
            </span>
          </div>
          <span className="text-base font-black text-white">{readiness}%</span>
        </div>

        <input
          type="range"
          min="10"
          max="100"
          step="10"
          value={readiness}
          onChange={(e) => handleReadinessChange(Number(e.target.value))}
          className="w-full h-2 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-white"
        />
      </div>

      {/* HERO CARD DE TREINO (Nike / Adidas Style) */}
      {!workout ? (
        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center space-y-3">
          <Dumbbell className="w-10 h-10 text-zinc-700 mx-auto" />
          <h2 className="text-lg font-black uppercase text-zinc-400">Dia de Descanso</h2>
          <p className="text-xs text-zinc-600">Nenhum treino ativo agendado. Descanse a musculatura!</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-3 relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-1 rounded-lg">
                  PRESCRITO PELO TREINADOR
                </span>
                <span className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> ~50 min
                </span>
              </div>

              <h2 className="text-3xl font-black uppercase tracking-tight text-white leading-none pt-1">
                {workout.name}
              </h2>
            </div>

            {/* Músculos do Treino */}
            <div className="flex flex-wrap gap-2 pt-1 border-t border-zinc-900">
              {exercises.slice(0, 3).map((ex, idx) => (
                <span key={idx} className="text-[9px] font-bold uppercase text-zinc-400 bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-800">
                  {ex.exercises?.muscle_group}
                </span>
              ))}
              {exercises.length > 3 && (
                <span className="text-[9px] font-bold uppercase text-zinc-500 bg-zinc-900 px-2 py-1 rounded-md">
                  +{exercises.length - 3} mais
                </span>
              )}
            </div>

            {/* Botão Gigante Nike Play */}
            <button
              onClick={() => router.push(`/student/workout/${workout.id}`)}
              className="w-full bg-white text-black font-black text-sm uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl hover:bg-zinc-200"
            >
              <Play className="w-5 h-5 fill-black" /> INICIAR SESSÃO
            </button>
          </div>

          {/* VISÃO GERAL DOS EXERCÍCIOS */}
          <div className="space-y-2 pt-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 pl-1 block">
              Lista de Exercícios ({exercises.length})
            </span>

            {exercises.map((item, idx) => {
              const setsCount = item.planned_sets ? item.planned_sets.length : item.sets_count
              return (
                <div key={item.id} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-zinc-600 w-4 text-center">{idx + 1}</span>
                    <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800">
                      <Dumbbell className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-white">{item.exercises?.name}</h3>
                      <p className="text-[10px] font-bold uppercase text-zinc-500 mt-0.5">
                        {setsCount} Séries Prescritas
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
          }
