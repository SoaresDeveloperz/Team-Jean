'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Minus, Pause, Play, Plus, X } from 'lucide-react'
import { formatDuration } from '@/lib/stats'
import { ProgressRing } from '@/components/ui/progress-ring'
import type { RestState } from './types'

type RestTimerBarProps = {
  rest: RestState
  nextHint: string | null
  onAdjust: (deltaSeconds: number, remaining: number) => void
  onTogglePause: (remaining: number) => void
  onSkip: () => void
  onFinish: () => void
}

function remainingOf(rest: RestState, now: number) {
  if (rest.pausedRemaining !== null) return rest.pausedRemaining
  if (rest.endsAt === null) return 0
  // O relógio local pode estar atrasado no primeiro quadro; nunca passa do total.
  return Math.min(rest.total, Math.max(0, Math.ceil((rest.endsAt - now) / 1000)))
}

// Cronômetro de descanso no rodapé. O "tique" fica aqui dentro para não
// re-renderizar a tabela de séries a cada segundo. Usa horário de término,
// então não atrasa quando o celular bloqueia a tela.
export function RestTimerBar({ rest, nextHint, onAdjust, onTogglePause, onSkip, onFinish }: RestTimerBarProps) {
  const [now, setNow] = useState(() => Date.now())
  // Texto lido pelo leitor de tela quando o descanso termina (a barra some nessa hora).
  const [announcement, setAnnouncement] = useState('')
  const running = rest.endsAt !== null
  const visible = rest.endsAt !== null || rest.pausedRemaining !== null

  useEffect(() => {
    if (rest.endsAt === null) return
    const endsAt = rest.endsAt
    const interval = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= endsAt) {
        window.clearInterval(interval)
        setAnnouncement('Descanso terminou. Hora da próxima série.')
        window.setTimeout(() => setAnnouncement(''), 5000)
        onFinish()
      }
    }, 250)
    return () => window.clearInterval(interval)
  }, [rest.endsAt, onFinish])

  const remaining = remainingOf(rest, now)

  return (
    <>
      <span role="status" className="sr-only">
        {announcement}
      </span>
    <AnimatePresence>
      {visible && (
        <m.div
          key="rest-timer"
          role="timer"
          aria-label="Tempo de descanso"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-[1.75rem] border border-line-strong bg-surface-2/95 p-3 pr-4 shadow-2xl shadow-black backdrop-blur-xl"
        >
          <div className="flex items-center gap-3">
            <ProgressRing value={rest.total > 0 ? remaining / rest.total : 0} size={58} stroke={5}>
              <span className="font-display text-lg font-bold">{formatDuration(remaining)}</span>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-brand">{running ? 'Descanso' : 'Pausado'}</p>
              <p className="text-sm font-semibold text-zinc-300">Respire e se prepare</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onAdjust(-15, remaining)}
                aria-label="Menos 15 segundos"
                className="grid h-11 w-11 place-items-center rounded-xl bg-white/[0.06] text-zinc-300"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onAdjust(30, remaining)}
                aria-label="Mais 30 segundos"
                className="flex h-11 items-center gap-0.5 rounded-xl bg-white/[0.06] px-3 text-sm font-bold text-zinc-300"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                30
              </button>
              <button
                type="button"
                onClick={() => onTogglePause(remaining)}
                aria-label={running ? 'Pausar descanso' : 'Continuar descanso'}
                className="grid h-11 w-11 place-items-center rounded-xl bg-white text-black"
              >
                {running ? <Pause className="h-4 w-4 fill-current" aria-hidden="true" /> : <Play className="h-4 w-4 fill-current" aria-hidden="true" />}
              </button>
              <button
                type="button"
                onClick={onSkip}
                aria-label="Pular descanso"
                className="grid h-11 w-11 place-items-center rounded-xl bg-white/[0.06] text-zinc-300"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          {nextHint && <p className="mt-2 truncate border-t border-line pt-2 text-sm text-zinc-300">{nextHint}</p>}
        </m.div>
      )}
    </AnimatePresence>
    </>
  )
}
