'use client'

import { useId, useState } from 'react'
import { ChevronDown, Leaf } from 'lucide-react'
import { DETAIL_GROUP_LABELS, formatMicro, formatNutrient, sumDetails, type DetailGroup, type DetailTotal } from '@/lib/nutrition'
import type { MealItem } from '@/lib/nutrition-plan'
import { cn } from '@/lib/cn'

const GROUPS: DetailGroup[] = ['label', 'mineral', 'vitamin']

// Fibra usa uma casa decimal (como nas telas de macros); o resto usa formatMicro (0,63 mg; 12,4 mg; 1.234 mg).
const valueText = (total: DetailTotal) => (total.field.column === 'fiber_g' ? formatNutrient('fiber_g', total.value) : formatMicro(total.value))

// "Vitaminas e minerais do dia": soma de todas as refeições, sem metas de referência.
// variant "student": recolhido, nomes simples, só o que tem dado. variant "coach": completo, com nomes técnicos
// e quantos alimentos estão sem o dado (para o treinador preferir os da TACO).
export function NutrientDetails({ items, variant }: { items: MealItem[]; variant: 'student' | 'coach' }) {
  const [open, setOpen] = useState(variant === 'coach')
  const panelId = useId()
  const totals = sumDetails(items.map((item) => ({ food: item.food, grams: item.grams })))
  const isStudent = variant === 'student'

  const groups = GROUPS.map((group) => ({
    group,
    rows: totals.filter((total) => total.field.group === group && (!isStudent || total.known > 0)),
  })).filter(({ rows }) => rows.length > 0)

  if (isStudent && groups.length === 0) return null

  const list = (
    <div className="space-y-5">
      {groups.map(({ group, rows }) => (
        <section key={group} aria-label={DETAIL_GROUP_LABELS[group]}>
          <h3 className="mb-1.5 text-xs font-black uppercase tracking-[0.1em] text-zinc-500">{DETAIL_GROUP_LABELS[group]}</h3>
          <ul className="divide-y divide-line">
            {rows.map((total, index) => {
              const partial = total.known > 0 && total.known < total.total
              return (
                <li key={total.field.id} style={{ '--i': index } as React.CSSProperties} className={cn('flex items-baseline justify-between gap-3 py-2.5', open && 'rise-in')}>
                  <span className="min-w-0 text-sm text-zinc-200">
                    {total.field.label}
                    {total.field.technical && <span className="text-zinc-500"> · {total.field.technical}</span>}
                  </span>
                  <span className="shrink-0 text-right text-sm font-bold tabular-nums text-white">
                    {total.known === 0 ? (
                      <span className="font-medium text-zinc-500">sem dado</span>
                    ) : (
                      <>
                        {valueText(total)} <span className="font-medium text-zinc-500">{total.field.unit}</span>
                      </>
                    )}
                    {partial && (
                      <span className="ml-2 rounded-full bg-white/[0.08] px-2 py-0.5 align-middle text-xs font-semibold text-zinc-300">
                        parcial
                        <span className="sr-only">: o total pode ser maior</span>
                        {!isStudent && <span className="font-medium text-zinc-500"> {total.known}/{total.total}</span>}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )

  if (!isStudent) {
    return (
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-zinc-400">
          Soma de todas as refeições. Sem metas de referência. &quot;Parcial&quot; mostra em quantos alimentos o dado existe (vem da tabela; alimentos cadastrados à mão não têm).
        </p>
        {list}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-white/[0.03]"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <Leaf className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-base font-bold text-white">Vitaminas e minerais do dia</span>
        <ChevronDown className="chev h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} className="rise-in space-y-4 border-t border-line px-5 pb-5 pt-4">
          <p className="text-sm leading-relaxed text-zinc-400">Soma de todas as refeições. Não é meta: serve para conversar com o seu nutricionista.</p>
          {list}
        </div>
      )}
    </div>
  )
}
