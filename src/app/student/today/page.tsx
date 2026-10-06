'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import { Play, Dumbbell, Loader2, Calendar, Activity, Flame } from 'lucide-react'

export default function StudentTodayPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [workout, setWorkout] = useState<any>(null)
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

    const { data: w } = await supabase
      .from('assigned_workouts')
      .select('*')
      .eq('student_id', user.id)
      .eq('is_current', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (w) setWorkout(w)
    setLoading(false)
  }

  // ATUALIZA A RECUPERAÇÃO NO SUPABASE EM TEMPO REAL
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

  const getReadinessBadge = () => {
    if (readiness >= 80) return { text: 'Pronto pra moer! 🔥', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50' }
    if (readiness >= 50) return { text: 'Fadiga Moderada ⚠️', color: 'text-amber-400 bg-amber-950/60 border-amber-800/50' }
    return { text: 'Cansaço Elevado 🪫', color: 'text-rose-400 bg-rose-950/60 border-rose-800/50' }
  }

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-zinc-500" /></div>

  const badge = getReadinessBadge()

  return (
    <div className="space-y-6 pb-24">
      {/* Saudação */}
      <div className="space-y-1">
        <h1 className="text-3xl font-black text-white leading-tight">
          Fala, <span className="text-emerald-400">{profile?.full_name?.split(' ')[0] || 'Atleta'}</span>! 💪
        </h1>
        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] flex items-center gap-2 mt-1">
          <Calendar className="w-3.5 h-3.5" /> {today}
        </p>
      </div>

      {/* Widget de Recuperação (Salva pro Treinador ver) */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-black uppercase tracking-wider text-zinc-300">
              Nível de Recuperação
            </span>
          </div>
          <span className="text-lg font-black text-white">{readiness}%</span>
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

        <div className="text-center pt-1">
          <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${badge.color}`}>
            {badge.text}
          </span>
        </div>
      </div>

      {/* Card do Treino Prescrito */}
      {!workout ? (
        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center space-y-3">
          <Dumbbell className="w-10 h-10 text-zinc-700 mx-auto" />
          <h2 className="text-lg font-black uppercase text-zinc-400">Dia de Descanso</h2>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-zinc-900 via-zinc-950 to-black border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
          
          <div className="relative z-10 space-y-5">
            <div>
              <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest block mb-1">
                SEU TREINO DE HOJE
              </span>
              <h2 className="text-2xl font-black uppercase text-white leading-tight">
                {workout.name}
              </h2>
            </div>

            <button
              onClick={() => router.push(`/student/workout/${workout.id}`)}
              className="w-full h-14 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl hover:bg-zinc-200"
            >
              <Play className="w-5 h-5 fill-black" /> INICIAR TREINO
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
