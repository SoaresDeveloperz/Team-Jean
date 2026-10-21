'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, LoaderCircle, Lock, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Alert } from '@/components/ui/alert'
import { AuthShell, authCardClassName } from '@/components/account/AuthShell'

const inputClassName =
  'w-full rounded-2xl border border-line-strong bg-black/40 py-3.5 pl-11 pr-4 text-sm font-medium text-white transition-all placeholder:text-zinc-600 focus:border-brand focus:outline-none'

const subscribeNothing = () => () => {}

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
  // Voltou do link de nova senha vencido (/auth/confirm → ?erro=link).
  const linkExpired = useSyncExternalStore(
    subscribeNothing,
    () => new URLSearchParams(window.location.search).get('erro') === 'link',
    () => false,
  )

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
    <AuthShell
      subtitle="Consultoria esportiva"
      footer={
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          Acesso exclusivo para alunos cadastrados
        </p>
      }
    >
      {linkExpired && (
        <Alert variant="info">O link de nova senha expirou ou já foi usado. Peça outro em “Esqueci minha senha”.</Alert>
      )}
      <form onSubmit={handleLogin} className={authCardClassName}>
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
          <div className="flex items-end justify-between gap-2">
            <label htmlFor="password" className="block text-[10px] font-black uppercase tracking-wider text-zinc-400">
              Senha
            </label>
            <Link href="/esqueci-senha" className="rounded-lg text-[11px] font-bold text-brand hover:underline">
              Esqueci minha senha
            </Link>
          </div>
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
    </AuthShell>
  )
}
