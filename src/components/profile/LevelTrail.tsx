'use client'

import { m } from 'framer-motion'
import { Check, Lock } from 'lucide-react'
import { LEVELS, levelFor } from '@/lib/levels'
import { cn } from '@/lib/cn'
import { Modal } from '@/components/ui/modal'

// Trilha de níveis: o atual em destaque, os anteriores concluídos e os
// próximos com quantos treinos faltam.
export function LevelTrail({ open, workouts, onClose }: { open: boolean; workouts: number; onClose: () => void }) {
  const current = levelFor(workouts)
  return (
    <Modal open={open} onClose={onClose} title="Trilha de níveis" description="Cada treino concluído conta para subir de nível.">
      <ol className="relative space-y-2">
        {LEVELS.map((item, index) => {
          const done = workouts >= item.min && item.level < current.level
          const active = item.level === current.level
          const remaining = Math.max(0, item.min - workouts)
          return (
            <m.li
              key={item.level}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-2xl border p-3',
                active ? 'border-brand/40 bg-brand-soft' : 'border-line bg-surface',
              )}
            >
              <span
                className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-lg font-bold',
                  active && 'bg-brand text-black',
                  done && 'bg-white/10 text-brand',
                  !active && !done && 'bg-white/[0.04] text-zinc-500',
                )}
              >
                {done ? <Check className="h-5 w-5" aria-hidden="true" /> : item.level}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-bold', active || done ? 'text-white' : 'text-zinc-400')}>
                  Nível {item.level} · {item.name}
                </p>
                <p className={cn('text-xs', active ? 'text-zinc-300' : 'text-zinc-500')}>
                  {item.min === 0 ? 'Começo da jornada' : `A partir de ${item.min} treinos`}
                </p>
              </div>
              <span className="shrink-0 text-xs font-bold">
                {active ? (
                  <span className="text-brand">Você está aqui</span>
                ) : done ? (
                  <span className="text-zinc-400">Concluído</span>
                ) : (
                  <span className="flex items-center gap-1 text-zinc-500">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" /> faltam {remaining}
                  </span>
                )}
              </span>
            </m.li>
          )
        })}
      </ol>
    </Modal>
  )
}
