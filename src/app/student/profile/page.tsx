'use client'

import { useEffect, useState } from 'react'
import { Award, Bell, Dumbbell, Flame, Trophy } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import type { AppNotification, Profile } from '@/lib/types'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { PageLoader } from '@/components/ui/page-loader'
import { LogoutButton } from '@/components/layout/LogoutButton'

type ProfileData = {
  profile: Pick<Profile, 'full_name' | 'email'> | null
  email: string | null
  notifications: AppNotification[]
  completedCount: number
}

const BADGES = [
  { title: 'Primeiro passo', desc: 'Concluiu o 1º treino', icon: Dumbbell, goal: 1 },
  { title: 'Ritmo forte', desc: '5 treinos concluídos', icon: Flame, goal: 5 },
  { title: 'Membro de elite', desc: '10 treinos no app', icon: Trophy, goal: 10 },
  { title: 'Lenda do foco', desc: '25 treinos concluídos', icon: Award, goal: 25 },
]

export default function StudentProfilePage() {
  const [supabase] = useState(() => createClient())
  const [data, setData] = useState<ProfileData | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true

    const load = async () => {
      const user = await getCurrentUser(supabase)
      if (!active || !user) return

      const [profileResult, notificationsResult, countResult] = await Promise.all([
        supabase.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle(),
        supabase.from('notifications').select('*').eq('recipient_id', user.id),
        supabase
          .from('workout_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', user.id)
          .eq('status', 'completed'),
      ])
      if (!active) return

      const error = profileResult.error ?? notificationsResult.error ?? countResult.error
      if (error) setLoadError(`Algumas informações não carregaram: ${error.message}`)

      setData({
        profile: profileResult.data as ProfileData['profile'],
        email: user.email ?? null,
        // Mais recentes primeiro (a ordenação fica aqui porque a coluna de data pode não existir).
        notifications: ((notificationsResult.data ?? []) as AppNotification[]).sort((first, second) =>
          String(second.created_at ?? '').localeCompare(String(first.created_at ?? '')),
        ),
        completedCount: countResult.count ?? 0,
      })
    }

    void load()
    return () => {
      active = false
    }
  }, [supabase])

  if (!data) return <PageLoader label="Carregando perfil" />

  const name = data.profile?.full_name || 'Atleta'
  const nextBadge = BADGES.find((badge) => data.completedCount < badge.goal)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-wide text-white">Meu perfil</h1>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-zinc-500">Sua evolução e marcas</p>
      </div>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      <div className="flex items-center justify-between gap-3 rounded-3xl border border-zinc-900 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-lg font-black text-black">
            {name.substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-black text-white">{name}</h2>
            <p className="truncate text-xs text-zinc-500">{data.profile?.email || data.email}</p>
            <p className="mt-1 text-[10px] font-bold uppercase text-emerald-400">
              {data.completedCount} {data.completedCount === 1 ? 'treino concluído' : 'treinos concluídos'}
            </p>
          </div>
        </div>
        <LogoutButton showLabel className="shrink-0 rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3" />
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 pl-1 text-xs font-black uppercase tracking-widest text-zinc-400">
          <Trophy className="h-4 w-4 text-amber-400" aria-hidden="true" /> Suas conquistas
        </h2>

        {nextBadge && (
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-zinc-400">
              <span>Próxima: {nextBadge.title}</span>
              <span>
                {data.completedCount}/{nextBadge.goal}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-amber-400"
                style={{ width: `${Math.min(100, (data.completedCount / nextBadge.goal) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <ul className="grid grid-cols-2 gap-3">
          {BADGES.map((badge) => {
            const Icon = badge.icon
            const unlocked = data.completedCount >= badge.goal
            return (
              <li
                key={badge.title}
                className={cn(
                  'space-y-2 rounded-2xl border p-4 transition-all',
                  unlocked ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-900/60 bg-zinc-950/40 opacity-40',
                )}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-xl',
                      unlocked ? 'border border-amber-400/30 bg-amber-400/10 text-amber-400' : 'bg-zinc-900 text-zinc-600',
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <span className="text-[9px] font-black uppercase text-zinc-500">
                    {unlocked ? '✓ Desbloqueada' : 'Bloqueada'}
                  </span>
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-white">{badge.title}</h3>
                  <p className="text-[9px] font-medium text-zinc-500">{badge.desc}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="space-y-3 pt-2">
        <h2 className="flex items-center gap-2 pl-1 text-xs font-black uppercase tracking-widest text-zinc-400">
          <Bell className="h-4 w-4 text-emerald-400" aria-hidden="true" /> Mural de avisos
        </h2>

        {data.notifications.length === 0 ? (
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-6 text-center text-xs font-medium text-zinc-600">
            Nenhum aviso recebido ainda.
          </div>
        ) : (
          <ul className="space-y-3">
            {data.notifications.map((notification) => (
              <li key={notification.id} className="space-y-1 rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
                {notification.created_at && (
                  <span className="text-[9px] font-black uppercase text-emerald-500">
                    {new Date(notification.created_at).toLocaleDateString('pt-BR')}
                  </span>
                )}
                <h3 className="text-sm font-bold text-white">{notification.title}</h3>
                <p className="whitespace-pre-line text-xs text-zinc-400">{notification.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
