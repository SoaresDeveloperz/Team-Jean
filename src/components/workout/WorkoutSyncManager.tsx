'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { CloudOff, CloudUpload } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import { startWorkoutSync, useWorkoutSync } from '@/lib/workout-sync'
import { requestPushDelivery } from '@/lib/push/client'
import { cn } from '@/lib/cn'
import { useToast } from '@/components/ui/toast'

// Envia em segundo plano, de qualquer tela do aluno, o treino que ficou na
// fila (feito sem internet) e avisa quando ele chega ao histórico.
export function WorkoutSyncManager() {
  const pathname = usePathname()
  const toast = useToast()
  const sync = useWorkoutSync()
  const [supabase] = useState(() => createClient())
  const onWorkout = pathname.startsWith('/student/workout/')

  useEffect(() => {
    let active = true
    void getCurrentUser(supabase).then((user) => {
      if (active && user) void startWorkoutSync(supabase, user.id)
    })
    return () => {
      active = false
    }
  }, [supabase])

  const { delivered } = sync
  useEffect(() => {
    if (delivered === 0) return
    // O recado do treino virou aviso para o treinador: sai o push.
    requestPushDelivery()
    if (!window.location.pathname.startsWith('/student/workout/')) {
      toast({ tone: 'success', title: 'Treino sincronizado', description: 'O treino feito sem internet já está no seu histórico.' })
    }
  }, [delivered, toast])

  const visible = !onWorkout && sync.ops.length > 0
  return (
    <AnimatePresence>
      {visible && (
        <m.div
          key="sync-pill"
          role="status"
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12 }}
          className={cn(
            'pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-bold shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur',
            sync.offline ? 'border-gold/30 bg-black/90 text-gold' : 'border-line-strong bg-black/90 text-zinc-200',
          )}
        >
          {sync.offline ? <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" /> : <CloudUpload className="h-4 w-4 shrink-0 animate-pulse" aria-hidden="true" />}
          {sync.offline ? 'Sem internet · treino salvo no aparelho' : 'Enviando o treino salvo no aparelho…'}
        </m.div>
      )}
    </AnimatePresence>
  )
}
