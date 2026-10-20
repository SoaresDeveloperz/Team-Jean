'use client'

import type { ReactNode } from 'react'
import { LazyMotion, MotionConfig } from 'framer-motion'

const loadFeatures = () => import('./features').then((module) => module.default)

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures}>
      {/* "user": desliga animações de movimento quando o sistema pede menos movimento. */}
      <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  )
}
