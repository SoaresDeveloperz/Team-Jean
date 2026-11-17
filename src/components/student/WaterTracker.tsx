'use client'

import { useState } from 'react'
import { Droplets, Minus, Plus } from 'lucide-react'
import { Tile, Eyebrow } from '@/components/ui/tile'
import { cn } from '@/lib/cn'

// Copos de água do dia: fica só neste aparelho (não vai para o banco) e zera a cada dia.
// shortcut: meta fixa de 8 copos (~2 L), sem ajuste por peso; quando o treinador pedir, ler da ficha do aluno.
const GOAL = 8
const PREFIX = 'tj-agua-'

const today = () => new Date().toLocaleDateString('sv-SE') // aaaa-mm-dd no fuso do aparelho

function readCups(key: string): number {
  try {
    const value = Number(window.localStorage.getItem(key))
    return Number.isInteger(value) && value >= 0 && value <= 30 ? value : 0
  } catch {
    return 0
  }
}

export function WaterTracker() {
  const [key] = useState(() => PREFIX + today())
  const [cups, setCups] = useState(() => readCups(key))

  const change = (delta: number) => {
    const next = Math.min(30, Math.max(0, cups + delta))
    setCups(next)
    try {
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const name = window.localStorage.key(i)
        if (name && name.startsWith(PREFIX) && name !== key) window.localStorage.removeItem(name)
      }
      window.localStorage.setItem(key, String(next))
    } catch {
      // Sem armazenamento: o contador vale só até fechar a tela.
    }
  }

  return (
    <Tile>
      <div className="flex items-center justify-between gap-3">
        <Eyebrow icon={Droplets} className="text-sky-300/90">
          Água de hoje
        </Eyebrow>
        <span className="text-xs font-bold text-zinc-400">meta: {GOAL} copos</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => change(-1)}
          disabled={cups === 0}
          aria-label="Tirar um copo"
          className="grid h-11 w-11 place-items-center rounded-xl border border-line text-zinc-300 hover:bg-white/5 disabled:opacity-30"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <p className="text-center" aria-live="polite">
          <span className="font-display text-4xl font-bold leading-none">{cups}</span>
          <span className="ml-1.5 text-sm font-semibold text-zinc-400">{cups === 1 ? 'copo' : 'copos'}</span>
          {cups >= GOAL && <span className="mt-1 block text-xs font-bold text-brand">Meta batida!</span>}
        </p>
        <button
          type="button"
          onClick={() => change(1)}
          aria-label="Beber mais um copo"
          className="grid h-11 w-11 place-items-center rounded-xl bg-brand text-black active:scale-95"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3 flex gap-1.5" aria-hidden="true">
        {Array.from({ length: GOAL }, (_, index) => (
          <span key={index} className={cn('h-1.5 flex-1 rounded-full', index < cups ? 'bg-sky-300' : 'bg-white/[0.07]')} />
        ))}
      </div>
    </Tile>
  )
}
