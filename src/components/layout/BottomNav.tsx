'use client'

import { useId } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { m } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  // Quando true, só fica ativo na rota exata (ex.: "/admin").
  exact?: boolean
}

export function BottomNav({ items, label, className }: { items: NavItem[]; label: string; className?: string }) {
  const pathname = usePathname()
  const pillId = useId()

  return (
    <nav
      aria-label={label}
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 border-t border-line bg-black/90 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-2xl backdrop-saturate-150',
        className,
      )}
    >
      <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = item.icon
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <li key={item.href} className="flex justify-center">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className="group flex min-h-[52px] w-full flex-col items-center justify-center gap-1 rounded-2xl"
              >
                <span className="relative grid h-8 w-full max-w-14 place-items-center">
                  {active && (
                    <m.span
                      layoutId={pillId}
                      className="absolute inset-0 rounded-full bg-brand-soft ring-1 ring-brand/25"
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    />
                  )}
                  <Icon
                    className={cn(
                      'relative h-5 w-5 transition-colors',
                      active ? 'stroke-[2.4] text-brand' : 'text-zinc-500 group-hover:text-zinc-300',
                    )}
                    aria-hidden="true"
                  />
                </span>
                <span
                  className={cn(
                    'max-w-full truncate px-0.5 text-xs font-semibold tracking-wide transition-colors',
                    active ? 'text-white' : 'text-zinc-500',
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
