'use client'

import { useId, useMemo, useState } from 'react'
import { Hourglass } from 'lucide-react'
import { SHORT_SET_CAP, planShort, shortMinutes, visibleSetCount, type ShortRow } from '@/lib/short-workout'
import { plural } from '@/lib/text'
import { cn } from '@/lib/cn'
import { Modal } from '@/components/ui/modal'

type ShortWorkoutSheetProps = {
  open: boolean
  onClose: () => void
  rows: ShortRow[]
  // Recebe os exercícios que ficam de fora hoje.
  onConfirm: (hidden: string[]) => void
}

// Painel "Tenho pouco tempo": mostra o que sai da versão de hoje, deixa o aluno
// manter qualquer exercício e promete só uma estimativa ("cerca de N min").
export function ShortWorkoutSheet({ open, onClose, rows, onConfirm }: ShortWorkoutSheetProps) {
  const groupId = useId()
  const initialKept = useMemo(() => new Set(planShort(rows).keep), [rows])
  const [kept, setKept] = useState<Set<string>>(initialKept)

  const hidden = useMemo(() => new Set(rows.filter((row) => !kept.has(row.id)).map((row) => row.id)), [rows, kept])
  const leaving = rows.filter((row) => hidden.has(row.id))
  const keptRows = rows.filter((row) => kept.has(row.id))
  const minutes = shortMinutes(rows, hidden)
  const setsToDo = keptRows.reduce((sum, row) => sum + visibleSetCount(row.sets, SHORT_SET_CAP), 0)
  const nothingLeaves = leaving.length === 0 && rows.every((row) => visibleSetCount(row.sets, SHORT_SET_CAP) === row.sets.length)
  const noneKept = keptRows.length === 0

  const toggle = (id: string) =>
    setKept((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Versão de cerca de ${minutes} min só para hoje`}
      description="Seu treino com o Jean continua o mesmo, e o Jean vê que hoje foi a versão curta. Se sentir dor, pare e fale com ele."
    >
      <div className="space-y-4">
        <fieldset aria-labelledby={groupId}>
          <legend id={groupId} className="mb-2 text-sm font-bold text-zinc-300">
            Exercícios de hoje: marque o que você vai fazer
          </legend>
          <ul className="space-y-1.5">
            {rows.map((row) => {
              const checked = kept.has(row.id)
              const shown = visibleSetCount(row.sets, SHORT_SET_CAP)
              return (
                <li key={row.id}>
                  <label
                    className={cn(
                      'flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-2 transition-colors',
                      checked ? 'border-brand/30 bg-brand-soft' : 'border-line bg-white/[0.03]',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(row.id)}
                      className="h-5 w-5 shrink-0 accent-[#34d399]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-white [overflow-wrap:anywhere]">{row.name}</span>
                      <span className="block text-xs text-zinc-300">
                        {checked ? `${plural(shown, 'série', 'séries')} hoje` : 'Fica de fora hoje'}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </fieldset>

        <p role="status" className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-zinc-200">
          {noneKept
            ? 'Escolha pelo menos um exercício.'
            : nothingLeaves
              ? 'Do jeito que está, nada sai do treino de hoje.'
              : `${plural(keptRows.length, 'exercício', 'exercícios')} e ${plural(setsToDo, 'série', 'séries')}, cerca de ${minutes} min. ${
                  leaving.length > 0 ? `Sai hoje: ${leaving.map((row) => row.name).join(', ')}.` : ''
                }`}
        </p>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={noneKept || nothingLeaves}
            onClick={() => onConfirm([...hidden])}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-base font-bold text-black transition hover:bg-zinc-200 disabled:opacity-40"
          >
            <Hourglass className="h-5 w-5" aria-hidden="true" /> Fazer versão curta
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-full items-center justify-center rounded-2xl border border-line-strong text-sm font-bold text-zinc-200 hover:bg-white/5"
          >
            Fazer o treino completo
          </button>
        </div>
      </div>
    </Modal>
  )
}
