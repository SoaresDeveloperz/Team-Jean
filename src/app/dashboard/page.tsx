'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import { Logo } from '../../components/ui/logo'

type DashboardState =
  | { status: 'loading' }
  | { status: 'ready'; email: string }
  | { status: 'error' }

export default function DashboardPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [dashboard, setDashboard] = useState<DashboardState>({ status: 'loading' })
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')

  useEffect(() => {
    let active = true

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return

      if (error) {
        setDashboard({ status: 'error' })
        return
      }

      if (!data.user) {
        router.replace('/')
        return
      }

      setDashboard({
        status: 'ready',
        email: data.user.email ?? 'Conta Team Jean',
      })
    }).catch(() => {
      if (active) setDashboard({ status: 'error' })
    })

    return () => {
      active = false
    }
  }, [router, supabase])

  const handleSignOut = async () => {
    setSigningOut(true)
    setSignOutError('')

    const { error } = await supabase.auth.signOut()

    if (error) {
      setSignOutError('Não foi possível sair agora. Tente novamente.')
      setSigningOut(false)
      return
    }

    router.replace('/')
  }

  if (dashboard.status !== 'ready') {
    return (
      <main className="min-h-screen bg-black px-6 text-white flex items-center justify-center">
        <p className="text-sm text-zinc-400">
          {dashboard.status === 'error'
            ? 'Não foi possível verificar sua sessão. Tente entrar novamente.'
            : 'Verificando seu acesso...'}
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-12">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo className="h-12 w-12" />
            <div>
              <p className="text-sm font-black tracking-widest">TEAM JEAN</p>
              <p className="text-[10px] font-medium tracking-[0.2em] text-zinc-500">
                CONSULTORIA ESPORTIVA
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-900 disabled:opacity-50"
          >
            {signingOut ? 'Saindo...' : 'Sair'}
          </button>
        </header>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7 sm:p-10">
          <p className="text-xs font-bold tracking-[0.2em] text-zinc-500">
            ÁREA DO ATLETA
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Você entrou.
          </h1>
          <p className="mt-3 text-zinc-400">
            Sua sessão do Team Jean está ativa.
          </p>
          <div className="mt-8 border-t border-zinc-800 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Conta conectada
            </p>
            <p className="mt-2 break-all text-sm text-zinc-200">{dashboard.email}</p>
          </div>
          {signOutError && (
            <p role="alert" className="mt-5 text-sm text-red-400">
              {signOutError}
            </p>
          )}
        </section>
      </div>
    </main>
  )
}