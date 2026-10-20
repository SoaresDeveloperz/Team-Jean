'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/ui/logo'
import { NotificationsButton } from './NotificationsButton'

export function StudentHeader() {
  const pathname = usePathname()

  // A tela de execução do treino tem a própria barra fixa no topo.
  if (pathname.startsWith('/student/workout/')) return null

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-black/85 pt-[env(safe-area-inset-top)] backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-5 py-3">
        <Link href="/student/today" className="flex items-center gap-2.5" aria-label="Team Jean, ir para Hoje">
          <Logo className="h-7 w-7" />
          <span className="font-display text-[22px] font-bold uppercase leading-none tracking-[0.16em]">Team Jean</span>
        </Link>
        <NotificationsButton />
      </div>
    </header>
  )
}
