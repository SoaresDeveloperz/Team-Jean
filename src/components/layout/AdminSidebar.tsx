'use client'

import { useId } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { m } from 'framer-motion'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/cn'
import { ADMIN_NAV_ITEMS } from './AdminNav'
import { LogoutButton } from './LogoutButton'
import { NotificationsButton } from './NotificationsButton'

// Menu lateral do treinador no computador (no celular fica o menu inferior).
export function AdminSidebar() {
  const pathname = usePathname()
  const pillId = useId()

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-black/95 px-4 pb-6 pt-7 backdrop-blur-2xl lg:flex">
      <Link href="/admin" className="flex items-center gap-2.5 px-2" aria-label="Team Jean, ir para o painel">
        <Logo className="h-8 w-8" />
        <span className="font-display text-2xl font-bold uppercase leading-none tracking-[0.16em]">Team Jean</span>
      </Link>
      <div className="ml-2 mt-3 flex items-center justify-between gap-2">
        <span className="rounded-full border border-brand/30 bg-brand-soft px-2.5 py-1 text-xs font-black uppercase tracking-[0.1em] text-brand">
          Treinador
        </span>
        <NotificationsButton audience="coach" />
      </div>

      <nav aria-label="Menu do treinador" className="mt-8 flex-1">
        <ul className="space-y-1">
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-11 items-center gap-3 rounded-2xl px-3.5 text-sm font-semibold transition-colors',
                    active ? 'text-white' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white',
                  )}
                >
                  {active && (
                    <m.span
                      layoutId={pillId}
                      className="absolute inset-0 rounded-2xl bg-brand-soft ring-1 ring-brand/25"
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    />
                  )}
                  <Icon className={cn('relative h-[18px] w-[18px]', active ? 'stroke-[2.4] text-brand' : '')} aria-hidden="true" />
                  <span className="relative">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <LogoutButton showLabel className="h-11 justify-center rounded-2xl border border-line bg-surface text-zinc-400 hover:border-danger/40 hover:text-danger" />
    </aside>
  )
}
