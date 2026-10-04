'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const go = async () => {
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
        router.replace('/admin/students')
      } else {
        router.replace('/student/today')
      }
    }
    go()
  }, [router, supabase])

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-600 font-black">
        Team Jean
      </p>
    </div>
  )
}
