'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
// Olha a mágica aqui: usando caminhos relativos (../) em vez de @/
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
    
    const { error } = await supabase.auth.signInWithPassword({ 
      email, 
      password 
    })
    
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
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white focus:outline-none focus:border-white transition-all"
          />
          
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