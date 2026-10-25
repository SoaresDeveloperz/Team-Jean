'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { m } from 'framer-motion'
import { ChevronRight, HeartPulse } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { loadAnamnese } from '@/lib/health'
import { tileVariants } from '@/components/ui/tile'

// Lembrete no "Hoje" enquanto o aluno não responde a ficha de saúde.
export function AnamnesePrompt({ studentId }: { studentId: string }) {
  const [supabase] = useState(() => createClient())
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let active = true
    loadAnamnese(supabase, studentId)
      .then((anamnese) => {
        if (active) setPending(anamnese === null)
      })
      // Sem o gestao.sql (ou sem conexão) o lembrete simplesmente não aparece.
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [supabase, studentId])

  if (!pending) return null
  return (
    <m.div variants={tileVariants} initial="hidden" animate="show">
      <Link
        href="/student/profile?anamnese=1"
        className="flex items-center gap-3 rounded-3xl border border-gold/30 bg-gold-soft p-4 transition hover:border-gold/50"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold text-black">
          <HeartPulse className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-white">Responda sua ficha de saúde</span>
          <span className="block text-xs text-zinc-300">PAR-Q em 2 minutos: ajuda o treinador a montar um treino seguro.</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
      </Link>
    </m.div>
  )
}
