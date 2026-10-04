'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { Bell, LogOut, Loader2, UserCircle, Activity } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
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
      const { data: n } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })

      if (p) setProfile(p)
      if (n) setNotifications(n)
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-wide text-white">Perfil</h1>
        <p className="text-xs text-zinc-500 font-bold tracking-widest uppercase mt-1">Sua Central</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin w-8 h-8 text-zinc-500" /></div>
      ) : (
        <div className="space-y-6">
          {/* Card do Atleta */}
          <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-3xl p-6 flex items-center justify-between shadow-2xl relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-16 h-16 bg-zinc-950 border-2 border-zinc-800 rounded-full flex items-center justify-center shadow-inner">
                <UserCircle className="w-8 h-8 text-zinc-400" />
              </div>
              <div>
                <h3 className="font-black text-lg text-white">{profile?.full_name || 'Atleta'}</h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">{profile?.email}</p>
              </div>
            </div>
          </div>

          {/* Botão de Sair */}
          <button onClick={handleLogout} className="w-full bg-zinc-950 border border-zinc-900 text-zinc-400 font-black p-4 rounded-2xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-900 hover:text-white transition-all">
            <LogOut className="w-4 h-4" /> Desconectar Conta
          </button>

          {/* Mura de Avisos */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2 pl-1">
              <Bell className="w-4 h-4" /> Mural do Treinador
            </h3>

            {notifications.length === 0 ? (
              <div className="bg-zinc-950/50 border border-dashed border-zinc-800 rounded-3xl p-8 text-center">
                <Activity className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                <p className="text-xs text-zinc-500 font-medium">Nenhum aviso recebido ainda.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="bg-zinc-950 border border-zinc-900 rounded-3xl p-5 space-y-2 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500/70">
                    {new Date(n.created_at).toLocaleDateString('pt-BR')}
                  </span>
                  <h4 className="font-black text-sm text-white">{n.title}</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed font-medium">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
