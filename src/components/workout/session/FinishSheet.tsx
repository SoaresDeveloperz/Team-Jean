'use client'

import { m } from 'framer-motion'
import { Clock, Layers, LoaderCircle, Weight } from 'lucide-react'
import { formatKg } from '@/lib/workouts'
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
  finishing,
  error,
  onConfirm,
}: FinishSheetProps) {
  const missing = total - done

  return (
    <Modal open={open} onClose={onClose} title="Finalizar treino" description="Registre o esforço da sessão">
      <div className="space-y-5">
        <dl className="grid grid-cols-3 gap-2">
          {[
            { label: 'Duração', icon: Clock, value: <ElapsedTime startedAt={startedAt} /> },
            { label: 'Séries', icon: Layers, value: `${done}/${total}` },
            { label: 'Volume', icon: Weight, value: `${formatKg(volume)}` },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-line bg-black/30 px-3 py-2.5 text-center">
              <dt className="flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider text-zinc-500">
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
              <span className="block text-[10px] font-semibold text-zinc-400">{RPE_LABELS[rpe]}</span>
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
                    'flex items-end justify-center rounded-lg pb-1 text-[11px] font-black',
                    filled ? 'text-black' : 'text-zinc-500',
                  )}
                  style={{ height: `${28 + value * 2.4}px` }}
                >
                  {value}
                </m.button>
              )
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-600">
            <span>Leve</span>
            <span>Máximo</span>
          </div>
        </fieldset>

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
