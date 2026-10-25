'use client'

import { memo, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { ChevronDown, Flame, Info, Minus, Plus, Target, Trophy, Video } from 'lucide-react'
import { SET_TYPES, formatKg } from '@/lib/workouts'
import { cn } from '@/lib/cn'
import { canSuggestWarmup } from '@/lib/warmup'
import { ExerciseMedia, getExerciseMedia } from '@/components/workout/ExerciseMedia'
import { SetRow } from './SetRow'
import { WarmupPanel } from './WarmupPanel'
import type { ExerciseRow, PreviousSet, SetEntry } from './types'

type ExerciseBlockProps = {
  row: ExerciseRow
  index: number
  entries: SetEntry[]
  record: PreviousSet | undefined
  // Séries marcadas que ainda não chegaram ao servidor.
  pendingIds: ReadonlySet<string>
  onChangeSet: (rowId: string, setIndex: number, patch: Partial<SetEntry>) => void
  onToggleSet: (rowId: string, setIndex: number) => void
  onAddSet: (rowId: string) => void
  onRemoveExtra: (rowId: string) => void
}

export const ExerciseBlock = memo(function ExerciseBlock({
  row,
  index,
  entries,
  record,
  pendingIds,
  onChangeSet,
  onToggleSet,
  onAddSet,
  onRemoveExtra,
}: ExerciseBlockProps) {
  const [showMedia, setShowMedia] = useState(false)
  const [showWarmup, setShowWarmup] = useState(false)
  const reduceMotion = useReducedMotion()
  // Aquecimento sugerido: só sem aquecimento prescrito e com carga (WarmupPanel).
  const warmupAvailable = canSuggestWarmup(entries)
  const exercise = row.exercises
  const hasMedia = Boolean(getExerciseMedia(exercise?.video_url) ?? getExerciseMedia(exercise?.image_url))
  const done = entries.filter((entry) => entry.completed).length
  const allDone = entries.length > 0 && done === entries.length
  const usedTypes = SET_TYPES.filter((type) => type.value !== 'working' && entries.some((entry) => entry.type === type.value))
  const lastExtra = entries[entries.length - 1]
  const canRemoveExtra = lastExtra?.extra && !lastExtra.completed
  // Carga-alvo única para as séries com meta (mostrada no cabeçalho).
  const targets = [...new Set(entries.flatMap((entry) => (entry.targetWeight !== null ? [entry.targetWeight] : [])))]

  let workingCount = 0
  const labels = entries.map((entry) => {
    if (entry.type === 'working') return String(++workingCount)
    return SET_TYPES.find((type) => type.value === entry.type)?.letter ?? String(entry.setNumber)
  })

  return (
    <section
      id={`exercise-${row.id}`}
      aria-label={exercise?.name ?? 'Exercício'}
      className={cn(
        'scroll-mt-44 overflow-hidden rounded-3xl border bg-surface transition-colors',
        allDone ? 'border-brand/30' : 'border-line',
      )}
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <span
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-xl font-bold transition-colors',
            allDone ? 'bg-brand text-black' : 'bg-white/[0.06] text-zinc-300',
          )}
          aria-hidden="true"
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold leading-tight text-white">{exercise?.name ?? 'Exercício'}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
            <span className="font-semibold uppercase tracking-wider">{exercise?.muscle_group || 'Geral'}</span>
            <span aria-hidden="true">·</span>
            <span>
              {done}/{entries.length} séries
            </span>
            {targets.length > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 font-bold text-brand">
                <Target className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">Carga-alvo:</span>
                {targets.length === 1 ? `${formatKg(targets[0])} kg` : `${formatKg(Math.min(...targets))}–${formatKg(Math.max(...targets))} kg`}
              </span>
            )}
            {record && record.weight > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 font-bold text-gold">
                <Trophy className="h-3 w-3" aria-hidden="true" /> {formatKg(record.weight)}kg × {record.reps}
              </span>
            )}
          </p>
        </div>
        {hasMedia && (
          <button
            type="button"
            onClick={() => setShowMedia((value) => !value)}
            aria-expanded={showMedia}
            aria-label={showMedia ? 'Esconder execução' : 'Ver execução do exercício'}
            className={cn(
              'flex h-10 shrink-0 items-center gap-1 rounded-xl px-2.5 text-[11px] font-bold transition',
              showMedia ? 'bg-white text-black' : 'bg-white/[0.06] text-zinc-300 hover:text-white',
            )}
          >
            <Video className="h-4 w-4" aria-hidden="true" />
            <m.span animate={{ rotate: showMedia ? 180 : 0 }}>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </m.span>
          </button>
        )}
        {warmupAvailable && (
          <button
            type="button"
            onClick={() => setShowWarmup((value) => !value)}
            aria-expanded={showWarmup}
            aria-controls={showWarmup ? `warmup-${row.id}` : undefined}
            className={cn(
              'flex h-11 shrink-0 items-center gap-1 rounded-xl px-3 text-xs font-bold transition',
              showWarmup ? 'bg-gold text-black' : 'bg-gold-soft text-gold hover:text-white',
            )}
          >
            <Flame className="h-4 w-4" aria-hidden="true" /> Aquecer
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {warmupAvailable && showWarmup && (
          <m.div
            key="warmup"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              <WarmupPanel id={`warmup-${row.id}`} exerciseName={exercise?.name ?? 'exercício'} entries={entries} />
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showMedia && (
          <m.div
            key="media"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              <ExerciseMedia
                muscleGroup={exercise?.muscle_group}
                videoUrl={exercise?.video_url}
                imageUrl={exercise?.image_url}
                name={exercise?.name}
              />
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {row.notes && (
        <div className="mx-4 mb-3 flex items-start gap-2.5 rounded-2xl border border-line bg-white/[0.03] p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          <p className="whitespace-pre-line text-xs leading-relaxed text-zinc-300">{row.notes}</p>
        </div>
      )}

      <div className="px-2 pb-2" role="table" aria-label={`Séries de ${exercise?.name ?? 'exercício'}`}>
        <div
          role="row"
          className="grid grid-cols-[2.6rem_minmax(0,1fr)_4.4rem_4.4rem_2.9rem] gap-2 px-2 pb-1 text-center text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500"
        >
          <span role="columnheader">Série</span>
          <span role="columnheader">Anterior</span>
          <span role="columnheader">Kg</span>
          <span role="columnheader">Reps</span>
          <span role="columnheader">
            <span className="sr-only">Concluída</span>✓
          </span>
        </div>
        <div role="rowgroup" className="space-y-1">
          {entries.map((entry, setIndex) => (
            <SetRow
              key={entry.setNumber}
              entry={entry}
              label={labels[setIndex]}
              inputIdPrefix={`set-${row.id}-${setIndex}`}
              pending={entry.rowId !== null && pendingIds.has(entry.rowId)}
              onChange={(patch) => onChangeSet(row.id, setIndex, patch)}
              onToggle={() => onToggleSet(row.id, setIndex)}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
        <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-500">
          {usedTypes.map((type) => (
            <span key={type.value} className="flex items-center gap-1">
              <span className={cn('grid h-4 w-4 place-items-center rounded border text-[9px] font-black', type.className)}>
                {type.letter}
              </span>
              {type.label}
            </span>
          ))}
        </div>
        <div className="flex shrink-0 gap-1.5">
          {canRemoveExtra && (
            <button
              type="button"
              onClick={() => onRemoveExtra(row.id)}
              aria-label="Remover série extra"
              className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06] text-zinc-400 hover:text-white"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onAddSet(row.id)}
            className="flex h-9 items-center gap-1 rounded-xl bg-white/[0.06] px-3 text-[11px] font-bold text-zinc-300 hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Série
          </button>
        </div>
      </div>
    </section>
  )
})
