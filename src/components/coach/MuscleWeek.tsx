'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { loadMuscleWeek, regionList, type MuscleWeek as MuscleWeekData } from '@/lib/coach-insights'
import { plural } from '@/lib/text'
import { Alert } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Body3D } from '@/components/fitness/Body3D'
import { friendlyError } from '@/lib/errors'

// Mapa 3D do que o aluno treinou nos últimos 7 dias e o que ficou de fora.
export function MuscleWeek({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [supabase] = useState(() => createClient())
  const [data, setData] = useState<MuscleWeekData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const week = await loadMuscleWeek(supabase, studentId)
        if (active) setData(week)
      } catch (loadError) {
        if (active) setError(friendlyError(loadError, 'Não foi possível carregar a semana'))
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [supabase, studentId])

  if (error) return <Alert variant="error">{error}</Alert>
  if (!data) {
    return (
      <div className="space-y-2" role="status" aria-label="Carregando a semana do aluno">
        <Skeleton className="h-[22rem] rounded-3xl" />
        <Skeleton className="h-14 rounded-2xl" />
      </div>
    )
  }

  const firstName = studentName.split(' ')[0]
  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-400">
        Últimos 7 dias: <span className="font-bold text-white">{plural(data.sessions, 'treino', 'treinos')}</span> ·{' '}
        <span className="font-bold text-white">{plural(data.sets, 'série', 'séries')}</span>. Quanto mais forte o verde, mais séries.
      </p>
      <Body3D fills={data.fills} details={data.details} label={`Músculos que ${firstName} treinou nos últimos 7 dias`} heightClassName="h-[22rem]" />
      {data.neglected.length > 0 ? (
        <div className="flex gap-3 rounded-2xl border border-gold/25 bg-gold-soft p-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-zinc-200">
            <span className="font-bold text-white">Sem estímulo há 10+ dias:</span> {regionList(data.neglected)}. Vale incluir no
            próximo treino.
          </p>
        </div>
      ) : (
        <div className="flex gap-3 rounded-2xl border border-brand/25 bg-brand-soft p-3.5">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-zinc-200">Todos os grupos grandes foram treinados nos últimos 10 dias.</p>
        </div>
      )}
    </div>
  )
}
