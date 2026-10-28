'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resetNotifications } from '@/lib/notifications'
import { cancelPushOnLogout } from '@/lib/push/client'
import { clearActiveSession } from '@/lib/active-session'
import { clearSavedWorkouts } from '@/lib/workout-session'
import { cn } from '@/lib/cn'

export function LogoutButton({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)
    // Primeiro cancela o push deste aparelho (o servidor só apaga o aparelho
    // de quem ainda está logado); depois sai. Se falhar, sai do mesmo jeito.
    await cancelPushOnLogout()
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    // Sem internet o servidor não confirma a saída: apaga a sessão só deste
    // aparelho, para o login não ser desfeito pelo cookie que ficou.
    if (error) await supabase.auth.signOut({ scope: 'local' })
    resetNotifications()
    // Treino em andamento e treinos guardados são desta conta: não ficam no aparelho.
    clearActiveSession()
    clearSavedWorkouts()
    // As telas guardadas para uso offline eram desta conta.
    navigator.serviceWorker?.controller?.postMessage({ type: 'clear-pages' })
    router.replace('/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      aria-label="Sair da conta"
      title="Sair"
      className={cn(
        'flex items-center gap-2 rounded-xl p-2 text-zinc-500 transition hover:text-white disabled:opacity-50',
        className,
      )}
    >
      {loading ? (
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="h-4 w-4" aria-hidden="true" />
      )}
      {showLabel && <span className="text-xs font-bold uppercase">Sair</span>}
    </button>
  )
}
