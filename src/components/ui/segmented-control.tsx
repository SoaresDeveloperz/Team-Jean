'use client'

import { useId } from 'react'
import { m } from 'framer-motion'
import { cn } from '@/lib/cn'

type Option<T extends string | number> = { value: T; label: string }

type SegmentedControlProps<T extends string | number> = {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
  size?: 'sm' | 'md'
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
  size = 'md',
}: SegmentedControlProps<T>) {
  const pillId = useId()

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('flex rounded-xl border border-line bg-surface p-1', className)}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative flex-1 rounded-lg font-bold transition-colors',
              size === 'sm' ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs',
              selected ? 'text-black' : 'text-zinc-400 hover:text-white',
            )}
          >
            {selected && (
              <m.span
                layoutId={pillId}
                className="absolute inset-0 rounded-lg bg-white"
                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
