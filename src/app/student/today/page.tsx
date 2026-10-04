'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import { Play, Dumbbell, Loader2, Calendar, Flame, Activity } from 'lucide-react'

export default function StudentTodayPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [workout, setWorkout] = useState<any>(null)
  
  // Inovação: Termômetro de Prontidão (Readiness)
  const [readiness, setReadiness] = useState(80)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: p } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    setProfile(p)

    // Pega o primeiro treino da lista
    const { data: w } = await supabase
      .from('assigned_workouts')
      .select('*')
      .eq('student_id', user.id)
      .eq('is_current', true)
      .order('name', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (w) setWorkout(w)
    setLoading(false)
  }

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  const getReadinessColor = () => {
    if (readiness >= 80) return 'text-emerald-400 bg-emerald-400'
    if (readiness >= 50) return 'text-amber-400 bg-amber-400'
    return 'text-rose-500 bg-rose-500'
  }

  const getReadinessText = () => {
    if (readiness >= 80) return 'Pronto para destruir!'
    if (readiness >= 50) return 'Levemente fadigado.'
    return 'Recuperação necessária.'
  }

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-zinc-500" /></div>

  return (
    <div className="space-y-8 pb-24">
      {/* Cabeçalho Imersivo */}
      <div className="space-y-1">
        <h1 className="text-3xl font-black text-white leading-tight">
          Fala, <br/><span className="text-emerald-400">{profile?.full_name?.split(' ')[0] || 'Atleta'}</span>!
        </h1>
        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] flex items-center gap-2 mt-2">
          <Calendar className="w-3.5 h-3.5" />
          {today}
        </p>
      </div>

      {/* Widget Interativo de Prontidão (Inovação) */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Nível de Recuperação
          </h3>
          <span className={`text-xl font-black ${getReadinessColor().split(' ')[0]}`}>{readiness}%</span>
        </div>
        
        <input 
          type="range" 
          min="10" 
          max="100" 
          step="10"
          value={readiness} 
          onChange={(e) => setReadiness(Number(e.target.value))}
          className="w-full h-2 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-white"
        />
        
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-4 text-center">
          Status: <span className="text-white">{getReadinessText()}</span>
        </p>
      </div>

      {!workout ? (
        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center space-y-4">
          <Dumbbell className="w-10 h-10 text-zinc-700 mx-auto" />
          <h2 className="text-lg font-black uppercase text-zinc-400">Descanso</h2>
        </div>
      ) : (
        /* Card Cinematográfico do Treino */
        <div className="relative rounded-[2rem] p-1 overflow-hidden group cursor-pointer" onClick={() => router.push(`/student/workout/${workout.id}`)}>
          {/* Borda Animada */}
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-emerald-500/20 to-zinc-900 opacity-50" />
          
          <div className="relative bg-black rounded-[1.8rem] p-6 h-full flex flex-col justify-between border border-zinc-800/50 z-10 space-y-8">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em]">Treino Sugerido</span>
                <span className="flex items-center gap-1 text-[9px] font-black text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md uppercase">
                  <Flame className="w-3 h-3" /> Foco Total
                </span>
              </div>
              <h2 className="text-3xl font-black uppercase text-white leading-none tracking-tight">
                {workout.name}
              </h2>
            </div>

            <button className="w-full h-14 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 active:scale-95 transition-all">
              <Play className="w-5 h-5 fill-black" />
              INICIAR TREINO
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
