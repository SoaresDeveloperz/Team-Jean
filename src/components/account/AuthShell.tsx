'use client'

import type { ReactNode } from 'react'
import { m } from 'framer-motion'
import { Logo } from '@/components/ui/logo'

// Moldura das telas de acesso (login, esqueci minha senha, nova senha).
export function AuthShell({ subtitle, children, footer }: { subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-black px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] text-white">
      <div className="glow-brand pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="glow-drift pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand/10 blur-3xl"
      />

      <m.main
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex w-full max-w-sm flex-col items-center space-y-8"
      >
        <div className="flex flex-col items-center space-y-4">
          <m.div
            initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
            className="rounded-[1.75rem] border border-line-strong bg-surface p-4 shadow-2xl shadow-black"
          >
            <Logo className="h-16 w-16" />
          </m.div>
          <div className="text-center">
            <h1 className="font-display text-5xl font-bold uppercase leading-none tracking-[0.12em] text-white">Team Jean</h1>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">{subtitle}</p>
          </div>
        </div>

        {children}

        {footer}
      </m.main>
    </div>
  )
}

export const authCardClassName = 'w-full space-y-4 rounded-[2rem] border border-line bg-surface/90 p-6 shadow-2xl shadow-black backdrop-blur-xl'
