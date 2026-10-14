'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { Bell, LogOut, Loader2, Trophy, Flame, Dumbbell, Award } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [completedWorkoutsCount, setCompletedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      const { data: n } = await supabase.from('notifications').select('*').eq('recipient_id', user.id).order('created_at', { ascending: false })
      
      const { count } = await supabase.from('workout_sessions').select('*', { count: 'exact', head: true }).eq('student_id', user.id).eq('status', 'completed')

      if (p) setProfile(p)
      if (n) setNotifications(n)
      setCompletedCount(count || 0)
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // BADGES ESTILO ADIDAS ATHLETE
  const badges = [
    { title: 'Primeiro Passo', desc: 'Concluiu o 1º treino', icon: Dumbbell, unlocked: completedWorkoutsCount >= 1 },
    { title: 'Ritmo Forte', desc: '5 treinos concluídos', icon: Flame, unlocked: completedWorkoutsCount >= 5 },
    { title: 'Membro de Elite', desc: '10 treinos no app', icon: Trophy, unlocked: completedWorkoutsCount >= 10 },
    { title: 'Lenda do Foco', desc: '25 treinos concluídos', icon: Award, unlocked: completedWorkoutsCount >= 25 },
  ]

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-wide text-white">Meu Perfil</h1>
        <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Sua evolução e marcas</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin w-8 h-8 text-zinc-500" /></div>
      ) : (
        <div className="space-y-6">
          {/* Card Atleta */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-5 flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center font-black text-lg">
                {profile?.full_name ? profile.full_name.substring(0, 2).toUpperCase() : 'TJ'}
              </div>
              <div>
                <h3 className="font-black text-base text-white">{profile?.full_name || 'Atleta'}</h3>
                <p className="text-xs text-zinc-500">{profile?.email}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white">
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* MURAL DE CONQUISTAS ADIDAS STYLE */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2 pl-1">
              <Trophy className="w-4 h-4 text-amber-400" /> Suas Conquistas
            </h3>

            <div className="grid grid-cols-2 gap-3">
              {badges.map((b, idx) => {
                const Icon = b.icon
                return (
                  <div key={idx} className={`p-4 rounded-2xl border space-y-2 transition-all ${b.unlocked ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-950/40 border-zinc-900/60 opacity-40'}`}>
                    <div className="flex items-center justify-between">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${b.unlocked ? 'bg-amber-400/10 text-amber-400 border border-amber-400/30' : 'bg-zinc-900 text-zinc-600'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-[9px] font-black uppercase text-zinc-500">
                        {b.unlocked ? '✓ Desbloqueada' : 'Bloqueada'}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-white">{b.title}</h4>
                      <p className="text-[9px] text-zinc-500 font-medium">{b.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* MURAL DE AVISOS */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2 pl-1">
              <Bell className="w-4 h-4 text-emerald-400" /> Mural de Avisos
            </h3>

            {notifications.length === 0 ? (
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 text-center text-xs text-zinc-600 font-medium">
                Nenhum aviso recebido ainda.
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 space-y-1">
                  <span className="text-[9px] font-black uppercase text-emerald-500">
                    {new Date(n.created_at).toLocaleDateString('pt-BR')}
                  </span>
                  <h4 className="font-bold text-sm text-white">{n.title}</h4>
                  <p className="text-xs text-zinc-400">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
