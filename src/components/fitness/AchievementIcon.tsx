import { Award, CalendarCheck, Crown, Flame, Footprints, Medal, Star, Sunrise, Trophy, type LucideIcon } from 'lucide-react'
import type { AchievementIconKey } from '@/lib/achievements'

const ICONS: Record<AchievementIconKey, LucideIcon> = {
  footprints: Footprints,
  flame: Flame,
  medal: Medal,
  award: Award,
  crown: Crown,
  trophy: Trophy,
  calendar: CalendarCheck,
  sunrise: Sunrise,
  star: Star,
}

// Aceita string solta porque o nome também vem de posts salvos no banco.
export function AchievementIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICONS[icon as AchievementIconKey] ?? Award
  return <Icon className={className} aria-hidden="true" />
}
