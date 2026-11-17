'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Salad } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/logo'
import { useHasNutritionPlan } from '@/components/student/NutritionLink'
import { NotificationsButton } from './NotificationsButton'

export function StudentHeader() {
  const pathname = usePathname()
  const [userId, setUserId] = useState<string | null>(null)
  const hasPlan = useHasNutritionPlan(userId)

  useEffect(() => {
    let active = true
    void getCurrentUser(createClient()).then((user) => {
      if (active) setUserId(user?.id ?? null)
    })
    return () => {
      active = false
    }
  }, [])

  // A tela de execução do treino tem a própria barra fixa no topo.
  if (pathname.startsWith('/student/workout/')) return null

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-black/85 pt-[env(safe-area-inset-top)] backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-3 min-[360px]:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/student/today" className="flex items-center gap-2.5" aria-label="Team Jean, ir para Hoje">
            <Logo className="h-7 w-7" />
            <span className="whitespace-nowrap font-display text-[19px] font-bold uppercase leading-none tracking-[0.12em] min-[360px]:text-[22px] min-[360px]:tracking-[0.16em]">
              Team Jean
            </span>
          </Link>
          {hasPlan && (
            <Link
              href="/student/nutrition"
              aria-label="Ver minha alimentação"
              aria-current={pathname.startsWith('/student/nutrition') ? 'page' : undefined}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-brand/30 bg-brand-soft text-brand transition active:scale-95 hover:brightness-110"
            >
              <Salad className="h-5 w-5" aria-hidden="true" />
            </Link>
          )}
        </div>
        <NotificationsButton />
      </div>
    </header>
  )
}
