'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Logo } from '@/components/ui/logo'
import { NotificationsButton } from './NotificationsButton'

export function StudentHeader() {
  const pathname = usePathname()
  // A tela de execução do treino tem a própria barra fixa no topo.
  if (pathname.startsWith('/student/workout/')) return null

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-black/85 pt-[env(safe-area-inset-top)] backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-3 min-[360px]:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/student/today" className="flex items-center gap-2.5" aria-label="Team Jean, ir para Hoje">
            <Logo className="h-7 w-7" />
            <span className="whitespace-nowrap font-display text-[19px] font-bold uppercase leading-none tracking-[0.12em] max-[339px]:sr-only min-[360px]:text-[22px] min-[360px]:tracking-[0.16em]">
              Team Jean
            </span>
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <NotificationsButton />
          <Link
            href="/student/profile"
            aria-label="Meu perfil"
            aria-current={pathname.startsWith('/student/profile') ? 'page' : undefined}
            className={cn(
              'grid h-11 w-11 place-items-center rounded-2xl border transition active:scale-95',
              pathname.startsWith('/student/profile') ? 'border-brand/40 bg-brand-soft text-brand' : 'border-line bg-surface text-zinc-300 hover:text-white',
            )}
          >
            <User className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  )
}
