'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { m } from 'framer-motion'
import {
  Bell,
  ChevronRight,
  Download,
  MessageCircleHeart,
  Minus,
  Plus,
  Share,
  Smartphone,
  Target,
  Timer,
  Trophy,
  Vibrate,
} from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { updateProfileDetails, type ProfileDetails, type ProfileImageKind } from '@/lib/profile'
import { weekStreak } from '@/lib/stats'
import { buildAchievements, type Achievement } from '@/lib/achievements'
import type { PostDraft } from '@/lib/community'
import { plural } from '@/lib/text'
import { setPreferences, usePreferences } from '@/lib/preferences'
import { promptInstall, useInstallState } from '@/lib/install-prompt'
import { openNotifications, useNotifications } from '@/lib/notifications'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/cn'
import { MISSING_SESSION, friendlyError } from '@/lib/errors'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { PageSkeleton } from '@/components/ui/skeleton'
import { ProgressRing } from '@/components/ui/progress-ring'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/toast'
import { Eyebrow, Stagger, Tile, tileVariants } from '@/components/ui/tile'
import { LogoutButton } from '@/components/layout/LogoutButton'
import { AchievementIcon } from '@/components/fitness/AchievementIcon'
import { Composer } from '@/components/community/Composer'
import { ChangePasswordTile } from '@/components/account/ChangePasswordTile'
import { PushNotificationsTile } from '@/components/account/PushNotificationsTile'
import { AthleteCard } from '@/components/profile/AthleteCard'
import { EditProfileSheet } from '@/components/profile/EditProfileSheet'
import { LevelTrail } from '@/components/profile/LevelTrail'
import { MeasurementsCard } from '@/components/profile/MeasurementsCard'
import { AnamneseCard } from '@/components/health/AnamneseCard'
import { BillingCard } from '@/components/finance/BillingCard'
import { ProfileImageEditor } from '@/components/profile/ProfileImageEditor'

type ProfileData = {
  userId: string
  // select('*'): as colunas do profile.sql vêm quando existirem.
  // null = ainda não carregou (sem internet): a tela não inventa "Atleta" nem 0 treinos.
  profile: Profile | null
  email: string | null
  completedCount: number | null
  dates: Date[] | null
}

const REST_OPTIONS = [
  { value: 60, label: '1:00' },
  { value: 90, label: '1:30' },
  { value: 120, label: '2:00' },
  { value: 180, label: '3:00' },
]

export default function StudentProfilePage() {
  const [supabase] = useState(() => createClient())
  // Links do app (Hoje → "responda sua ficha") abrem direto o formulário.
  const searchParams = useSearchParams()
  const openAnamnese = searchParams.get('anamnese') === '1'
  // Lembrete da mensalidade (push) leva até o cartão do PIX.
  const highlightBilling = searchParams.get('mensalidade') === '1'
  const toast = useToast()
  const [data, setData] = useState<ProfileData | null>(null)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [selectedBadge, setSelectedBadge] = useState<Achievement | null>(null)
  const [shareDraft, setShareDraft] = useState<PostDraft | null>(null)
  // O tipo fica guardado depois de fechar (a folha não muda durante a saída).
  const [photoKind, setPhotoKind] = useState<ProfileImageKind>('avatar')
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false)
  const [uploading, setUploading] = useState<ProfileImageKind | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editKey, setEditKey] = useState(0)
  const [levelsOpen, setLevelsOpen] = useState(false)
  const preferences = usePreferences()
  const installState = useInstallState()
  const { items: notices, unseen } = useNotifications()

  useEffect(() => {
    let active = true

    const load = async () => {
      const user = await getCurrentUser(supabase)
      if (!active) return
      if (!user) {
        setLoadError(friendlyError(MISSING_SESSION, 'Não foi possível carregar seu perfil'))
        return
      }

      const [profileResult, countResult, datesResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
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
      setLoadError(error ? friendlyError(error, 'Algumas informações do perfil não carregaram') : '')

      // O que falhou mantém o valor que já estava na tela (ou fica "não carregado").
      setData((current) => ({
        userId: user.id,
        profile: profileResult.error
          ? (current?.profile ?? null)
          : { id: user.id, full_name: null, email: null, role: null, ...(profileResult.data as Partial<Profile> | null) },
        email: user.email ?? null,
        completedCount: countResult.error ? (current?.completedCount ?? null) : (countResult.count ?? 0),
        dates: datesResult.error
          ? (current?.dates ?? null)
          : ((datesResult.data ?? []) as { completed_at: string | null }[])
              .filter((row) => row.completed_at)
              .map((row) => new Date(row.completed_at as string)),
      }))
    }

    void load()
    return () => {
      active = false
    }
  }, [supabase, attempt])

  const retry = () => {
    setLoadError('')
    setAttempt((value) => value + 1)
  }

  const statsLoaded = data !== null && data.completedCount !== null && data.dates !== null
  const achievements = useMemo(
    () => (data && data.completedCount !== null && data.dates !== null ? buildAchievements(data.completedCount, data.dates) : []),
    [data],
  )
  const closeBadge = useCallback(() => setSelectedBadge(null), [])
  const closeShare = useCallback(() => setShareDraft(null), [])
  const closePhotoMenu = useCallback(() => setPhotoMenuOpen(false), [])
  const closeEdit = useCallback(() => setEditOpen(false), [])
  const closeLevels = useCallback(() => setLevelsOpen(false), [])

  const patchProfile = (patch: Partial<ProfileDetails>) =>
    setData((current) => (current?.profile ? { ...current, profile: { ...current.profile, ...patch } } : current))

  const openPhotoMenu = (kind: ProfileImageKind) => {
    setPhotoKind(kind)
    setPhotoMenuOpen(true)
  }

  const handleImageChange = (kind: ProfileImageKind, path: string | null) =>
    patchProfile(kind === 'avatar' ? { avatar_path: path } : { cover_path: path })

  const saveDetails = async (patch: Partial<ProfileDetails>) => {
    if (!data?.profile) return
    await updateProfileDetails(supabase, data.userId, patch)
    patchProfile(patch)
    setEditOpen(false)
    toast({ tone: 'success', title: 'Perfil atualizado' })
  }

  const errorAlert = loadError ? (
    <Alert variant="error" onRetry={retry}>
      {loadError}
    </Alert>
  ) : null
  if (!data) return errorAlert ?? <PageSkeleton label="Carregando perfil" />

  const profile = data.profile
  const unlockedCount = achievements.filter((item) => item.value >= item.goal).length
  const stats = statsLoaded
    ? { workouts: data.completedCount ?? 0, streak: weekStreak(data.dates ?? []), unlocked: unlockedCount, achievements: achievements.length }
    : null

  return (
    <Stagger className="space-y-4">
      {errorAlert}

      {/* Cartão do atleta (só com o perfil carregado: nada de "Atleta" no lugar do nome) */}
      {profile && (
        <AthleteCard
          profile={profile}
          email={data.email}
          stats={stats}
          uploading={uploading}
          onEditImage={openPhotoMenu}
          onEditProfile={() => {
            setEditKey((key) => key + 1)
            setEditOpen(true)
          }}
          onOpenLevels={() => setLevelsOpen(true)}
        />
      )}

      {/* Medidas e fotos de evolução */}
      {profile && <MeasurementsCard userId={data.userId} goal={profile.goal} profile={profile} />}

      <BillingCard userId={data.userId} highlight={highlightBilling} />

      <AnamneseCard studentId={data.userId} autoOpen={openAnamnese} />

      {/* Conquistas (sem os treinos carregados, não mostra progresso zerado) */}
      {statsLoaded && (
        <m.section variants={tileVariants} aria-labelledby="achievements-title">
          <div className="mb-2.5 flex items-center justify-between px-1">
            <h2 id="achievements-title">
              <Eyebrow icon={Trophy} className="text-gold/80">
                Conquistas
              </Eyebrow>
            </h2>
            <span className="text-xs font-bold text-zinc-500">
              {unlockedCount} de {achievements.length}
            </span>
          </div>
          <ul className="grid grid-cols-3 gap-2.5">
            {achievements.map((badge, index) => {
              const unlocked = badge.value >= badge.goal
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
                      <AchievementIcon icon={badge.icon} className="h-[18px] w-[18px]" />
                    </span>
                  </ProgressRing>
                  <span className={cn('mt-2 text-xs font-bold leading-tight', unlocked ? 'text-white' : 'text-zinc-400')}>
                    {badge.title}
                  </span>
                  <span className="mt-0.5 text-xs tabular-nums text-zinc-500">
                    {unlocked ? 'Conquistada' : `${Math.min(badge.value, badge.goal)}/${badge.goal}`}
                  </span>
                </button>
              </m.li>
            )
          })}
        </ul>
      </m.section>
      )}

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
              <p className="text-xs text-zinc-500">Treinos por semana</p>
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
              <p className="text-xs text-zinc-500">Cronômetro entre as séries</p>
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
              <p className="text-xs text-zinc-500">Ao marcar séries e no fim do descanso</p>
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
            <span className="block text-xs text-zinc-500">
              {notices.length === 0 ? 'Nenhum aviso ainda' : `${plural(notices.length, 'aviso', 'avisos')} · ${plural(unseen.length, 'novo', 'novos')}`}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-zinc-600" aria-hidden="true" />
        </button>
      </Tile>

      <PushNotificationsTile />

      <ChangePasswordTile />

      {/* Instalar app */}
      {(installState === 'available' || installState === 'ios') && (
        <Tile className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-black">
            <Smartphone className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">Instale o app</p>
            <p className="text-xs text-zinc-500">
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
                      <AchievementIcon icon={selectedBadge.icon} className="h-9 w-9" />
                    </span>
                  </ProgressRing>
                  <p className="mt-4 text-sm text-zinc-300">{selectedBadge.description}</p>
                  <p className={cn('mt-2 font-display text-2xl font-bold uppercase', unlocked ? 'text-gold' : 'text-zinc-400')}>
                    {unlocked
                      ? 'Conquistada!'
                      : `${Math.min(selectedBadge.value, selectedBadge.goal)} de ${selectedBadge.goal}`}
                  </p>
                  {unlocked && (
                    <m.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setShareDraft({
                          kind: 'achievement',
                          meta: {
                            title: selectedBadge.title,
                            description: selectedBadge.description,
                            icon: selectedBadge.icon,
                            goal: selectedBadge.goal,
                          },
                        })
                        setSelectedBadge(null)
                      }}
                      className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold text-xs font-black uppercase tracking-wider text-black"
                    >
                      <MessageCircleHeart className="h-4 w-4" aria-hidden="true" /> Compartilhar na comunidade
                    </m.button>
                  )}
                </>
              )
            })()}
          </div>
        )}
      </Modal>
      <ProfileImageEditor
        userId={data.userId}
        kind={photoKind}
        open={photoMenuOpen}
        currentPath={photoKind === 'cover' ? profile?.cover_path : profile?.avatar_path}
        onClose={closePhotoMenu}
        onChange={handleImageChange}
        onUploadingChange={setUploading}
      />
      {profile && <EditProfileSheet key={editKey} open={editOpen} profile={profile} onClose={closeEdit} onSave={saveDetails} />}
      {data.completedCount !== null && <LevelTrail open={levelsOpen} workouts={data.completedCount} onClose={closeLevels} />}

      <Composer
        open={shareDraft !== null}
        onClose={closeShare}
        onPosted={() => toast({ tone: 'success', title: 'Conquista publicada 🏆', description: 'A equipe já pode dar fogo.' })}
        draft={shareDraft ?? undefined}
      />
    </Stagger>
  )
}
