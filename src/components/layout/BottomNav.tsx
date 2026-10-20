'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  // Quando true, só fica ativo na rota exata (ex.: "/admin").
  exact?: boolean
}

export function BottomNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-900 bg-black/95 px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl"
    >
      <ul className="mx-auto flex max-w-md items-end justify-around">
        {items.map((item) => {
          const Icon = item.icon
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className="flex min-w-[60px] flex-col items-center gap-1"
              >
                <span
                  className={cn(
                    'rounded-2xl border p-2 transition-all',
                    active ? 'border-zinc-700 bg-zinc-900' : 'border-transparent',
                  )}
                >
                  <Icon
                    className={cn('h-5 w-5', active ? 'stroke-[2.5] text-emerald-400' : 'text-zinc-500')}
                    aria-hidden="true"
                  />
                </span>
                <span
                  className={cn(
                    'text-[10px] uppercase tracking-wide',
                    active ? 'font-black text-white' : 'font-semibold text-zinc-500',
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
