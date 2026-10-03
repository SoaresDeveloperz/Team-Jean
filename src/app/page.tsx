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
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
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
        <form onSubmit={handleLogin} className="w-full bg-zinc-950 border border-zinc-900 rounded-3xl p-6 space-y-4 shadow-2xl">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">E-mail</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-4 top-4" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-white transition-all placeholder:text-zinc-600 font-medium"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-4 top-4" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-white transition-all placeholder:text-zinc-600 font-medium"
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
