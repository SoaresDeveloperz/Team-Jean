import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'

// Barra de progresso em CSS: anima só `transform` (compositor), nunca `width`.
// O valor vai em `--v` (0 a 1); a entrada e a mudança de valor ficam em globals.css (.bar-fill).
export function BarFill({ value, className, delay = 0 }: { value: number; className?: string; delay?: number }) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
  return (
    <span
      className={cn('bar-fill block h-full w-full rounded-full', className)}
      style={{ '--v': clamped, '--bar-delay': `${delay}ms` } as CSSProperties}
    />
  )
}
