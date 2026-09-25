'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard } from 'lucide-react'
import { createClient } from '../../lib/supabase/client'
import { Logo } from '../../components/ui/logo'

type DashboardState =
  | { status: 'loading' }
  | { status: 'ready'; email: string; isAdmin: boolean }
  | { status: 'unauthenticated' }
  | { status: 'error' }

export default function DashboardPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [dashboard, setDashboard] = useState<DashboardState>({ status: 'loading' })
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return

      if (error) {
        setDashboard({ status: 'error' })
        return
      }

      if (!data.session) {
        setDashboard({ status: 'unauthenticated' })
        return
      }

      const metadataRole = data.session.user.user_metadata?.role
      let isAdmin = metadataRole === 'admin'

      if (!isAdmin) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.session.user.id)
          .maybeSingle()

        if (!active) return
        isAdmin = profile?.role === 'admin'
      }

      setDashboard({
        status: 'ready',
        email: data.session.user.email ?? 'Conta Team Jean',
        isAdmin,
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
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <p className="text-sm text-zinc-400">
            {dashboard.status === 'error'
              ? 'Não foi possível verificar sua sessão. Tente entrar novamente.'
              : dashboard.status === 'unauthenticated'
                ? 'O login não manteve uma sessão neste navegador. Confira se a URL e a chave do Supabase pertencem ao mesmo projeto.'
                : 'Verificando seu acesso...'}
          </p>
          {dashboard.status === 'unauthenticated' && (
            <button
              type="button"
              onClick={() => router.replace('/')}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-900"
            >
              Voltar ao login
            </button>
          )}
        </div>
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
          <div className="flex items-center gap-2">
            {dashboard.isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm font-semibold transition hover:bg-zinc-900"
              >
                <LayoutDashboard aria-hidden="true" size={16} />
                <span className="hidden sm:inline">Painel Admin</span>
                <span className="sm:hidden">Admin</span>
              </Link>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-900 disabled:opacity-50"
            >
              {signingOut ? 'Saindo...' : 'Sair'}
            </button>
          </div>
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