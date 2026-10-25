'use client'

import { m } from 'framer-motion'
import { AtSign, Camera, ChevronRight, ImageUp, LoaderCircle, Pencil } from 'lucide-react'
import { levelFor } from '@/lib/levels'
import { goalInfo, publicImageUrl, type ProfileDetails, type ProfileImageKind } from '@/lib/profile'
import { initialsOf } from '@/components/ui/avatar'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Tile } from '@/components/ui/tile'
import { LevelBadge } from '@/components/community/LevelBadge'

type AthleteCardProps = {
  profile: ProfileDetails
  email: string | null
  // null: os treinos não carregaram (sem internet). Mostra "—" em vez de zeros.
  stats: { workouts: number; streak: number; unlocked: number; achievements: number } | null
  uploading: ProfileImageKind | null
  onEditImage: (kind: ProfileImageKind) => void
  onEditProfile: () => void
  onOpenLevels: () => void
}

export function AthleteCard({ profile, email, stats, uploading, onEditImage, onEditProfile, onOpenLevels }: AthleteCardProps) {
  const name = profile.full_name?.trim() || 'Atleta'
  const avatarUrl = publicImageUrl(profile.avatar_path, profile.id)
  const coverUrl = publicImageUrl(profile.cover_path, profile.id)
  const goal = goalInfo(profile.goal)
  const level = stats ? levelFor(stats.workouts) : null

  return (
    <Tile className="glow-brand rounded-[2rem] p-0 text-center">
      {/* Capa */}
      <div className="relative h-32 overflow-hidden">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- capa no bucket público do Supabase, já recortada
          <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(52,211,153,0.45),transparent_55%),radial-gradient(circle_at_85%_30%,rgba(251,191,36,0.3),transparent_50%)]"
          />
        )}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-surface" />
        {uploading === 'cover' && (
          <span className="absolute inset-0 grid place-items-center bg-black/50">
            <LoaderCircle className="h-6 w-6 animate-spin text-white" aria-label="Enviando capa" />
          </span>
        )}
        <m.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={() => onEditImage('cover')}
          disabled={uploading !== null}
          className="absolute right-3 top-3 flex h-9 items-center gap-1.5 rounded-xl bg-black/65 px-3 text-xs font-bold text-white backdrop-blur transition hover:bg-black/80"
        >
          <ImageUp className="h-3.5 w-3.5" aria-hidden="true" />
          {coverUrl ? 'Trocar capa' : 'Adicionar capa'}
        </m.button>
      </div>

      {/* Foto */}
      <div className="relative -mt-16 flex justify-center">
        <div className="relative">
          <div className="grid h-28 w-28 place-items-center rounded-full bg-[conic-gradient(from_200deg,#34d399,#059669,#fbbf24,#34d399)] p-[3px] shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
            <span className="relative grid h-full w-full place-items-center overflow-hidden rounded-full bg-black font-display text-4xl font-bold">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto no bucket público do Supabase, já recortada
                <img src={avatarUrl} alt={`Foto de ${name}`} className="h-full w-full object-cover" />
              ) : (
                <span aria-hidden="true">{initialsOf(name)}</span>
              )}
              {uploading === 'avatar' && (
                <span className="absolute inset-0 grid place-items-center bg-black/60">
                  <LoaderCircle className="h-6 w-6 animate-spin text-white" aria-label="Enviando foto" />
                </span>
              )}
            </span>
          </div>
          <m.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => onEditImage('avatar')}
            disabled={uploading !== null}
            aria-label={avatarUrl ? 'Trocar foto de perfil' : 'Adicionar foto de perfil'}
            className="absolute bottom-1 right-1 grid h-9 w-9 place-items-center rounded-full border-[3px] border-surface bg-brand text-black shadow-lg"
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
          </m.button>
        </div>
      </div>

      <div className="px-6 pb-6">
        <h1 className="mt-3 font-display text-4xl font-bold uppercase leading-none">{name}</h1>
        <p className="mt-1.5 truncate text-xs text-zinc-500">{profile.email || email}</p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {stats && <LevelBadge workouts={stats.workouts} className="px-3 py-1 text-xs tracking-[0.1em]" />}
          {goal && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-zinc-200">
              <span aria-hidden="true">{goal.emoji}</span> {goal.label}
            </span>
          )}
        </div>

        {profile.bio && <p className="mx-auto mt-3 max-w-xs whitespace-pre-line text-sm leading-relaxed text-zinc-300">{profile.bio}</p>}
        {profile.instagram && (
          <a
            href={`https://instagram.com/${encodeURIComponent(profile.instagram)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline"
          >
            <AtSign className="h-3.5 w-3.5" aria-hidden="true" />
            {profile.instagram}
            <span className="sr-only"> no Instagram (abre em nova aba)</span>
          </a>
        )}

        <div className="mt-4">
          <m.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={onEditProfile}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line-strong bg-white/[0.04] px-4 text-xs font-bold text-zinc-100 transition hover:border-brand/50"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Editar perfil
          </m.button>
        </div>

        <dl className="mt-5 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-black/30">
          {[
            { label: 'Treinos', value: stats?.workouts },
            { label: 'Sequência', value: stats?.streak, suffix: 'sem' },
            { label: 'Conquistas', value: stats?.unlocked, suffix: stats ? `/${stats.achievements}` : undefined },
          ].map((stat) => (
            <div key={stat.label} className="px-2 py-3">
              <dd className="font-display text-3xl font-bold leading-none">
                {stat.value === undefined ? (
                  <>
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">não carregou</span>
                  </>
                ) : (
                  <>
                    <AnimatedNumber value={stat.value} />
                    {stat.suffix && <span className="text-sm text-zinc-500">{stat.suffix}</span>}
                  </>
                )}
              </dd>
              <dt className="mt-1 text-xs font-bold text-zinc-400">{stat.label}</dt>
            </div>
          ))}
        </dl>

        {level && (
          <button
            type="button"
            onClick={onOpenLevels}
            className="mt-4 block w-full rounded-2xl border border-line bg-black/30 p-3.5 text-left transition hover:border-line-strong"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-[0.1em] text-zinc-500">Nível {level.level}</span>
              <span className="flex items-center gap-1 text-xs font-bold text-zinc-300">
                {level.next ? `Próximo: ${level.next.name}` : 'Nível máximo'}
                <ChevronRight className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
              </span>
            </span>
            {/* Dentro do botão a barra é só visual; o texto abaixo diz quanto falta. */}
            <span aria-hidden="true" className="mt-2 block h-2 overflow-hidden rounded-full bg-white/10">
              <m.span
                className="block h-full rounded-full bg-gradient-to-r from-brand-deep via-brand to-gold"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(4, level.progress * 100)}%` }}
                transition={{ type: 'spring', stiffness: 90, damping: 20, delay: 0.3 }}
              />
            </span>
            <span className="mt-2 block text-xs text-zinc-400">
              {level.next
                ? `Faltam ${level.remaining} ${level.remaining === 1 ? 'treino' : 'treinos'} para virar ${level.next.name}. Toque para ver a trilha.`
                : 'Você é lenda do Team Jean. 👑'}
            </span>
          </button>
        )}
      </div>
    </Tile>
  )
}
