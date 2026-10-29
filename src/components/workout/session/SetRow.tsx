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
  rowId: string
  setIndex: number
  // Estáveis (do pai): com o memo, só a linha editada renderiza a cada tecla.
  onChangeSet: (rowId: string, setIndex: number, patch: Partial<SetEntry>) => void
  onToggleSet: (rowId: string, setIndex: number) => void
}

// Uma linha da tabela estilo Hevy: SÉRIE | ANTERIOR | KG | REPS | ✓
export const SetRow = memo(function SetRow({ entry, label, inputIdPrefix, pending, rowId, setIndex, onChangeSet, onToggleSet }: SetRowProps) {
  const onChange = (patch: Partial<SetEntry>) => onChangeSet(rowId, setIndex, patch)
  const onToggle = () => onToggleSet(rowId, setIndex)
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
      role="row"
      className={cn('set-grid items-center rounded-2xl px-2 py-1.5 transition-colors duration-300', entry.completed ? 'bg-brand/10' : 'bg-transparent')}
    >
      <div role="cell" className="flex flex-col items-center leading-none">
        {entry.isPR && entry.completed ? (
          <span className="pr-pop grid h-8 w-8 place-items-center rounded-xl bg-gold text-black" title="Novo recorde pessoal">
            <Trophy className="h-4 w-4" aria-label="Novo recorde" />
          </span>
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
          // RIR em português: quantas repetições sobram "na reserva" (0 = até a falha).
          <span
            className="mt-0.5 text-center text-xs font-semibold leading-tight text-zinc-400"
            title={
              entry.targetRir === 0
                ? 'Vá até não conseguir fazer mais nenhuma repetição'
                : `Pare quando ainda conseguir fazer mais ${entry.targetRir} ${entry.targetRir === 1 ? 'repetição' : 'repetições'}`
            }
          >
            {entry.targetRir === 0 ? 'até a falha' : `${entry.targetRir} na reserva`}
          </span>
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
          className="min-h-11 w-full truncate rounded-lg text-center text-sm font-semibold tabular-nums text-zinc-400 transition enabled:hover:text-zinc-200"
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
          className="h-11 w-full rounded-xl border border-line bg-black/40 text-center text-base font-bold tabular-nums text-white placeholder:text-zinc-500 focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:border-transparent disabled:bg-transparent disabled:text-zinc-200"
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
          className="h-11 w-full rounded-xl border border-line bg-black/40 text-center text-base font-bold tabular-nums text-white placeholder:text-zinc-500 focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:border-transparent disabled:bg-transparent disabled:text-zinc-200"
        />
      </div>

      <div role="cell" className="flex justify-center">
        {/* Anuncia a conclusão sem mudar o nome do botão (os rótulos são usados nos testes). */}
        <span role="status" className="sr-only">
          {entry.completed ? `Série ${entry.setNumber} concluída` : ''}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={entry.completed}
          aria-label={
            entry.completed ? `Desmarcar série ${entry.setNumber}` : `Marcar série ${entry.setNumber} como concluída`
          }
          aria-describedby={pending ? pendingId : undefined}
          className={cn(
            'relative grid h-11 w-11 place-items-center rounded-xl transition-[background-color,color,transform]',
            entry.completed
              ? 'bg-brand text-black shadow-[0_0_18px_rgba(52,211,153,0.35)]'
              : 'bg-white/[0.07] text-zinc-400 hover:text-zinc-200',
          )}
        >
          {/* key: ao marcar, o ✓ remonta e faz o pop (CSS); desmarcar é troca de cor. */}
          <span key={entry.completed ? 'done' : 'todo'} className={entry.completed ? 'check-pop' : undefined}>
            <Check className="h-5 w-5 stroke-[3]" aria-hidden="true" />
          </span>
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
        </button>
        {pending && (
          <span id={pendingId} className="sr-only">
            Salva no aparelho, aguardando internet para enviar
          </span>
        )}
      </div>
    </m.div>
  )
})
