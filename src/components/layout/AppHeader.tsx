import type { ReactNode } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/ui/logo'

type AppHeaderProps = {
  badge?: string
  actions?: ReactNode
  homeHref?: string
}

export function AppHeader({ badge, actions, homeHref = '/' }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-black/85 pt-[env(safe-area-inset-top)] backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-5 py-3">
        <Link href={homeHref} className="flex items-center gap-2.5" aria-label="Team Jean, ir para o início">
          <Logo className="h-7 w-7" />
          <span className="font-display text-[22px] font-bold uppercase leading-none tracking-[0.16em]">Team Jean</span>
        </Link>
        {(badge || actions) && (
          <div className="flex items-center gap-1.5">
            {badge && (
              <span className="rounded-full border border-brand/30 bg-brand-soft px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-brand">
                {badge}
              </span>
            )}
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}
