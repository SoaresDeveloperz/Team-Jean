'use client'

import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
// Olha a mágica aqui: usando caminhos relativos (../) em vez de @/
import { createClient } from '../lib/supabase/client'
import { Logo } from '../components/ui/logo'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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
        setError(error.message)
        return
      }

      if (!data.session) {
        setError('O Supabase não criou uma sessão para esta conta. Confira se o usuário está ativo no projeto correto.')
        return
      }

      const user = data.session.user
      const metadataRole = String(user.user_metadata?.role ?? '').toLowerCase()
      let isAdmin = metadataRole === 'admin'

      if (!isAdmin) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        isAdmin = String(profile?.role ?? '').toLowerCase() === 'admin'
      }

      if (!isAdmin && user.email) {
        const { data: profileByEmail } = await supabase
          .from('profiles')
          .select('role')
          .eq('email', user.email)
          .maybeSingle()

        isAdmin = String(profileByEmail?.role ?? '').toLowerCase() === 'admin'
      }

      window.location.replace(isAdmin ? '/admin/students' : '/dashboard')
    } catch {
      setError('Não foi possível conectar ao Supabase. Confira a conexão e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-black text-white">
      <div className="w-full max-w-sm flex flex-col items-center">
        <Logo className="w-28 h-28 mb-8" />
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black tracking-wider uppercase">TEAM JEAN</h1>
          <p className="text-xs text-zinc-500 font-medium tracking-widest mt-1">CONSULTORIA ESPORTIVA</p>
        </div>
        
        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white focus:outline-none focus:border-white transition-all"
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Senha"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 pr-12 text-white focus:outline-none focus:border-white transition-all"
            />
            <button
              type="button"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded text-zinc-400 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {showPassword ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
            </button>
          </div>
          
          {error && <p className="text-red-500 text-sm text-center font-bold">{error}</p>}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-extrabold rounded-xl p-4 mt-2 flex items-center justify-center h-14 active:scale-95 transition-all"
          >
            {loading ? <Loader2 className="animate-spin w-6 h-6" /> : 'ENTRAR'}
          </button>
        </form>
      </div>
    </div>
  )
}