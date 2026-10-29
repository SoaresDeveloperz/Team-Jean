'use client'

import { m } from 'framer-motion'
import { cn } from '@/lib/cn'

type SwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'touch-44 relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors',
        checked ? 'bg-brand' : 'bg-white/15',
      )}
    >
      <m.span
        className="h-6 w-6 rounded-full bg-white shadow-md"
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 600, damping: 34 }}
      />
    </button>
  )
}
