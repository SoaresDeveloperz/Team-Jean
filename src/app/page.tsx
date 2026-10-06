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
        router.replace('/login')
        return
      }

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

    handleRedirect()
  }, [router, supabase])

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">TEAM JEAN</p>
    </div>
  )
}
