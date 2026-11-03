'use client'

import { useState } from 'react'
import { Check, Hourglass, RefreshCw } from 'lucide-react'
import { Eyebrow, Tile } from '@/components/ui/tile'

// Uma chave por aluno: num aparelho emprestado, quem chega depois ainda vê as dicas.
const storageKey = (userId: string | null) => `team-jean:dicas-primeiro-treino:${userId ?? ''}`

function alreadySeen(userId: string | null) {
  try {
    return window.localStorage.getItem(storageKey(userId)) === '1'
  } catch {
    return false
  }
}

// Três dicas para quem ainda não fez nenhum treino. Um cartão simples (sem tela
// por cima) que o aluno dispensa uma vez; some também quando ele termina o primeiro treino.
export function FirstTimeTips({ userId }: { userId: string | null }) {
  const [hidden, setHidden] = useState(() => alreadySeen(userId))
  if (hidden) return null

  const dismiss = () => {
    setHidden(true)
    try {
      window.localStorage.setItem(storageKey(userId), '1')
    } catch {
      // Sem armazenamento: o cartão só volta na próxima visita.
    }
  }

  const tips = [
    { icon: Check, title: 'Marque cada série', text: 'Toque no ✓ ao terminar a série. O app guarda a carga, e você vê a do último treino na coluna "Anterior".' },
    { icon: Hourglass, title: 'Sem tempo?', text: 'Quando o treino é longo, aparece o botão "Tenho pouco tempo" na tela Hoje: ele monta uma versão mais curta só para hoje.' },
    { icon: RefreshCw, title: 'Aparelho ocupado?', text: 'Antes da primeira série, toque em "Trocar" ao lado do exercício (aparece quando há opção). O Jean vê o que você fez no lugar.' },
  ]

  return (
    <Tile className="page-in">
      <Eyebrow>Primeira vez por aqui?</Eyebrow>
      <ul className="mt-3 space-y-3">
        {tips.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 text-sm text-zinc-300">
              <span className="block font-bold text-white">{title}</span>
              {text}
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={dismiss}
        className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl border border-line-strong text-sm font-bold text-zinc-200 hover:bg-white/5"
      >
        Entendi
      </button>
    </Tile>
  )
}
