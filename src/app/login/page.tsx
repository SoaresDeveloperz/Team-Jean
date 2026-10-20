'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, LoaderCircle, Lock, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/logo'
import { Alert } from '@/components/ui/alert'

const inputClassName =
  'w-full rounded-2xl border border-zinc-800 bg-zinc-900 py-3.5 pl-11 pr-4 text-sm font-medium text-white transition-all placeholder:text-zinc-600 focus:border-white focus:outline-none'

function translateLoginError(message: string) {
  const text = message.toLowerCase()
  if (text.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (text.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (text.includes('fetch') || text.includes('network')) return 'Sem conexão. Verifique sua internet.'
  return 'Não foi possível entrar. Tente novamente.'
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error: signInError } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) {
        setError(translateLoginError(signInError.message))
        setLoading(false)
        return
      }
      // A página inicial decide o destino (painel do treinador ou do aluno).
      router.replace('/')
      router.refresh()
    } catch {
      setError('Sem conexão. Verifique sua internet.')
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black p-6 text-white">
      <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-zinc-900/40 blur-3xl" aria-hidden="true" />

      <main className="z-10 flex w-full max-w-sm flex-col items-center space-y-8">
        <div className="flex flex-col items-center space-y-3">
          <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950 p-4 shadow-2xl">
            <Logo className="h-16 w-16" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black uppercase tracking-widest text-white">Team Jean</h1>
            <p className="mt-0.5 text-[10px] font-extrabold uppercase tracking-widest text-zinc-500">Consultoria esportiva</p>
          </div>
        </div>

        <form
          onSubmit={handleLogin}
          className="w-full space-y-4 rounded-3xl border border-zinc-900 bg-zinc-950 p-6 shadow-2xl"
        >
          <div className="space-y-1">
            <label htmlFor="email" className="block text-[10px] font-black uppercase tracking-wider text-zinc-400">
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-4 h-4 w-4 text-zinc-500" aria-hidden="true" />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seu@email.com"
                className={inputClassName}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block text-[10px] font-black uppercase tracking-wider text-zinc-400">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-4 h-4 w-4 text-zinc-500" aria-hidden="true" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className={`${inputClassName} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                className="absolute right-2 top-1.5 rounded-xl p-2.5 text-zinc-500 hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex h-14 w-full items-center justify-center rounded-2xl bg-white py-4 text-xs font-black uppercase tracking-widest text-black shadow-xl transition-all hover:bg-zinc-200 active:scale-95 disabled:opacity-70"
          >
            {loading ? <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Entrando" /> : 'Entrar no app'}
          </button>
        </form>

        <p className="text-center text-[10px] font-extrabold uppercase tracking-widest text-zinc-600">
          Acesso exclusivo para alunos cadastrados
        </p>
      </main>
    </div>
  )
}
