'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock, Mail } from 'lucide-react'
import { createClient } from '../lib/supabase/client'
import { Logo } from '../components/ui/logo'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        setError('E-mail ou senha incorretos.')
        return
      }

      if (!data.session) {
        setError('O Supabase não criou uma sessão para esta conta. Confira se o usuário está ativo.')
        return
      }

      const user = data.session.user
      let isAdmin = String(user.user_metadata?.role ?? '').trim().toLowerCase() === 'admin'

      if (!isAdmin) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        isAdmin = String(profile?.role ?? '').trim().toLowerCase() === 'admin'
      }

      if (!isAdmin && user.email) {
        const { data: profilesByEmail } = await supabase
          .from('profiles')
          .select('role')
          .ilike('email', user.email.trim())
          .limit(20)

        isAdmin = profilesByEmail?.some(
          (profile) => String(profile.role ?? '').trim().toLowerCase() === 'admin',
        ) ?? false
      }

      router.replace(isAdmin ? '/admin/students' : '/dashboard')
      router.refresh()
    } catch {
      setError('Não foi possível conectar ao Supabase. Confira a conexão e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-black text-white">
      <div className="w-full max-w-sm flex flex-col items-center space-y-8">
        <div className="flex flex-col items-center">
          <Logo className="w-28 h-28 mb-5" />
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-widest uppercase text-white">TEAM JEAN</h1>
            <p className="text-[10px] text-zinc-500 font-extrabold tracking-widest uppercase mt-0.5">
              CONSULTORIA ESPORTIVA
            </p>
          </div>
        </div>

        {/* Card de Formulário */}
        <form onSubmit={handleLogin} className="w-full flex flex-col gap-5">
          <div className="space-y-2">
            <label htmlFor="email" className="text-xs font-semibold text-zinc-300">E-mail</label>
            <div className="relative">
              <Mail aria-hidden="true" className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2 transition-colors peer-focus:text-emerald-400" />
              <input
                id="email"
                type="email"
                name="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="peer h-14 w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-12 pr-4 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-semibold text-zinc-300">Senha</label>
            <div className="relative">
              <Lock aria-hidden="true" className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2 transition-colors peer-focus:text-emerald-400" />
              <input
                id="password"
                type="password"
                name="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="peer h-14 w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-12 pr-4 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-xs text-center font-bold">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-black text-xs uppercase tracking-widest rounded-2xl py-4 mt-2 hover:bg-zinc-200 active:scale-95 transition-all flex items-center justify-center h-14 shadow-xl"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'ENTRAR NO APP'}
          </button>
        </form>

        <p className="text-[10px] text-zinc-600 font-extrabold uppercase tracking-widest text-center">
          Acesso exclusivo para alunos cadastrados
        </p>
      </div>
    </div>
  )
}
