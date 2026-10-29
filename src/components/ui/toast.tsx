'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { CircleAlert, CircleCheck, Info, Trophy, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

type ToastTone = 'success' | 'error' | 'info' | 'gold'

export type ToastInput = {
  title: string
  description?: string
  tone?: ToastTone
  icon?: LucideIcon
  duration?: number
}

type ToastItem = ToastInput & { id: number }

const tones: Record<ToastTone, { icon: LucideIcon; className: string; iconClassName: string }> = {
  success: { icon: CircleCheck, className: 'border-brand/25', iconClassName: 'bg-brand-soft text-brand' },
  error: { icon: CircleAlert, className: 'border-danger/30', iconClassName: 'bg-danger-soft text-danger' },
  info: { icon: Info, className: 'border-line-strong', iconClassName: 'bg-white/10 text-zinc-200' },
  gold: { icon: Trophy, className: 'border-gold/30', iconClassName: 'bg-gold-soft text-gold' },
}

const ToastContext = createContext<(toast: ToastInput) => void>(() => {})

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (toast: ToastInput) => {
      const id = ++nextId
      setToasts((current) => [...current.slice(-2), { ...toast, id }])
      window.setTimeout(() => dismiss(id), toast.duration ?? (toast.tone === 'error' ? 8000 : 6000))
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[80] flex flex-col items-center gap-2 px-4"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const tone = tones[toast.tone ?? 'info']
            const Icon = toast.icon ?? tone.icon
            return (
              <m.div
                key={toast.id}
                layout
                role={toast.tone === 'error' ? 'alert' : 'status'}
                initial={{ opacity: 0, y: -18, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.96, transition: { duration: 0.18 } }}
                className={cn(
                  // O aviso não captura o toque: o botão por baixo (ex.: "Concluir") continua tocável.
                  'pointer-events-none flex w-full max-w-sm items-center gap-3 rounded-2xl border bg-surface-2/95 p-3 pr-4 shadow-2xl shadow-black/60 backdrop-blur-xl',
                  tone.className,
                )}
              >
                <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', tone.iconClassName)}>
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-white">{toast.title}</span>
                  {toast.description && <span className="block text-xs text-zinc-300">{toast.description}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Fechar aviso"
                  className="pointer-events-auto -my-2 -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-zinc-300 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </m.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
