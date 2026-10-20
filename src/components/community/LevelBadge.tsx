import { levelFor, levelTone } from '@/lib/levels'
import { cn } from '@/lib/cn'

export function LevelBadge({ workouts, className }: { workouts: number; className?: string }) {
  const level = levelFor(workouts)
  const tone = levelTone(level.level)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider',
        tone === 'gold' && 'bg-gold-soft text-gold',
        tone === 'brand' && 'bg-brand-soft text-brand',
        tone === 'zinc' && 'bg-white/[0.06] text-zinc-400',
        className,
      )}
    >
      <span aria-hidden="true">Nv {level.level}</span>
      <span className="sr-only">Nível {level.level}</span>
      <span aria-hidden="true">&nbsp;·&nbsp;</span>
      {level.name}
    </span>
  )
}

export function CoachBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border border-brand/30 bg-brand-soft px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-brand',
        className,
      )}
    >
      Treinador
    </span>
  )
}
