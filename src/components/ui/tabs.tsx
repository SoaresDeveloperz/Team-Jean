'use client'

import { useRef, type ReactNode } from 'react'
import { m } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export type TabItem<T extends string> = { value: T; label: string; icon?: LucideIcon; badge?: number }

type TabsProps<T extends string> = {
  // Mesmo id passado aos TabPanel (crie com useId no componente pai).
  id: string
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
}

// Abas com a semântica de tablist (setas e Home/End trocam de aba) e uma
// pílula que desliza até a aba ativa.
export function Tabs<T extends string>({ id: baseId, items, value, onChange, label, className }: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)

  const focusTab = (index: number) => {
    const item = items[(index + items.length) % items.length]
    onChange(item.value)
    listRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${item.value}"]`)?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const current = items.findIndex((item) => item.value === value)
    if (event.key === 'ArrowRight') focusTab(current + 1)
    else if (event.key === 'ArrowLeft') focusTab(current - 1)
    else if (event.key === 'Home') focusTab(0)
    else if (event.key === 'End') focusTab(items.length - 1)
    else return
    event.preventDefault()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cn('no-scrollbar flex gap-1 overflow-x-auto rounded-2xl border border-line bg-black/30 p-1', className)}
    >
      {items.map((item) => {
        const selected = item.value === value
        const Icon = item.icon
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            data-tab={item.value}
            id={`${baseId}-tab-${item.value}`}
            aria-selected={selected}
            aria-controls={`${baseId}-panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              // flex-auto + min-w-max: cada aba tem pelo menos a largura do texto (antes, flex-1 com base 0 sobrepunha os rótulos).
              'relative flex h-11 min-w-max flex-auto shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors',
              selected ? 'text-black' : 'text-zinc-400 hover:text-white',
            )}
          >
            {selected && (
              <m.span
                layoutId={`${baseId}-pill`}
                className="absolute inset-0 rounded-xl bg-white"
                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
              />
            )}
            {Icon && <Icon className="relative h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            <span className="relative whitespace-nowrap">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span
                className={cn(
                  'relative grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs font-black leading-none tabular-nums',
                  selected ? 'bg-black text-white' : 'bg-brand text-black',
                )}
              >
                {item.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// Painel ligado à aba (ids iguais aos do Tabs com o mesmo baseId).
export function TabPanel({ tabsId, value, children, className }: { tabsId: string; value: string; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={`${tabsId}-panel-${value}`} aria-labelledby={`${tabsId}-tab-${value}`} className={className}>
      {children}
    </div>
  )
}
