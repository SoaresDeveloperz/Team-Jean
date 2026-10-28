'use client'

import type { ComponentProps, ReactNode } from 'react'
import { m, type Variants } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

// Container que revela os blocos em sequência (stagger).
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

export const tileVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 26 } },
}

export function Stagger({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <m.div variants={staggerContainer} initial="hidden" animate="show" className={className}>
      {children}
    </m.div>
  )
}

type TileProps = ComponentProps<typeof m.section>

// Luz que segue o mouse (variáveis CSS; o efeito só existe com mouse).
function followPointer(event: React.PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse') return
  const rect = event.currentTarget.getBoundingClientRect()
  event.currentTarget.style.setProperty('--spot-x', `${event.clientX - rect.left}px`)
  event.currentTarget.style.setProperty('--spot-y', `${event.clientY - rect.top}px`)
}

// Bloco do bento grid: superfície grafite com borda fina.
export function Tile({ className, children, onPointerMove, ...props }: TileProps) {
  return (
    <m.section
      variants={tileVariants}
      onPointerMove={(event) => {
        followPointer(event)
        onPointerMove?.(event)
      }}
      className={cn('tile-spotlight relative overflow-hidden rounded-3xl border border-line bg-surface p-5', className)}
      {...props}
    >
      {children}
    </m.section>
  )
}

export function Eyebrow({ icon: Icon, children, className }: { icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <p className={cn('flex items-center gap-1.5 text-[13px] font-bold text-zinc-400', className)}>
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </p>
  )
}
