'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function RootPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handleRedirect = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Se não tá logado, manda pro login
        router.replace('/login')
      } else {
        // Se tá logado, checa o cargo e redireciona
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role === 'admin') {
          router.replace('/admin/workouts')
        } else {
          router.replace('/student/today')
        }
      }
    }
    handleRedirect()
  }, [router, supabase])

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
      {/* Vetor da Logo TJ embutido para não dar erro de arquivo */}
      <svg viewBox="0 0 400 400" className="w-16 h-16 animate-pulse" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M60 120 L340 120 L300 150 L225 150 L225 280 L200 310 L150 250 L175 220 L200 250 L200 150 L100 150 Z" fill="white" />
        <path d="M245 170 L290 170 L290 280 L200 350 L160 300 L180 275 L200 295 L265 245 L265 170 Z" fill="white" />
      </svg>
      <div className="flex items-center gap-2 text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em]">
        <Loader2 className="animate-spin w-4 h-4" />
        Aguarde...
      </div>
    </div>
  )
}
