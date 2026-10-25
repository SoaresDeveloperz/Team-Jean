import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/cn'

export type Feedback = { type: 'success' | 'error'; message: string } | null

const variants = {
  success: { icon: CircleCheck, className: 'border-emerald-800/50 bg-emerald-950/40 text-emerald-300' },
  error: { icon: CircleAlert, className: 'border-red-800/50 bg-red-950/40 text-red-300' },
  info: { icon: Info, className: 'border-zinc-800 bg-zinc-900/60 text-zinc-300' },
}

type AlertProps = {
  variant?: keyof typeof variants
  children: ReactNode
  className?: string
  // Mostra o botão "Tentar de novo" (carga que falhou, sem internet...).
  onRetry?: () => void
  retryLabel?: string
}

export function Alert({ variant = 'info', children, className, onRetry, retryLabel = 'Tentar de novo' }: AlertProps) {
  const { icon: Icon, className: variantClassName } = variants[variant]

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2 rounded-xl border p-3 text-xs font-semibold', variantClassName, className)}
    >
      <Icon className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div>{children}</div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3.5 text-xs font-bold text-white transition hover:bg-white/10"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  )
}

export function FeedbackAlert({ feedback, className }: { feedback: Feedback; className?: string }) {
  if (!feedback) return null
  return (
    <Alert variant={feedback.type} className={className}>
      {feedback.message}
    </Alert>
  )
}
