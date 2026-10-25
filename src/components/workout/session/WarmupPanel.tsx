'use client'

import { useId, useSyncExternalStore } from 'react'
import { Flame } from 'lucide-react'
import {
  BARS,
  DEFAULT_BAR,
  barLabel,
  describePlates,
  formatPlateKg,
  isBarWeight,
  platesFor,
  suggestWarmup,
  workingLoadOf,
  type BarWeight,
} from '@/lib/warmup'
import type { SetEntry } from './types'

// Barra escolhida: fica só no aparelho (vale para todos os exercícios).
const BAR_KEY = 'team-jean:warmup-bar'
const listeners = new Set<() => void>()
let memoryBar: BarWeight | null = null

function readBar(): BarWeight {
  try {
    const stored = Number(window.localStorage.getItem(BAR_KEY))
    if (window.localStorage.getItem(BAR_KEY) !== null && isBarWeight(stored)) return stored
  } catch {
    // Sem armazenamento local: usa o que foi escolhido nesta visita.
  }
  return memoryBar ?? DEFAULT_BAR
}

function saveBar(bar: BarWeight) {
  memoryBar = bar
  try {
    window.localStorage.setItem(BAR_KEY, String(bar))
  } catch {
    // Sem armazenamento local: a escolha vale até recarregar.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === BAR_KEY) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

function useBar() {
  return useSyncExternalStore(subscribe, readBar, () => DEFAULT_BAR)
}

type WarmupPanelProps = {
  id: string
  exerciseName: string
  entries: SetEntry[]
}

// Sugestão de aquecimento (40%, 60% e 80% da carga de trabalho) com as anilhas
// de cada lado. Só contas no aparelho: funciona sem internet e não grava nada.
export function WarmupPanel({ id, exerciseName, entries }: WarmupPanelProps) {
  const bar = useBar()
  const radioName = useId()
  const titleId = `${id}-title`
  const working = workingLoadOf(entries)
  if (working === null) return null
  const sets = suggestWarmup(working, bar)
  const workingPlates = platesFor(working, bar)

  return (
    <section id={id} aria-labelledby={titleId} className="rounded-2xl border border-gold/25 bg-gold-soft/40 p-3.5">
      <h3 id={titleId} className="flex items-center gap-1.5 text-sm font-bold text-white">
        <Flame className="h-4 w-4 text-gold" aria-hidden="true" /> Sugestão de aquecimento
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-300">
        Para chegar a {formatPlateKg(working)} kg neste exercício. É só uma sugestão: se o treinador passou outra coisa,
        siga o que ele passou.
      </p>

      <fieldset className="mt-3">
        <legend className="mb-1.5 text-xs font-bold text-zinc-200">Qual barra você vai usar?</legend>
        <div className="grid grid-cols-4 gap-1.5">
          {BARS.map((option) => (
            <label
              key={option}
              className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-line-strong bg-black/30 px-1 text-center text-xs font-bold text-zinc-200 transition hover:text-white has-[:checked]:border-white has-[:checked]:bg-white has-[:checked]:text-black has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand"
            >
              <input
                type="radio"
                name={radioName}
                value={option}
                checked={bar === option}
                onChange={() => saveBar(option)}
                className="sr-only"
              />
              {option === 0 ? 'Sem barra' : `${formatPlateKg(option)} kg`}
            </label>
          ))}
        </div>
      </fieldset>

      {sets.length === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-zinc-300">
          A carga já é leve para aquecer com a {bar === 0 ? 'montagem sem barra' : barLabel(bar).toLowerCase()}. Faça uma série
          leve de 10 a 15 repetições antes de começar.
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5" aria-label={`Séries de aquecimento de ${exerciseName}`}>
          {sets.map((set, index) => (
            <li key={set.percent} className="flex items-start gap-3 rounded-xl bg-black/30 px-3 py-2.5">
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gold/15 text-xs font-black text-gold"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-white">
                  {formatPlateKg(set.load)} kg × {set.reps} repetições
                  <span className="sr-only">, cerca de {set.percent}% da carga de trabalho</span>
                </span>
                <span className="block text-xs text-zinc-300">{sentence(describePlates(set.plates))}</span>
              </span>
              <span className="shrink-0 text-xs font-bold text-zinc-400" aria-hidden="true">
                {set.percent}%
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-2 rounded-xl border border-line bg-black/20 px-3 py-2.5">
        <p className="text-xs font-bold text-zinc-200">Carga de trabalho: {formatPlateKg(working)} kg</p>
        <p className="text-xs text-zinc-300">
          {workingPlates.exact
            ? sentence(describePlates(workingPlates))
            : workingPlates.belowBar
              ? `É menos que a ${barLabel(bar).toLowerCase()}: escolha uma barra mais leve ou "Sem barra".`
              : `Não fecha exato com essas anilhas. Mais perto: ${formatPlateKg(workingPlates.total)} kg, ${describePlates(workingPlates)}.`}
        </p>
      </div>
    </section>
  )
}
