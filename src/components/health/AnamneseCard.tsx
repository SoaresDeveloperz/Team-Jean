'use client'

import { useCallback, useEffect, useState } from 'react'
import { m } from 'framer-motion'
import { ChevronRight, HeartPulse, PencilLine, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { HealthError, loadAnamnese, type Anamnese } from '@/lib/health'
import { cn } from '@/lib/cn'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { Eyebrow, Tile } from '@/components/ui/tile'
import { AnamneseForm } from './AnamneseForm'
import { AnamneseSummary } from './AnamneseSummary'

type Status = 'loading' | 'ready' | 'missing' | 'error'

type AnamneseCardProps = {
  studentId: string
  // Treinador vendo a ficha do aluno (mostra as respostas).
  studentName?: string | null
  // Abre o formulário assim que carrega (link ?anamnese=1).
  autoOpen?: boolean
}

// Ficha de saúde: o aluno preenche no Perfil; o treinador lê e edita na ficha.
export function AnamneseCard({ studentId, studentName, autoOpen = false }: AnamneseCardProps) {
  const [supabase] = useState(() => createClient())
  const toast = useToast()
  const [status, setStatus] = useState<Status>('loading')
  const [anamnese, setAnamnese] = useState<Anamnese | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const coach = Boolean(studentName)

  useEffect(() => {
    let active = true
    loadAnamnese(supabase, studentId)
      .then((value) => {
        if (!active) return
        setAnamnese(value)
        setStatus('ready')
        if (autoOpen) setFormOpen(true)
      })
      .catch((error) => {
        if (active) setStatus(error instanceof HealthError && error.missing ? 'missing' : 'error')
      })
    return () => {
      active = false
    }
  }, [supabase, studentId, autoOpen])

  const open = () => {
    setFormKey((key) => key + 1)
    setFormOpen(true)
  }
  const close = useCallback(() => setFormOpen(false), [])
  const saved = (value: Anamnese) => {
    setAnamnese(value)
    setFormOpen(false)
    toast({
      tone: value.parq_positive ? 'info' : 'success',
      title: 'Ficha de saúde salva',
      description: value.parq_positive
        ? 'Converse com um médico antes de aumentar a intensidade. O treinador foi avisado.'
        : coach
          ? `Anamnese de ${studentName} atualizada.`
          : 'Obrigado! Seu treinador já pode ver.',
    })
  }

  const updated = anamnese ? new Date(anamnese.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : null

  const body =
    status === 'loading' ? (
      <Skeleton className="mt-3 h-16 rounded-2xl" />
    ) : status === 'missing' ? (
      <p className="mt-3 rounded-2xl border border-dashed border-line-strong p-4 text-center text-xs leading-relaxed text-zinc-400">
        {coach ? 'Para usar a ficha de saúde, rode o arquivo supabase/gestao.sql no Supabase.' : 'A ficha de saúde ainda não foi ativada. Avise seu treinador.'}
      </p>
    ) : status === 'error' ? (
      <p className="mt-3 text-xs text-danger">Não foi possível carregar a ficha de saúde.</p>
    ) : coach && anamnese ? (
      <div className="mt-3">
        <AnamneseSummary anamnese={anamnese} />
      </div>
    ) : null

  return (
    <>
      {coach ? (
        <section className="rounded-3xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h3>
              <Eyebrow icon={HeartPulse}>Ficha de saúde</Eyebrow>
            </h3>
            {status === 'ready' && (
              <m.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={open}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-black"
              >
                <PencilLine className="h-3.5 w-3.5" aria-hidden="true" /> {anamnese ? 'Editar' : 'Preencher'}
              </m.button>
            )}
          </div>
          {status === 'ready' && !anamnese && (
            <p className="mt-3 rounded-2xl border border-dashed border-line-strong p-4 text-center text-xs text-zinc-400">
              {studentName} ainda não respondeu a ficha de saúde.
            </p>
          )}
          {status === 'ready' && updated && <p className="mt-1 text-xs text-zinc-500">Atualizada em {updated}</p>}
          {body}
        </section>
      ) : (
        <Tile className="p-0">
          <button
            type="button"
            onClick={open}
            disabled={status !== 'ready'}
            className="flex w-full items-center gap-3 p-5 text-left disabled:cursor-default"
          >
            <span
              className={cn(
                'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                anamnese?.parq_positive ? 'bg-danger-soft text-danger' : anamnese ? 'bg-brand-soft text-brand' : 'bg-gold text-black',
              )}
            >
              {anamnese?.parq_positive ? <ShieldAlert className="h-5 w-5" aria-hidden="true" /> : <HeartPulse className="h-5 w-5" aria-hidden="true" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white">Ficha de saúde (PAR-Q)</span>
              <span className="block text-xs text-zinc-400">
                {status === 'loading'
                  ? 'Carregando…'
                  : status === 'missing'
                    ? 'Ainda não ativada pelo treinador'
                    : status === 'error'
                      ? 'Não foi possível carregar'
                      : anamnese
                        ? `${anamnese.parq_positive ? 'Com alerta · ' : ''}Respondida em ${updated}`
                        : 'Pendente · leva uns 2 minutos'}
              </span>
            </span>
            {status === 'ready' && <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden="true" />}
          </button>
        </Tile>
      )}

      <AnamneseForm key={formKey} open={formOpen} studentId={studentId} current={anamnese} forStudent={studentName} onClose={close} onSaved={saved} />
    </>
  )
}
