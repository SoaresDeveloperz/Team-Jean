'use client'

import { memo } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Plus, Star, Trash2, X } from 'lucide-react'
import type { PlannedSet } from '@/lib/types'
import { PREP_SET_TYPES, REP_PRESETS, SET_TYPES, getSetTypeInfo } from '@/lib/workouts'
import { cn } from '@/lib/cn'
import { SWAP_MAX_ALTERNATIVES } from '@/lib/swap-exercise'

export type BuilderSet = PlannedSet & { key: string }

export type BuilderExercise = {
  key: string
  rowId: string | null
  exercise_id: string
  name: string
  muscle_group: string
  secondary: string | null
  notes: string
  planned_sets: BuilderSet[]
  // Marca "Essencial" e alternativas de troca (supabase/trocar-exercicio.sql).
  essential: boolean
  alternatives: string[]
}

type BuilderExerciseCardProps = {
  item: BuilderExercise
  index: number
  onChange: (key: string, update: (item: BuilderExercise) => BuilderExercise) => void
  onRemove: (key: string) => void
  createKey: () => string
  // Só com o trocar-exercicio.sql rodado: mostra "Essencial" e "Alternativas".
  swapEnabled?: boolean
  // id → nome, para mostrar as alternativas escolhidas.
  exerciseNames?: ReadonlyMap<string, string>
  onPickAlternatives?: (key: string) => void
}

// Aquecimento e feeder não recebem os atalhos de repetições das séries válidas.
const PREP_TYPES = PREP_SET_TYPES

const cellInputClassName =
  'h-11 w-full rounded-xl border border-line bg-black/40 text-center font-bold tabular-nums text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none'

export const BuilderExerciseCard = memo(function BuilderExerciseCard({
  item,
  index,
  onChange,
  onRemove,
  createKey,
  swapEnabled = false,
  exerciseNames,
  onPickAlternatives,
}: BuilderExerciseCardProps) {
  const headingId = `builder-exercise-${item.key}`
  const update = (fn: (current: BuilderExercise) => BuilderExercise) => onChange(item.key, fn)

  const updateSet = (setKey: string, patch: Partial<PlannedSet>) =>
    update((current) => ({
      ...current,
      planned_sets: current.planned_sets.map((set) => (set.key === setKey ? { ...set, ...patch } : set)),
    }))

  const removeSet = (setKey: string) =>
    update((current) => ({ ...current, planned_sets: current.planned_sets.filter((set) => set.key !== setKey) }))

  // Nova série copia a última válida (como no Hevy), em vez de um padrão fixo.
  const addSet = () => {
    const key = createKey()
    update((current) => {
      const last = current.planned_sets[current.planned_sets.length - 1]
      const copy = last && !PREP_TYPES.has(last.type) ? last : null
      return {
        ...current,
        planned_sets: [
          ...current.planned_sets,
          { key, type: copy?.type ?? 'working', reps: copy?.reps ?? '8-12', rir: copy?.rir ?? 1, weight: copy?.weight ?? '' },
        ],
      }
    })
  }

  const workSets = item.planned_sets.filter((set) => !PREP_TYPES.has(set.type))
  const presetTargets = workSets.length > 0 ? workSets : item.planned_sets
  const activePreset =
    presetTargets.length > 0 && presetTargets.every((set) => set.reps === presetTargets[0].reps) ? presetTargets[0].reps : null

  const applyReps = (reps: string) =>
    update((current) => {
      const hasWork = current.planned_sets.some((set) => !PREP_TYPES.has(set.type))
      return {
        ...current,
        planned_sets: current.planned_sets.map((set) => (!hasWork || !PREP_TYPES.has(set.type) ? { ...set, reps } : set)),
      }
    })

  const labels: string[] = []
  let workingNumber = 0
  for (const set of item.planned_sets) {
    if (set.type === 'working') {
      workingNumber += 1
      labels.push(String(workingNumber))
    } else {
      labels.push(getSetTypeInfo(set.type).letter)
    }
  }

  return (
    <article aria-labelledby={headingId} className="overflow-hidden rounded-3xl border border-line bg-surface">
      <header className="flex items-start gap-3 p-4 pb-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[0.06] font-display text-xl font-bold text-white"
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h4 id={headingId} className="truncate text-sm font-bold text-white">
            <span className="sr-only">{index + 1}. </span>
            {item.name}
          </h4>
          <p className="text-xs font-black uppercase tracking-[0.1em] text-brand">{item.muscle_group}</p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(item.key)}
          aria-label={`Remover ${item.name}`}
          className="-mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zinc-500 transition hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="px-4">
        <textarea
          value={item.notes}
          onChange={(event) => update((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Observação para o aluno (opcional)"
          aria-label={`Observações de ${item.name}`}
          rows={1}
          className="block max-h-40 w-full resize-none rounded-xl border border-line bg-black/30 px-3 py-2.5 text-zinc-200 placeholder:text-zinc-600 [field-sizing:content] focus:border-brand focus:outline-none"
        />
      </div>

      {swapEnabled && (
        <div className="mt-3 space-y-2 px-4">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-black/20 px-3 py-1.5">
            <input
              type="checkbox"
              checked={item.essential}
              onChange={(event) => update((current) => ({ ...current, essential: event.target.checked }))}
              className="h-5 w-5 shrink-0 accent-[#fbbf24]"
            />
            <span className="min-w-0 flex-1 text-xs text-zinc-300">
              <span className="flex items-center gap-1 text-sm font-bold text-white">
                <Star className="h-3.5 w-3.5 text-gold" aria-hidden="true" /> Essencial
              </span>
              Fica na versão curta e só troca por alternativa sua
              {item.essential && item.alternatives.length === 0 && (
                <span className="mt-0.5 block font-semibold text-gold">Sem alternativa, o aluno não poderá trocar este exercício.</span>
              )}
            </span>
          </label>
          <div className="rounded-xl border border-line bg-black/20 px-3 py-2">
            <p className="text-xs font-bold text-zinc-300">Alternativas se o aluno precisar trocar (até {SWAP_MAX_ALTERNATIVES})</p>
            {item.alternatives.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Alternativas de ${item.name}`}>
                {item.alternatives.map((id) => {
                  const name = exerciseNames?.get(id) ?? 'Exercício removido'
                  return (
                    <li key={id} className="flex items-center gap-1 rounded-full bg-white/[0.08] py-0.5 pl-3 pr-1 text-xs font-semibold text-white">
                      {name}
                      <button
                        type="button"
                        onClick={() => update((current) => ({ ...current, alternatives: current.alternatives.filter((other) => other !== id) }))}
                        aria-label={`Tirar ${name} das alternativas`}
                        className="-my-1.5 grid h-11 w-11 place-items-center rounded-full text-zinc-300 hover:bg-white/10 hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {item.alternatives.length < SWAP_MAX_ALTERNATIVES && (
              <button
                type="button"
                onClick={() => onPickAlternatives?.(item.key)}
                className="mt-2 flex h-11 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-xs font-bold text-zinc-200 hover:bg-white/10"
              >
                <Plus className="h-4 w-4" aria-hidden="true" /> Alternativa<span className="sr-only"> para {item.name}</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div role="table" aria-label={`Séries de ${item.name}`} className="px-2 pt-3">
        <div role="rowgroup">
          <div
            role="row"
            className="grid grid-cols-[3rem_minmax(0,1fr)_4rem_3.5rem_2.5rem] gap-2 px-2 pb-1 text-xs font-black uppercase tracking-[0.1em] text-zinc-500"
          >
            <span role="columnheader" className="text-center">
              Série
            </span>
            <span role="columnheader" className="text-center">
              Repetições
            </span>
            <span role="columnheader" className="text-center">
              Kg
            </span>
            <span role="columnheader" className="text-center">
              RIR
            </span>
            <span role="columnheader">
              <span className="sr-only">Remover</span>
            </span>
          </div>
        </div>
        <div role="rowgroup">
          <AnimatePresence initial={false}>
            {item.planned_sets.map((set, setIndex) => {
              const typeInfo = getSetTypeInfo(set.type)
              const number = setIndex + 1
              return (
                <m.div
                  key={set.key}
                  role="row"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-[3rem_minmax(0,1fr)_4rem_3.5rem_2.5rem] items-center gap-2 px-2 py-1">
                    <div role="cell" className="flex justify-center">
                      {/* Selo visível com a letra do tipo; o select nativo transparente por cima faz a escolha. */}
                      <span
                        className={cn(
                          'relative grid h-11 w-11 place-items-center rounded-xl font-display text-lg font-bold focus-within:ring-2 focus-within:ring-brand',
                          set.type === 'working' ? 'bg-white/[0.06] text-white' : cn('border', typeInfo.className),
                        )}
                      >
                        <span aria-hidden="true">{labels[setIndex]}</span>
                        <select
                          value={set.type}
                          onChange={(event) => updateSet(set.key, { type: event.target.value })}
                          aria-label={`Tipo da série ${number}`}
                          className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
                        >
                          {SET_TYPES.map((setType) => (
                            <option key={setType.value} value={setType.value}>
                              {setType.label}
                            </option>
                          ))}
                        </select>
                      </span>
                    </div>
                    <div role="cell">
                      <input
                        type="text"
                        value={set.reps ?? ''}
                        onChange={(event) => updateSet(set.key, { reps: event.target.value })}
                        placeholder="8-12"
                        enterKeyHint="next"
                        aria-label={`Repetições da série ${number}`}
                        className={cellInputClassName}
                      />
                    </div>
                    <div role="cell">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={set.weight ?? ''}
                        onChange={(event) => updateSet(set.key, { weight: event.target.value })}
                        placeholder="—"
                        aria-label={`Carga-alvo da série ${number} em kg (opcional)`}
                        className={cellInputClassName}
                      />
                    </div>
                    <div role="cell">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={set.rir ?? ''}
                        onChange={(event) => updateSet(set.key, { rir: event.target.value })}
                        placeholder="—"
                        aria-label={`RIR da série ${number}`}
                        className={cellInputClassName}
                      />
                    </div>
                    <div role="cell" className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => removeSet(set.key)}
                        aria-label={`Remover série ${number}`}
                        className="grid h-9 w-9 place-items-center rounded-xl text-zinc-600 transition hover:bg-white/5 hover:text-danger"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </m.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {item.planned_sets.length === 0 && (
        <p className="px-4 pb-1 pt-2 text-center text-xs font-semibold text-danger">Adicione pelo menos 1 série.</p>
      )}

      <div className="mt-2 space-y-2.5 border-t border-line p-3">
        <m.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={addSet}
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] text-xs font-bold text-zinc-200 transition hover:bg-white/10"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>
            <span className="sr-only">Adicionar </span>Série
          </span>
        </m.button>
        <div role="group" aria-label={`Repetições nas séries válidas de ${item.name}`} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="shrink-0 text-xs font-black uppercase tracking-[0.1em] text-zinc-500">
            Reps
          </span>
          <div className="no-scrollbar -mr-3 flex gap-1.5 overflow-x-auto pr-6 [mask-image:linear-gradient(to_right,black_82%,transparent)]">
            {REP_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={activePreset === preset}
                onClick={() => applyReps(preset)}
                className={cn(
                  'h-8 shrink-0 rounded-lg border px-2.5 text-xs font-bold tabular-nums transition',
                  activePreset === preset
                    ? 'border-brand/50 bg-brand-soft text-brand'
                    : 'border-line text-zinc-400 hover:border-line-strong hover:text-white',
                )}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>
    </article>
  )
})
