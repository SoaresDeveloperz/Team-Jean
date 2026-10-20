'use client'

import type { ReactNode } from 'react'
import { m } from 'framer-motion'
import { cn } from '@/lib/cn'

type ProgressRingProps = {
  value: number // 0..1
  size?: number
  stroke?: number
  color?: string
  trackColor?: string
  className?: string
  children?: ReactNode
  label?: string
}

export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  color = 'var(--color-brand)',
  trackColor = 'rgb(255 255 255 / 0.08)',
  className,
  children,
  label,
}: ProgressRingProps) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(1, Math.max(0, value))

  return (
    <div
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <m.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped) }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  )
}
