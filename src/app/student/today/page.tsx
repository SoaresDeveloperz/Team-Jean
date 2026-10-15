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

    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (p) {
      setProfile(p)
      if (p.readiness_score !== undefined && p.readiness_score !== null) {
        setReadiness(p.readiness_score)
      }
    }

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

  const handleReadinessChange = async (value: number) => {
    setReadiness(value)
    if (userId) {
      await supabase.from('profiles').update({
        readiness_score: value,
        readiness_updated_at: new Date().toISOString(),
      }).eq('id', userId)
    }
  }

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })

  // Cores dinâmicas para o termômetro de recuperação
  const getReadinessColor = () => {
    if (readiness >= 80) return 'text-emerald-400'
    if (readiness >= 50) return 'text-amber-400'
    return 'text-rose-400'
  }

  if (loading) return <div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-zinc-600" /></div>

  return (
    <div className="space-y-7 pb-28">
      {/* HEADER DA PÁGINA */}
      <div className="flex items-end justify-between px-1">
        <div className="space-y-0.5">
          <p className="text-[10px] font-bold uppercase text-zinc-500 tracking-[0.15em]">
            {today}
          </p>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Fala, {profile?.full_name?.split(' ')[0] || 'Atleta'}!
          </h1>
        </div>

        {/* STREAK BADGE */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-md rounded-2xl px-3 py-1.5 flex items-center gap-2">
          <Flame className="w-5 h-5 text-amber-500 fill-amber-500/20" />
          <div className="flex flex-col items-end leading-none">
            <span className="text-sm font-black text-white">{completedCount}</span>
            <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">No Mês</span>
          </div>
        </div>
      </div>

      {/* WIDGET DE RECUPERAÇÃO (READINESS) */}
      <div className="bg-[#0c0c0c] border border-zinc-900 rounded-3xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg bg-zinc-900/50 ${getReadinessColor()}`}>
              <Activity className="w-4 h-4" />
            </div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-zinc-400">
              PRONTIDÃO
            </span>
          </div>
          <span className={`text-xl font-black ${getReadinessColor()}`}>{readiness}%</span>
        </div>

        <div className="relative pt-2">
          <input
            type="range"
            min="10"
            max="100"
            step="10"
            value={readiness}
            onChange={(e) => handleReadinessChange(Number(e.target.value))}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
          />
          <div className="flex justify-between mt-2 px-1">
            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Fadigado</span>
            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Recuperado</span>
          </div>
        </div>
      </div>

      {!workout ? (
        <div className="bg-[#0c0c0c] border border-zinc-900 rounded-3xl p-10 text-center space-y-3">
          <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-2">
            <Dumbbell className="w-5 h-5 text-zinc-500" />
          </div>
          <h2 className="text-sm font-black uppercase text-zinc-400 tracking-widest">Dia de Descanso</h2>
        </div>
      ) : (
        <div className="space-y-4">
          {/* HERO CARD CINEMATOGRÁFICO DO TREINO */}
          <div className="relative bg-zinc-950 rounded-[2rem] p-6 overflow-hidden shadow-2xl border border-zinc-800/60">
            {/* Background Texture/Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/80 via-black to-black z-0" />
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] z-0" />
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-[60px] z-0" />

            <div className="relative z-10 flex flex-col h-full justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400 bg-emerald-950/30 px-2.5 py-1 rounded-full border border-emerald-900/50">
                    SESSÃO ATIVA
                  </span>
                  <span className="text-[10px] font-bold text-zinc-400 flex items-center gap-1 bg-zinc-900/50 px-2 py-1 rounded-full backdrop-blur-sm">
                    <Clock className="w-3 h-3" /> ~50 min
                  </span>
                </div>

                <div className="pt-2">
                  <h2 className="text-3xl font-black uppercase tracking-tight text-white leading-none">
                    {workout.name}
                  </h2>
                  
                  {/* Chips de Músculos Compactos */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {Array.from(new Set(exercises.map(ex => ex.exercises?.muscle_group))).slice(0, 3).map((muscle, idx) => (
                      <span key={idx} className="text-[9px] font-bold uppercase tracking-wider text-zinc-300 bg-zinc-800/80 px-2.5 py-1 rounded-md">
                        {muscle as string}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Botão de Iniciar Premium */}
              <button
                onClick={() => router.push(`/student/workout/${workout.id}`)}
                className="w-full bg-white hover:bg-zinc-200 text-black font-black text-sm uppercase tracking-[0.2em] py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)]"
              >
                <Play className="w-5 h-5 fill-black" /> COMEÇAR
              </button>
            </div>
          </div>

          {/* LISTA DE EXERCÍCIOS ULTRA CLEAN */}
          <div className="pt-2">
            <div className="flex items-center justify-between px-2 mb-3">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                Resumo da Sessão
              </span>
              <span className="text-[10px] font-bold text-zinc-600">{exercises.length} exercícios</span>
            </div>

            <div className="space-y-1.5">
              {exercises.map((item, idx) => {
                const setsCount = item.planned_sets ? item.planned_sets.length : item.sets_count
                return (
                  <div 
                    key={item.id} 
                    className="bg-[#0c0c0c] border border-zinc-900/80 rounded-2xl p-3.5 flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-black text-zinc-600 w-3 text-right">
                        {idx + 1}
                      </span>
                      <div className="w-9 h-9 bg-zinc-900/80 rounded-xl flex items-center justify-center border border-zinc-800/50">
                        <Dumbbell className="w-4 h-4 text-zinc-400" />
                      </div>
                      <div className="flex flex-col justify-center">
                        <h3 className="font-extrabold text-xs text-zinc-200 leading-tight">
                          {item.exercises?.name}
                        </h3>
                        <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500 mt-1">
                          {setsCount} {setsCount === 1 ? 'Série' : 'Séries'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-700" />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
