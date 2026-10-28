'use client'

import { useState } from 'react'
import { RefreshCw, Undo2 } from 'lucide-react'
import type { SwapOption } from '@/lib/swap-exercise'
import { cn } from '@/lib/cn'
import { Modal } from '@/components/ui/modal'

type SwapExerciseSheetProps = {
  open: boolean
  onClose: () => void
  // Nome do exercício que o treinador prescreveu.
  originalName: string
  // Já está trocado hoje? Então dá para voltar ao original.
  swapped: boolean
  options: SwapOption[]
  // `pain`: o aluno disse que a troca é por dor (vira o recado "Senti dor" ao finalizar).
  onPick: (option: SwapOption, pain: boolean) => void
  onRestore: () => void
}

// Painel "Trocar exercício": até 3 opções, as do treinador primeiro. A troca vale
// só para hoje e só antes da primeira série do exercício.
export function SwapExerciseSheet({ open, onClose, originalName, swapped, options, onPick, onRestore }: SwapExerciseSheetProps) {
  const [pain, setPain] = useState(false)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Trocar ${originalName}`}
      description="A troca vale só para hoje. O Jean vê no histórico o que você fez no lugar. Se sentir dor forte, pare e fale com ele."
    >
      <div className="space-y-4">
        <ul className="space-y-1.5" aria-label={`Opções no lugar de ${originalName}`}>
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => onPick(option, pain)}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-white/[0.03] px-3.5 py-2 text-left transition-colors hover:bg-white/5"
              >
                <RefreshCw className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white [overflow-wrap:anywhere]">{option.name}</span>
                  <span className="block text-xs text-zinc-300">
                    {option.source === 'jean' ? 'Indicado pelo Jean' : 'Sugestão do app'}
                    {option.muscle_group ? ` · ${option.muscle_group}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {options.length === 0 && <li className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-zinc-200">Sem outras opções para este exercício.</li>}
        </ul>

        <label
          className={cn(
            'flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-2 transition-colors',
            pain ? 'border-gold/40 bg-gold-soft' : 'border-line bg-white/[0.03]',
          )}
        >
          <input type="checkbox" checked={pain} onChange={(event) => setPain(event.target.checked)} className="h-5 w-5 shrink-0 accent-[#fbbf24]" />
          <span className="min-w-0 flex-1 text-sm font-semibold text-white">
            Estou trocando por causa de dor
            <span className="block text-xs font-normal text-zinc-300">O Jean recebe um aviso no seu recado ao finalizar o treino.</span>
          </span>
        </label>

        <div className="flex flex-col gap-2">
          {swapped && (
            <button
              type="button"
              onClick={onRestore}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line-strong text-sm font-bold text-zinc-200 hover:bg-white/5"
            >
              <Undo2 className="h-4 w-4" aria-hidden="true" /> Voltar para {originalName}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-full items-center justify-center rounded-2xl border border-line-strong text-sm font-bold text-zinc-200 hover:bg-white/5"
          >
            Manter como está
          </button>
        </div>
      </div>
    </Modal>
  )
}
