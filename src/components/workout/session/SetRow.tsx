'use client'

import { memo, useId, useRef } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Check, CloudUpload, Trophy } from 'lucide-react'
import { formatKg, getSetTypeInfo } from '@/lib/workouts'
import { cn } from '@/lib/cn'
import type { SetEntry } from './types'

type SetRowProps = {
  entry: SetEntry
  label: string
  inputIdPrefix: string
  // Marcada no aparelho, ainda não chegou ao servidor (sem internet).
  pending: boolean
  onChange: (patch: Partial<SetEntry>) => void
  onToggle: () => void
}

// Uma linha da tabela estilo Hevy: SÉRIE | ANTERIOR | KG | REPS | ✓
export const SetRow = memo(function SetRow({ entry, label, inputIdPrefix, pending, onChange, onToggle }: SetRowProps) {
  const repsRef = useRef<HTMLInputElement>(null)
  const pendingId = useId()
  const typeInfo = getSetTypeInfo(entry.type)
  const locked = entry.completed
  const isWorking = entry.type === 'working'
  // Sugestão no campo de carga: a meta do treinador, senão o último treino.
  const weightHint = entry.targetWeight ?? entry.previous?.weight ?? null

  return (
    <m.div
      layout="position"
      animate={{ backgroundColor: entry.completed ? 'rgba(52, 211, 153, 0.10)' : 'rgba(0, 0, 0, 0)' }}
      transition={{ duration: 0.25 }}
      role="row"
      className="grid grid-cols-[2.6rem_minmax(0,1fr)_4.4rem_4.4rem_2.9rem] items-center gap-2 rounded-2xl px-2 py-1.5"
    >
      <div role="cell" className="flex flex-col items-center leading-none">
        {entry.isPR && entry.completed ? (
          <m.span
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 14 }}
            className="grid h-8 w-8 place-items-center rounded-xl bg-gold text-black"
            title="Novo recorde pessoal"
          >
            <Trophy className="h-4 w-4" aria-label="Novo recorde" />
          </m.span>
        ) : (
          <span
            className={cn(
              'grid h-8 w-8 place-items-center rounded-xl font-display text-lg font-bold',
              isWorking ? 'bg-white/[0.06] text-white' : cn('border', typeInfo.className),
            )}
            title={typeInfo.badge}
          >
            <span aria-hidden="true">{label}</span>
            <span className="sr-only">
              Série {entry.setNumber}, {typeInfo.badge}
            </span>
          </span>
        )}
        {entry.targetRir !== null && (
          <span className="mt-0.5 text-[9px] font-bold text-zinc-500">RIR {entry.targetRir}</span>
        )}
      </div>

      <div role="cell" className="min-w-0">
        <button
          type="button"
          disabled={locked || !entry.previous}
          onClick={() =>
            entry.previous &&
            onChange({ weight: formatKg(entry.previous.weight).replace('.', ''), reps: String(entry.previous.reps) })
          }
          className="w-full truncate rounded-lg py-2 text-center text-xs font-semibold tabular-nums text-zinc-500 transition enabled:hover:text-zinc-200"
          title={entry.previous ? 'Usar os valores do último treino' : undefined}
        >
          {entry.previous ? (
            <>
              <span className="sr-only">Usar último treino: </span>
              {formatKg(entry.previous.weight)}×{entry.previous.reps}
            </>
          ) : (
            <>
              <span aria-hidden="true">—</span>
              <span className="sr-only">Sem registro anterior</span>
            </>
          )}
        </button>
      </div>

      <div role="cell">
        <input
          id={`${inputIdPrefix}-weight`}
          type="text"
          inputMode="decimal"
          enterKeyHint="next"
          autoComplete="off"
          value={entry.weight}
          disabled={locked}
          onChange={(event) => onChange({ weight: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              repsRef.current?.focus()
            }
          }}
          placeholder={weightHint !== null ? formatKg(weightHint) : 'kg'}
          aria-label={`Carga da série ${entry.setNumber} em kg${entry.targetWeight !== null ? `, meta ${formatKg(entry.targetWeight)} kg` : ''}`}
          className="h-11 w-full rounded-xl border border-line bg-black/40 text-center text-base font-bold tabular-nums text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none disabled:border-transparent disabled:bg-transparent disabled:text-zinc-200"
        />
      </div>
      <div role="cell">
        <input
          ref={repsRef}
          id={`${inputIdPrefix}-reps`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          enterKeyHint="done"
          autoComplete="off"
          value={entry.reps}
          disabled={locked}
          onChange={(event) => onChange({ reps: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
              onToggle()
            }
          }}
          placeholder={entry.previous ? String(entry.previous.reps) : entry.targetReps}
          aria-label={`Repetições da série ${entry.setNumber}, meta ${entry.targetReps}`}
          className="h-11 w-full rounded-xl border border-line bg-black/40 text-center text-base font-bold tabular-nums text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none disabled:border-transparent disabled:bg-transparent disabled:text-zinc-200"
        />
      </div>

      <div role="cell" className="flex justify-center">
        <m.button
          type="button"
          onClick={onToggle}
          whileTap={{ scale: 0.86 }}
          aria-pressed={entry.completed}
          aria-label={
            entry.completed ? `Desmarcar série ${entry.setNumber}` : `Marcar série ${entry.setNumber} como concluída`
          }
          aria-describedby={pending ? pendingId : undefined}
          className={cn(
            'relative grid h-11 w-11 place-items-center rounded-xl transition-colors',
            entry.completed
              ? 'bg-brand text-black shadow-[0_0_18px_rgba(52,211,153,0.35)]'
              : 'bg-white/[0.07] text-zinc-500 hover:text-zinc-300',
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <m.span
              key={entry.completed ? 'done' : 'todo'}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 520, damping: 18 }}
            >
              <Check className="h-5 w-5 stroke-[3]" aria-hidden="true" />
            </m.span>
          </AnimatePresence>
          <AnimatePresence>
            {pending && (
              <m.span
                key="pending"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-gold text-black ring-2 ring-surface"
                aria-hidden="true"
              >
                <CloudUpload className="h-2.5 w-2.5" />
              </m.span>
            )}
          </AnimatePresence>
        </m.button>
        {pending && (
          <span id={pendingId} className="sr-only">
            Salva no aparelho, aguardando internet para enviar
          </span>
        )}
      </div>
    </m.div>
  )
})
