'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { m } from 'framer-motion'
import { Eye, EyeOff, LoaderCircle, Lock, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/logo'
import { Alert } from '@/components/ui/alert'

const inputClassName =
  'w-full rounded-2xl border border-line-strong bg-black/40 py-3.5 pl-11 pr-4 text-sm font-medium text-white transition-all placeholder:text-zinc-600 focus:border-brand focus:outline-none'

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
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-black px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] text-white">
      <div className="glow-brand pointer-events-none absolute inset-0" aria-hidden="true" />
      <m.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand/10 blur-3xl"
        animate={{ scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      <m.main
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex w-full max-w-sm flex-col items-center space-y-8"
      >
        <div className="flex flex-col items-center space-y-4">
          <m.div
            initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
            className="rounded-[1.75rem] border border-line-strong bg-surface p-4 shadow-2xl shadow-black"
          >
            <Logo className="h-16 w-16" />
          </m.div>
          <div className="text-center">
            <h1 className="font-display text-5xl font-bold uppercase leading-none tracking-[0.12em] text-white">Team Jean</h1>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-500">Consultoria esportiva</p>
          </div>
        </div>

        <form
          onSubmit={handleLogin}
          className="w-full space-y-4 rounded-[2rem] border border-line bg-surface/90 p-6 shadow-2xl shadow-black backdrop-blur-xl"
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
            className="mt-2 flex h-14 w-full items-center justify-center rounded-2xl bg-white py-4 text-sm font-black uppercase tracking-[0.2em] text-black shadow-[0_10px_40px_rgba(255,255,255,0.12)] transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-70"
          >
            {loading ? <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Entrando" /> : 'Entrar no app'}
          </button>
        </form>

        <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          Acesso exclusivo para alunos cadastrados
        </p>
      </m.main>
    </div>
  )
}
