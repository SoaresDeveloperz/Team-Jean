'use client'

import type { ReactNode } from 'react'
import { m } from 'framer-motion'

// Entrada suave de cada tela (usada nos template.tsx, que remontam a cada navegação).
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </m.div>
  )
}
