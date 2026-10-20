'use client'

import { useEffect, useId, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  // "dialog": cartão central; "sheet": tela cheia (formulários longos).
  variant?: 'dialog' | 'sheet'
}

export function Modal({ open, onClose, title, description, children, variant = 'dialog' }: ModalProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  const isSheet = variant === 'sheet'

  return (
    <div
      className={cn(
        'fixed inset-0 z-[60] flex bg-black/90 backdrop-blur-sm',
        isSheet ? 'items-stretch' : 'items-end justify-center sm:items-center sm:p-4',
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'w-full overflow-y-auto',
          isSheet
            ? 'bg-black px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]'
            : 'max-h-[90vh] max-w-sm rounded-t-3xl border border-zinc-800 bg-zinc-950 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-6',
        )}
      >
        <div className={cn(isSheet && 'mx-auto max-w-md')}>
          <div className="mb-5 flex items-start justify-between gap-3 border-b border-zinc-900 pb-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-black uppercase leading-tight">
                {title}
              </h2>
              {description && <div className="mt-1 text-xs text-zinc-500">{description}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="-mr-2 -mt-1 rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
