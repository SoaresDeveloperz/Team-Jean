'use client'

import { useState } from 'react'
import { m } from 'framer-motion'
import { LoaderCircle } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import { CoachError, METRICS, createChallenge, isoDay, metricInfo, notifyStudents, type ChallengeMetric } from '@/lib/coach'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { Modal, SheetFooter } from '@/components/ui/modal'
import { Switch } from '@/components/ui/switch'

const DEFAULT_GOAL: Record<ChallengeMetric, string> = { workouts: '12', active_days: '10', volume: '20000' }
const PERIODS = [
  { value: '7', label: '7 dias' },
  { value: '14', label: '14 dias' },
  { value: '30', label: '30 dias' },
  { value: 'month', label: 'Até o fim do mês' },
]

const inputClassName =
  'w-full rounded-2xl border border-line-strong bg-black/40 p-3.5 text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none'
const labelClassName = 'mb-1.5 block text-xs font-black uppercase tracking-[0.1em] text-zinc-400'
const chipClassName =
  'cursor-pointer rounded-full border border-line px-3.5 py-2 text-xs font-bold text-zinc-300 transition hover:text-white has-[:checked]:border-white has-[:checked]:bg-white has-[:checked]:text-black has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand'

function periodEnd(start: Date, period: string) {
  if (period === 'month') return new Date(start.getFullYear(), start.getMonth() + 1, 0, 12)
  const end = new Date(start)
  end.setDate(end.getDate() + Number(period) - 1)
  return end
}

const short = (date: Date) => date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

type ChallengeFormProps = {
  open: boolean
  studentIds: string[]
  onClose: () => void
  onCreated: () => void
}

// Montado de novo a cada abertura (key no pai): começa sempre limpo.
export function ChallengeForm({ open, studentIds, onClose, onCreated }: ChallengeFormProps) {
  const [supabase] = useState(() => createClient())
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [metric, setMetric] = useState<ChallengeMetric>('workouts')
  const [goal, setGoal] = useState(DEFAULT_GOAL.workouts)
  const [period, setPeriod] = useState('14')
  const [notify, setNotify] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [start] = useState(() => new Date())
  const end = periodEnd(start, period)
  const unit = metricInfo(metric).unit

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    const name = title.trim()
    const target = Number(goal.replace(/\./g, '').replace(',', '.'))
    if (name.length < 3) return setError('Dê um nome com pelo menos 3 letras.')
    if (!Number.isFinite(target) || target <= 0) return setError('Informe uma meta maior que zero.')
    setSaving(true)
    try {
      const user = await getCurrentUser(supabase)
      if (!user) throw new Error('Sessão expirada. Entre de novo.')
      const challenge = await createChallenge(
        supabase,
        { title: name, description: description.trim() || null, metric, goal: target, starts_on: isoDay(start), ends_on: isoDay(end) },
        user.id,
      )
      if (notify) {
        // O desafio já existe; um aviso que falhe não desfaz nada.
        await notifyStudents(
          supabase,
          studentIds,
          `Novo desafio: ${challenge.title} 🔥`,
          `Meta: ${target.toLocaleString('pt-BR')} ${unit} até ${short(end)}. Veja o placar na aba Equipe.`,
          'community',
        ).catch(() => undefined)
      }
      onCreated()
    } catch (saveError) {
      setError(
        saveError instanceof CoachError && saveError.missing
          ? 'Rode o arquivo supabase/coach.sql no SQL Editor do Supabase para ativar os desafios.'
          : saveError instanceof Error
            ? saveError.message
            : 'Não foi possível criar o desafio.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={saving ? () => undefined : onClose} variant="sheet" title="Novo desafio" description="A equipe toda participa; o placar sai dos treinos concluídos.">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="challenge-title" className={labelClassName}>
            Nome do desafio
          </label>
          <input
            id="challenge-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={60}
            placeholder="Ex: Outubro sem falta"
            className={inputClassName}
          />
        </div>

        <fieldset>
          <legend className={labelClassName}>O que conta</legend>
          <div className="flex flex-wrap gap-1.5">
            {METRICS.map((item) => (
              <label key={item.value} className={chipClassName}>
                <input
                  type="radio"
                  name="challenge-metric"
                  value={item.value}
                  checked={metric === item.value}
                  onChange={() => {
                    setMetric(item.value)
                    setGoal(DEFAULT_GOAL[item.value])
                  }}
                  className="sr-only"
                />
                {item.label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-500">{metricInfo(metric).hint}.</p>
        </fieldset>

        <div>
          <label htmlFor="challenge-goal" className={labelClassName}>
            Meta por aluno
          </label>
          <div className="relative">
            <input
              id="challenge-goal"
              inputMode="numeric"
              value={goal}
              onChange={(event) => setGoal(event.target.value.replace(/[^\d.,]/g, ''))}
              className={cn(inputClassName, 'pr-20 font-display text-2xl font-bold')}
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">{unit}</span>
          </div>
        </div>

        <fieldset>
          <legend className={labelClassName}>Duração</legend>
          <div className="flex flex-wrap gap-1.5">
            {PERIODS.map((item) => (
              <label key={item.value} className={chipClassName}>
                <input
                  type="radio"
                  name="challenge-period"
                  value={item.value}
                  checked={period === item.value}
                  onChange={() => setPeriod(item.value)}
                  className="sr-only"
                />
                {item.label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            De {short(start)} a {short(end)}.
          </p>
        </fieldset>

        <div>
          <label htmlFor="challenge-description" className={labelClassName}>
            Recado (opcional)
          </label>
          <textarea
            id="challenge-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={280}
            rows={2}
            placeholder="Ex: quem completar ganha uma aula extra!"
            className={cn(inputClassName, 'resize-none text-sm')}
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3.5">
          <div>
            <p className="text-sm font-bold text-white">Avisar os alunos</p>
            <p className="text-xs text-zinc-500">Manda um aviso no sino de cada aluno.</p>
          </div>
          <Switch label="Avisar os alunos" checked={notify} onChange={setNotify} />
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        <SheetFooter>
          <m.button
            type="submit"
            whileTap={{ scale: 0.98 }}
            disabled={saving}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black uppercase tracking-[0.14em] text-black disabled:opacity-60"
          >
            {saving ? <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Criando" /> : 'Criar desafio'}
          </m.button>
        </SheetFooter>
      </form>
    </Modal>
  )
}
