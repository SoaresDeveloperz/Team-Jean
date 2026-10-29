'use client'

import type { ReactNode } from 'react'
import { m } from 'framer-motion'
import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Modal } from './modal'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel: string
  tone?: 'danger' | 'default'
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

// Substitui o window.confirm: mesmo visual dos outros modais e funciona no PWA.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'danger',
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-12 rounded-2xl border border-line-strong text-xs font-black uppercase tracking-wider text-zinc-200"
        >
          Cancelar
        </button>
        <m.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={onConfirm}
          disabled={busy}
          className={cn(
            'flex h-12 items-center justify-center rounded-2xl text-xs font-black uppercase tracking-wider text-black disabled:opacity-60',
            tone === 'danger' ? 'bg-danger' : 'bg-white',
          )}
        >
          {busy ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span className="sr-only">Aguarde…</span>
            </>
          ) : (
            confirmLabel
          )}
        </m.button>
      </div>
    </Modal>
  )
}
