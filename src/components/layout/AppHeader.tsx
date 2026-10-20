import type { ReactNode } from 'react'
import { Logo } from '@/components/ui/logo'

type AppHeaderProps = {
  badge?: string
  actions?: ReactNode
}

export function AppHeader({ badge, actions }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-900 bg-black/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <Logo className="h-8 w-8" />
          <span className="text-lg font-black uppercase tracking-widest">Team Jean</span>
        </div>
        {(badge || actions) && (
          <div className="flex items-center gap-2">
            {badge && (
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase text-black">
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
