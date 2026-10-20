'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { m } from 'framer-motion'
import {
  Award,
  Bell,
  CalendarCheck,
  ChevronRight,
  Crown,
  Download,
  Flame,
  Footprints,
  Medal,
  Minus,
  Plus,
  Share,
  Smartphone,
  Star,
  Sunrise,
  Target,
  Timer,
  Trophy,
  Vibrate,
  type LucideIcon,
} from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { bestWeekStreak, weekStreak } from '@/lib/stats'
import { plural } from '@/lib/text'
import { setPreferences, usePreferences } from '@/lib/preferences'
import { promptInstall, useInstallState } from '@/lib/install-prompt'
import { openNotifications, useNotifications } from '@/lib/notifications'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Modal } from '@/components/ui/modal'
import { PageSkeleton } from '@/components/ui/skeleton'
import { ProgressRing } from '@/components/ui/progress-ring'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Switch } from '@/components/ui/switch'
import { Eyebrow, Stagger, Tile, tileVariants } from '@/components/ui/tile'
import { LogoutButton } from '@/components/layout/LogoutButton'
import { ChangePasswordTile } from '@/components/account/ChangePasswordTile'

type ProfileData = {
  profile: Pick<Profile, 'full_name' | 'email'> | null
  email: string | null
  completedCount: number
  dates: Date[]
}

type Achievement = {
  title: string
  description: string
  icon: LucideIcon
  value: number
  goal: number
}

const REST_OPTIONS = [
  { value: 60, label: '1:00' },
  { value: 90, label: '1:30' },
  { value: 120, label: '2:00' },
  { value: 180, label: '3:00' },
]

function buildAchievements(total: number, dates: Date[]): Achievement[] {
  const early = dates.filter((date) => date.getHours() < 8).length
  const weekend = dates.filter((date) => date.getDay() === 0 || date.getDay() === 6).length
  return [
    { title: 'Primeiro passo', description: 'Concluir o primeiro treino no app.', icon: Footprints, value: total, goal: 1 },
    { title: 'Ritmo forte', description: 'Concluir 5 treinos.', icon: Flame, value: total, goal: 5 },
    { title: 'Elite', description: 'Concluir 10 treinos.', icon: Medal, value: total, goal: 10 },
    { title: 'Lenda do foco', description: 'Concluir 25 treinos.', icon: Award, value: total, goal: 25 },
    { title: 'Meio século', description: 'Concluir 50 treinos.', icon: Crown, value: total, goal: 50 },
    { title: 'Centurião', description: 'Concluir 100 treinos.', icon: Trophy, value: total, goal: 100 },
    {
      title: 'Constância',
      description: 'Treinar 4 semanas seguidas, sem pular nenhuma.',
      icon: CalendarCheck,
      value: bestWeekStreak(dates),
      goal: 4,
    },
    { title: 'Madrugador', description: 'Concluir um treino antes das 8h.', icon: Sunrise, value: early, goal: 1 },
    { title: 'Fim de semana', description: 'Concluir 4 treinos em sábados ou domingos.', icon: Star, value: weekend, goal: 4 },
  ]
}

export default function StudentProfilePage() {
  const [supabase] = useState(() => createClient())
  const [data, setData] = useState<ProfileData | null>(null)
  const [loadError, setLoadError] = useState('')
  const [selectedBadge, setSelectedBadge] = useState<Achievement | null>(null)
  const preferences = usePreferences()
  const installState = useInstallState()
  const { items: notices, unseen } = useNotifications()

  useEffect(() => {
    let active = true

    const load = async () => {
      const user = await getCurrentUser(supabase)
      if (!active || !user) return

      const [profileResult, countResult, datesResult] = await Promise.all([
        supabase.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle(),
        supabase
          .from('workout_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', user.id)
          .eq('status', 'completed'),
        supabase
          .from('workout_sessions')
          .select('completed_at')
          .eq('student_id', user.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(500),
      ])
      if (!active) return

      const error = profileResult.error ?? countResult.error ?? datesResult.error
      if (error) setLoadError(`Algumas informações não carregaram: ${error.message}`)

      setData({
        profile: profileResult.data as ProfileData['profile'],
        email: user.email ?? null,
        completedCount: countResult.count ?? 0,
        dates: ((datesResult.data ?? []) as { completed_at: string | null }[])
          .filter((row) => row.completed_at)
          .map((row) => new Date(row.completed_at as string)),
      })
    }

    void load()
    return () => {
      active = false
    }
  }, [supabase])

  const achievements = useMemo(() => (data ? buildAchievements(data.completedCount, data.dates) : []), [data])
  const closeBadge = useCallback(() => setSelectedBadge(null), [])

  if (!data) return <PageSkeleton label="Carregando perfil" />

  const name = data.profile?.full_name || 'Atleta'
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
  const unlockedCount = achievements.filter((item) => item.value >= item.goal).length
  const streak = weekStreak(data.dates)

  return (
    <Stagger className="space-y-4">
      {loadError && <Alert variant="error">{loadError}</Alert>}

      {/* Cartão do atleta */}
      <Tile className="glow-brand rounded-[2rem] p-6 text-center">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-[conic-gradient(from_200deg,#34d399,#059669,#fbbf24,#34d399)] p-[3px]">
          <span className="grid h-full w-full place-items-center rounded-full bg-black font-display text-4xl font-bold">
            {initials || 'TJ'}
          </span>
        </div>
        <h1 className="mt-4 font-display text-4xl font-bold uppercase leading-none">{name}</h1>
        <p className="mt-1.5 truncate text-xs text-zinc-500">{data.profile?.email || data.email}</p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
          Atleta Team Jean
        </span>

        <dl className="mt-5 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-black/30">
          {[
            { label: 'Treinos', value: data.completedCount },
            { label: 'Sequência', value: streak, suffix: 'sem' },
            { label: 'Conquistas', value: unlockedCount, suffix: `/${achievements.length}` },
          ].map((stat) => (
            <div key={stat.label} className="px-2 py-3">
              <dd className="font-display text-3xl font-bold leading-none">
                <AnimatedNumber value={stat.value} />
                {stat.suffix && <span className="text-sm text-zinc-500">{stat.suffix}</span>}
              </dd>
              <dt className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </Tile>

      {/* Conquistas */}
      <m.section variants={tileVariants} aria-labelledby="achievements-title">
        <div className="mb-2.5 flex items-center justify-between px-1">
          <h2 id="achievements-title">
            <Eyebrow icon={Trophy} className="text-gold/80">
              Conquistas
            </Eyebrow>
          </h2>
          <span className="text-[11px] font-bold text-zinc-500">
            {unlockedCount} de {achievements.length}
          </span>
        </div>
        <ul className="grid grid-cols-3 gap-2.5">
          {achievements.map((badge, index) => {
            const unlocked = badge.value >= badge.goal
            const Icon = badge.icon
            return (
              <m.li
                key={badge.title}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.15 + index * 0.04 }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedBadge(badge)}
                  className={cn(
                    'flex h-full w-full flex-col items-center rounded-3xl border px-2 py-3.5 text-center transition',
                    unlocked ? 'border-gold/25 bg-gold-soft/40' : 'border-line bg-surface',
                  )}
                >
                  <ProgressRing
                    value={unlocked ? 1 : badge.value / badge.goal}
                    size={54}
                    stroke={3.5}
                    color={unlocked ? 'var(--color-gold)' : 'rgba(255,255,255,0.4)'}
                  >
                    <span
                      className={cn(
                        'grid h-10 w-10 place-items-center rounded-full',
                        unlocked ? 'bg-gold text-black' : 'bg-white/[0.05] text-zinc-600',
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                  </ProgressRing>
                  <span className={cn('mt-2 text-[11px] font-bold leading-tight', unlocked ? 'text-white' : 'text-zinc-400')}>
                    {badge.title}
                  </span>
                  <span className="mt-0.5 text-[10px] tabular-nums text-zinc-500">
                    {unlocked ? 'Conquistada' : `${Math.min(badge.value, badge.goal)}/${badge.goal}`}
                  </span>
                </button>
              </m.li>
            )
          })}
        </ul>
      </m.section>

      {/* Preferências */}
      <Tile className="space-y-5">
        <Eyebrow>Preferências</Eyebrow>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.05] text-zinc-300">
              <Target className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-white">Meta semanal</p>
              <p className="text-[11px] text-zinc-500">Treinos por semana</p>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-2xl border border-line bg-black/30 p-1" role="group" aria-label="Meta semanal">
            <button
              type="button"
              onClick={() => setPreferences({ weeklyGoal: Math.max(1, preferences.weeklyGoal - 1) })}
              disabled={preferences.weeklyGoal <= 1}
              aria-label="Diminuir meta"
              className="grid h-9 w-9 place-items-center rounded-xl text-zinc-300 hover:bg-white/5 disabled:opacity-30"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="w-7 text-center font-display text-2xl font-bold" aria-live="polite">
              {preferences.weeklyGoal}
            </span>
            <button
              type="button"
              onClick={() => setPreferences({ weeklyGoal: Math.min(7, preferences.weeklyGoal + 1) })}
              disabled={preferences.weeklyGoal >= 7}
              aria-label="Aumentar meta"
              className="grid h-9 w-9 place-items-center rounded-xl text-zinc-300 hover:bg-white/5 disabled:opacity-30"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.05] text-zinc-300">
              <Timer className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-white">Descanso padrão</p>
              <p className="text-[11px] text-zinc-500">Cronômetro entre as séries</p>
            </div>
          </div>
          <SegmentedControl
            label="Descanso padrão"
            value={preferences.restSeconds}
            onChange={(value) => setPreferences({ restSeconds: value })}
            options={REST_OPTIONS}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.05] text-zinc-300">
              <Vibrate className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-white">Vibração</p>
              <p className="text-[11px] text-zinc-500">Ao marcar séries e no fim do descanso</p>
            </div>
          </div>
          <Switch
            label="Vibração"
            checked={preferences.haptics}
            onChange={(checked) => {
              setPreferences({ haptics: checked })
              if (checked) haptic(20)
            }}
          />
        </div>
      </Tile>

      {/* Avisos */}
      <Tile className="p-0">
        <button type="button" onClick={openNotifications} className="flex w-full items-center gap-3 p-5 text-left">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.05] text-zinc-300">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold text-white">Avisos do treinador</span>
            <span className="block text-[11px] text-zinc-500">
              {notices.length === 0 ? 'Nenhum aviso ainda' : `${plural(notices.length, 'aviso', 'avisos')} · ${plural(unseen.length, 'novo', 'novos')}`}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-zinc-600" aria-hidden="true" />
        </button>
      </Tile>

      <ChangePasswordTile />

      {/* Instalar app */}
      {(installState === 'available' || installState === 'ios') && (
        <Tile className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-black">
            <Smartphone className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">Instale o app</p>
            <p className="text-[11px] text-zinc-500">
              {installState === 'ios' ? (
                <>
                  Toque em <Share className="inline h-3 w-3" aria-label="Compartilhar" /> e depois em &quot;Adicionar à
                  Tela de Início&quot;.
                </>
              ) : (
                'Abra direto da tela inicial, em tela cheia.'
              )}
            </p>
          </div>
          {installState === 'available' && (
            <button
              type="button"
              onClick={() => void promptInstall()}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-black uppercase text-black"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> Instalar
            </button>
          )}
        </Tile>
      )}

      <m.div variants={tileVariants}>
        <LogoutButton
          showLabel
          className="h-14 w-full justify-center rounded-2xl border border-line bg-surface text-zinc-400 hover:border-danger/40 hover:text-danger"
        />
      </m.div>

      <Modal open={selectedBadge !== null} onClose={closeBadge} title={selectedBadge?.title ?? ''}>
        {selectedBadge && (
          <div className="flex flex-col items-center pb-2 text-center">
            {(() => {
              const unlocked = selectedBadge.value >= selectedBadge.goal
              const Icon = selectedBadge.icon
              return (
                <>
                  <ProgressRing
                    value={unlocked ? 1 : selectedBadge.value / selectedBadge.goal}
                    size={112}
                    stroke={6}
                    color={unlocked ? 'var(--color-gold)' : 'rgba(255,255,255,0.45)'}
                  >
                    <span
                      className={cn(
                        'grid h-20 w-20 place-items-center rounded-full',
                        unlocked ? 'bg-gold text-black' : 'bg-white/[0.05] text-zinc-500',
                      )}
                    >
                      <Icon className="h-9 w-9" aria-hidden="true" />
                    </span>
                  </ProgressRing>
                  <p className="mt-4 text-sm text-zinc-300">{selectedBadge.description}</p>
                  <p className={cn('mt-2 font-display text-2xl font-bold uppercase', unlocked ? 'text-gold' : 'text-zinc-400')}>
                    {unlocked
                      ? 'Conquistada!'
                      : `${Math.min(selectedBadge.value, selectedBadge.goal)} de ${selectedBadge.goal}`}
                  </p>
                </>
              )
            })()}
          </div>
        )}
      </Modal>
    </Stagger>
  )
}
