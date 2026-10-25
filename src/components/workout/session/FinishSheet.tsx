'use client'

import { useId } from 'react'
import { m } from 'framer-motion'
import { Clock, CloudOff, Layers, LoaderCircle, Weight } from 'lucide-react'
import { formatKg } from '@/lib/workouts'
import { FEEDBACK_MAX, FEEDBACK_TAGS } from '@/lib/feedback'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { ElapsedTime } from './ElapsedTime'

const RPE_LABELS: Record<number, string> = {
  1: 'Muito leve',
  2: 'Leve',
  3: 'Leve',
  4: 'Moderado',
  5: 'Moderado',
  6: 'Um pouco difícil',
  7: 'Difícil',
  8: 'Muito difícil',
  9: 'Quase no limite',
  10: 'Esforço máximo',
}

function rpeColor(value: number) {
  if (value <= 4) return '#34d399'
  if (value <= 7) return '#fbbf24'
  return '#fb7185'
}

type FinishSheetProps = {
  open: boolean
  onClose: () => void
  startedAt: number
  done: number
  total: number
  volume: number
  rpe: number
  onRpeChange: (value: number) => void
  feedback: string
  onFeedbackChange: (value: string) => void
  tags: string[]
  onTagsChange: (value: string[]) => void
  // Sem internet: o treino fica no aparelho e sobe quando a conexão voltar.
  offline: boolean
  finishing: boolean
  error: string
  onConfirm: () => void
}

export function FinishSheet({
  open,
  onClose,
  startedAt,
  done,
  total,
  volume,
  rpe,
  onRpeChange,
  feedback,
  onFeedbackChange,
  tags,
  onTagsChange,
  offline,
  finishing,
  error,
  onConfirm,
}: FinishSheetProps) {
  const missing = total - done
  const feedbackId = useId()
  const toggleTag = (label: string) =>
    onTagsChange(tags.includes(label) ? tags.filter((tag) => tag !== label) : [...tags, label])

  return (
    <Modal open={open} onClose={onClose} title="Finalizar treino" description="Registre o esforço e deixe um recado para o treinador">
      <div className="space-y-5">
        <dl className="grid grid-cols-3 gap-2">
          {[
            { label: 'Duração', icon: Clock, value: <ElapsedTime startedAt={startedAt} /> },
            { label: 'Séries', icon: Layers, value: `${done}/${total}` },
            { label: 'Volume', icon: Weight, value: `${formatKg(volume)}` },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-line bg-black/30 px-3 py-2.5 text-center">
              <dt className="flex items-center justify-center gap-1 text-xs font-black uppercase tracking-wider text-zinc-500">
                <stat.icon className="h-3 w-3" aria-hidden="true" />
                {stat.label}
              </dt>
              <dd className="mt-0.5 font-display text-2xl font-bold">{stat.value}</dd>
            </div>
          ))}
        </dl>

        {missing > 0 && done > 0 && (
          <Alert variant="info">
            {missing === 1 ? 'Falta 1 série.' : `Faltam ${missing} séries.`} Você pode finalizar mesmo assim.
          </Alert>
        )}

        <fieldset>
          <legend className="mb-3 flex w-full items-end justify-between">
            <span className="text-sm font-bold text-white">Qual foi o esforço (RPE)?</span>
            <span className="text-right">
              <span className="font-display text-3xl font-bold leading-none" style={{ color: rpeColor(rpe) }}>
                {rpe}
              </span>
              <span className="block text-xs font-semibold text-zinc-400">{RPE_LABELS[rpe]}</span>
            </span>
          </legend>
          <div className="grid grid-cols-10 items-end gap-1" role="radiogroup" aria-label="Esforço de 1 a 10">
            {Array.from({ length: 10 }, (_, index) => {
              const value = index + 1
              const selected = value === rpe
              const filled = value <= rpe
              return (
                <m.button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${value}: ${RPE_LABELS[value]}`}
                  onClick={() => onRpeChange(value)}
                  whileTap={{ scale: 0.88 }}
                  animate={{ backgroundColor: filled ? rpeColor(value) : 'rgba(255,255,255,0.06)', y: selected ? -3 : 0 }}
                  className={cn(
                    'flex items-end justify-center rounded-lg pb-1 text-xs font-black',
                    filled ? 'text-black' : 'text-zinc-500',
                  )}
                  style={{ height: `${28 + value * 2.4}px` }}
                >
                  {value}
                </m.button>
              )
            })}
          </div>
          <div className="mt-2 flex justify-between text-xs font-bold uppercase tracking-wider text-zinc-600">
            <span>Leve</span>
            <span>Máximo</span>
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2.5 text-sm font-bold text-white">
            Como foi? <span className="text-xs font-semibold text-zinc-500">(opcional)</span>
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {FEEDBACK_TAGS.map((tag) => {
              const selected = tags.includes(tag.label)
              return (
                <m.button
                  key={tag.label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleTag(tag.label)}
                  whileTap={{ scale: 0.94 }}
                  className={cn(
                    'flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors',
                    selected ? 'border-white bg-white text-black' : 'border-line bg-white/[0.04] text-zinc-300 hover:text-white',
                  )}
                >
                  <span aria-hidden="true">{tag.emoji}</span>
                  {tag.label}
                </m.button>
              )
            })}
          </div>
        </fieldset>

        <div>
          <div className="mb-1.5 flex items-end justify-between gap-2">
            <label htmlFor={feedbackId} className="text-xs font-black uppercase tracking-[0.1em] text-zinc-400">
              Recado para o treinador
            </label>
            <span
              className={cn('text-xs font-bold tabular-nums', feedback.length > FEEDBACK_MAX * 0.9 ? 'text-gold' : 'text-zinc-500')}
              aria-hidden="true"
            >
              {feedback.length}/{FEEDBACK_MAX}
            </span>
          </div>
          <textarea
            id={feedbackId}
            value={feedback}
            maxLength={FEEDBACK_MAX}
            rows={2}
            onChange={(event) => onFeedbackChange(event.target.value)}
            placeholder="Ex.: senti o ombro no supino, mas o resto foi tranquilo."
            className="block max-h-40 w-full resize-none rounded-2xl border border-line-strong bg-black/40 px-3.5 py-3 text-white placeholder:text-zinc-600 [field-sizing:content] focus:border-brand focus:outline-none"
          />
        </div>

        {offline && (
          <p className="flex items-start gap-2 rounded-2xl border border-gold/25 bg-gold-soft px-3.5 py-3 text-xs leading-relaxed text-gold">
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Sem internet agora. O treino fica salvo no aparelho e é enviado sozinho quando a conexão voltar.
          </p>
        )}

        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-14 w-2/5 rounded-2xl border border-line bg-white/[0.04] text-xs font-bold uppercase tracking-wider text-zinc-300"
          >
            Voltar
          </button>
          <m.button
            type="button"
            onClick={onConfirm}
            disabled={finishing}
            whileTap={{ scale: 0.97 }}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black uppercase tracking-[0.16em] text-black disabled:opacity-60"
          >
            {finishing ? <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Salvando" /> : 'Salvar treino'}
          </m.button>
        </div>
      </div>
    </Modal>
  )
}
