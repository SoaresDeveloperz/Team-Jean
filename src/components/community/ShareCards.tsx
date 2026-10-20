import { Dumbbell, Trophy } from 'lucide-react'
import type { AchievementMeta, WorkoutMeta } from '@/lib/community'
import { loadFill, type MuscleRegion } from '@/lib/muscles'
import { formatKg } from '@/lib/workouts'
import { cn } from '@/lib/cn'
import { MuscleMap } from '@/components/fitness/MuscleMap'
import { AchievementIcon } from '@/components/fitness/AchievementIcon'

function fillsFrom(regions: WorkoutMeta['regions'] | undefined) {
  const fills: Partial<Record<MuscleRegion, string>> = {}
  for (const [region, intensity] of Object.entries(regions ?? {}) as [MuscleRegion, number][]) {
    fills[region] = loadFill(intensity)
  }
  return fills
}

// Cartão do treino concluído dentro de um post (estilo Strava/Hevy).
export function WorkoutShareCard({ meta, className }: { meta: WorkoutMeta; className?: string }) {
  const stats = [
    { label: 'Volume', value: formatKg(meta.volume), unit: 'kg' },
    { label: 'Séries', value: String(meta.sets), unit: '' },
    meta.minutes != null
      ? { label: 'Tempo', value: String(meta.minutes), unit: 'min' }
      : { label: 'Esforço', value: meta.rpe != null ? String(meta.rpe) : '—', unit: meta.rpe != null ? '/10' : '' },
  ]
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-soft via-transparent to-transparent p-4', className)}>
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-brand">
            <Dumbbell className="h-3.5 w-3.5" aria-hidden="true" /> Treino concluído
          </p>
          <p className="mt-1.5 line-clamp-2 font-display text-2xl font-bold uppercase leading-[0.95] text-white">{meta.name}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="text-[9px] font-black uppercase tracking-wider text-zinc-500">{stat.label}</dt>
                <dd className="font-display text-xl font-bold leading-tight text-white">
                  {stat.value}
                  {stat.unit && <span className="ml-0.5 text-xs text-zinc-500">{stat.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div aria-hidden="true" className="w-24 shrink-0 self-center">
          <MuscleMap fills={fillsFrom(meta.regions)} animated={false} />
        </div>
      </div>
      {meta.prs.length > 0 && (
        <ul className="mt-3 space-y-1.5" aria-label="Recordes pessoais">
          {meta.prs.map((pr) => (
            <li key={pr.name} className="flex items-center gap-2 rounded-xl bg-gold-soft px-3 py-2 text-xs">
              <Trophy className="h-3.5 w-3.5 shrink-0 text-gold" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-bold text-white">{pr.name}</span>
              <span className="shrink-0 font-display text-base font-bold text-gold">
                {formatKg(pr.weight)} kg × {pr.reps}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AchievementShareCard({ meta, className }: { meta: AchievementMeta; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 overflow-hidden rounded-2xl border border-gold/25 bg-gradient-to-br from-gold-soft via-transparent to-transparent p-4',
        className,
      )}
    >
      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gold text-black shadow-[0_0_32px_rgba(251,191,36,0.35)]">
        <AchievementIcon icon={meta.icon} className="h-8 w-8" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gold">Conquista desbloqueada</p>
        <p className="mt-1 font-display text-2xl font-bold uppercase leading-none text-white">{meta.title}</p>
        <p className="mt-1 text-xs text-zinc-300">{meta.description}</p>
      </div>
    </div>
  )
}
