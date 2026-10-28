'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Search } from 'lucide-react'
import type { Exercise } from '@/lib/types'
import { MUSCLE_GROUPS } from '@/lib/workouts'
import { cn } from '@/lib/cn'
import { Modal, SheetFooter } from '@/components/ui/modal'

type ExercisePickerProps = {
  open: boolean
  onClose: () => void
  library: Exercise[]
  // Exercícios que já estão no treino ganham uma etiqueta (repetir é permitido).
  inWorkout: ReadonlySet<string>
  onAdd: (exercises: Exercise[]) => void
  title?: string
  description?: string
  confirmLabel?: string
  // Quantos podem ser marcados de uma vez (sem limite se omitido).
  max?: number
}

const ALL = 'Todos'

const normalizeText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

// Seleção múltipla no estilo Hevy: marca vários e adiciona todos de uma vez,
// na ordem em que foram tocados.
export function ExercisePicker({ open, onClose, library, inWorkout, onAdd, title = 'Adicionar exercício', description = 'Toque para marcar um ou mais exercícios.', confirmLabel = 'Adicionar', max }: ExercisePickerProps) {
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState(ALL)
  const [picked, setPicked] = useState<string[]>([])

  const groups = useMemo(() => {
    const present = new Set<string>()
    for (const exercise of library) {
      const name = exercise.muscle_group?.trim()
      if (name) present.add(name)
    }
    const known = MUSCLE_GROUPS.filter((name) => present.has(name))
    const others = [...present].filter((name) => !MUSCLE_GROUPS.includes(name)).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    return [ALL, ...known, ...others]
  }, [library])

  const term = normalizeText(search.trim())
  const filtered = library.filter((exercise) => {
    if (group !== ALL && (exercise.muscle_group ?? '').trim() !== group) return false
    return !term || normalizeText(`${exercise.name ?? ''} ${exercise.muscle_group ?? ''}`).includes(term)
  })

  const reset = () => {
    setSearch('')
    setGroup(ALL)
    setPicked([])
  }

  const close = () => {
    reset()
    onClose()
  }

  const toggle = (id: string) =>
    setPicked((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id)
      return max !== undefined && current.length >= max ? current : [...current, id]
    })

  const addPicked = () => {
    const byId = new Map(library.map((exercise) => [exercise.id, exercise]))
    onAdd(picked.map((id) => byId.get(id)).filter((exercise): exercise is Exercise => Boolean(exercise)))
    reset()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      variant="sheet"
      title={title}
      description={description}
    >
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou músculo..."
            aria-label="Buscar exercício"
            className="h-12 w-full rounded-2xl border border-line-strong bg-black/40 pl-11 pr-4 text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none"
          />
        </div>

        {groups.length > 2 && (
          <div role="radiogroup" aria-label="Filtrar por grupo muscular" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {groups.map((name) => (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={group === name}
                onClick={() => setGroup(name)}
                className={cn(
                  'h-9 shrink-0 rounded-full border px-3.5 text-xs font-bold transition',
                  group === name ? 'border-white bg-white text-black' : 'border-line bg-surface text-zinc-400 hover:text-white',
                )}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        <ul className="space-y-1.5" aria-label="Biblioteca de exercícios">
          {filtered.map((exercise) => {
            const order = picked.indexOf(exercise.id)
            const selected = order >= 0
            return (
              <li key={exercise.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggle(exercise.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
                    selected ? 'border-brand/50 bg-brand-soft' : 'border-line bg-surface hover:border-line-strong',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-white">{exercise.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
                      {exercise.muscle_group || 'Geral'}
                      {inWorkout.has(exercise.id) && (
                        <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-xs normal-case tracking-normal text-zinc-300">
                          No treino
                        </span>
                      )}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 font-display text-sm font-bold transition-colors',
                      selected ? 'border-brand bg-brand text-black' : 'border-line-strong',
                    )}
                  >
                    <AnimatePresence initial={false}>
                      {selected && (
                        <m.span key="order" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                          {order + 1}
                        </m.span>
                      )}
                    </AnimatePresence>
                  </span>
                </button>
              </li>
            )
          })}
          {filtered.length === 0 && <li className="py-8 text-center text-xs text-zinc-500">Nenhum exercício encontrado.</li>}
        </ul>

        <SheetFooter>
          <m.button
            type="button"
            onClick={addPicked}
            disabled={picked.length === 0}
            whileTap={{ scale: 0.98 }}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-white text-sm font-black uppercase tracking-[0.14em] text-black transition-colors disabled:bg-surface-3 disabled:text-zinc-500"
          >
            {picked.length === 0 ? 'Selecione exercícios' : `${confirmLabel} (${picked.length})`}
          </m.button>
        </SheetFooter>
      </div>
    </Modal>
  )
}
