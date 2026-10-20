'use client'

import { Reorder, useDragControls } from 'framer-motion'
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react'
import { plural } from '@/lib/text'
import type { BuilderExercise } from './BuilderExerciseCard'

type ReorderListProps = {
  items: BuilderExercise[]
  onReorder: (items: BuilderExercise[]) => void
  onMove: (index: number, direction: -1 | 1) => void
}

// Modo de reordenação: os cartões viram linhas compactas que se arrastam pela
// alça (toque ou mouse). As setas fazem o mesmo pelo teclado.
export function ReorderList({ items, onReorder, onMove }: ReorderListProps) {
  return (
    <Reorder.Group as="ol" axis="y" values={items} onReorder={onReorder} className="space-y-2">
      {items.map((item, index) => (
        <ReorderRow key={item.key} item={item} index={index} total={items.length} onMove={onMove} />
      ))}
    </Reorder.Group>
  )
}

function ReorderRow({
  item,
  index,
  total,
  onMove,
}: {
  item: BuilderExercise
  index: number
  total: number
  onMove: ReorderListProps['onMove']
}) {
  const controls = useDragControls()

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.03, boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)' }}
      className="relative flex items-center gap-2 rounded-2xl border border-line-strong bg-surface-2 py-2 pl-1.5 pr-2"
    >
      <div
        aria-hidden="true"
        onPointerDown={(event) => {
          event.preventDefault()
          controls.start(event)
        }}
        className="grid h-11 w-9 shrink-0 cursor-grab touch-none place-items-center rounded-xl text-zinc-500 active:cursor-grabbing active:text-brand"
      >
        <GripVertical className="h-5 w-5" />
      </div>
      <span aria-hidden="true" className="w-6 shrink-0 text-center font-display text-lg font-bold text-zinc-400">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-white">{item.name}</span>
        <span className="block text-[11px] text-zinc-500">
          {item.muscle_group} · {plural(item.planned_sets.length, 'série', 'séries')}
        </span>
      </span>
      <button
        type="button"
        onClick={() => onMove(index, -1)}
        disabled={index === 0}
        aria-label={`Mover ${item.name} para cima`}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-25"
      >
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onMove(index, 1)}
        disabled={index === total - 1}
        aria-label={`Mover ${item.name} para baixo`}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-25"
      >
        <ArrowDown className="h-4 w-4" aria-hidden="true" />
      </button>
    </Reorder.Item>
  )
}
