'use client'

import { useEffect, useState } from 'react'
import { Salad } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import { MISSING_SESSION, friendlyError } from '@/lib/errors'
import { formatNutrient, type Nutrient } from '@/lib/nutrition'
import {
  NutritionLoadError,
  TARGET_NUTRIENTS,
  forgetNutritionCopy,
  loadPlan,
  mealTotals,
  planTotals,
  readNutritionCopy,
  saveNutritionCopy,
  targetRatio,
  type Plan,
} from '@/lib/nutrition-plan'
import { Alert } from '@/components/ui/alert'
import { BarFill } from '@/components/ui/bar-fill'
import { Skeleton } from '@/components/ui/skeleton'
import { Eyebrow, Stagger, Tile } from '@/components/ui/tile'

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
// Verdadeiro quando há itens e nenhum deles tem o dado: mostrar "sem dado" em vez de 0.
const allMissing = (items: { food: Record<Nutrient, number | null> }[], nutrient: Nutrient) => items.length > 0 && items.every((item) => item.food[nutrient] === null)
const nutrientLabel: Record<string, string> = { kcal: 'calorias', protein_g: 'proteína', carb_g: 'carboidrato', fat_g: 'gordura' }

// "Alimentação" do aluno: o plano que o nutricionista montou, em refeições. Só leitura.
export default function StudentNutritionPage() {
  const [supabase] = useState(() => createClient())
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined)
  const [fromCopy, setFromCopy] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    const load = async () => {
      const user = await getCurrentUser(supabase)
      if (!active) return
      if (!user) {
        setError(friendlyError(MISSING_SESSION, 'Não foi possível carregar seu plano'))
        return
      }
      try {
        const loaded = await loadPlan(supabase, user.id)
        if (!active) return
        if (loaded) saveNutritionCopy(user.id, loaded)
        else forgetNutritionCopy(user.id)
        setError('')
        setFromCopy(false)
        setPlan(loaded)
      } catch (loadError) {
        if (!active) return
        // Sem o SQL, o aluno só vê "ainda não tem plano" (nada de pedir arquivo para quem não é o treinador).
        if (loadError instanceof NutritionLoadError && loadError.missing) {
          setError('')
          setPlan(null)
          return
        }
        const copy = readNutritionCopy(user.id)
        if (copy) {
          setError('')
          setFromCopy(true)
          setPlan(copy)
          return
        }
        setError(loadError instanceof Error ? loadError.message : friendlyError(loadError, 'Não foi possível carregar seu plano'))
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [supabase, attempt])

  const header = (
    <div className="px-1">
      <Eyebrow>Seu plano</Eyebrow>
      <h1 className="mt-1 font-display text-[2.75rem] font-bold uppercase leading-[0.9]">Alimentação</h1>
    </div>
  )

  if (error) {
    return (
      <div className="space-y-4">
        {header}
        <Alert
          variant="error"
          onRetry={() => {
            setError('')
            setAttempt((value) => value + 1)
          }}
        >
          {error}
        </Alert>
      </div>
    )
  }

  if (plan === undefined) {
    return (
      <div className="space-y-4">
        {header}
        <div className="space-y-3" role="status" aria-label="Carregando sua alimentação">
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
        </div>
      </div>
    )
  }

  if (plan === null) {
    return (
      <div className="space-y-4">
        {header}
        <div className="space-y-3 rounded-3xl border border-line bg-surface p-8 text-center">
          <Salad className="mx-auto h-10 w-10 text-zinc-700" aria-hidden="true" />
          <p className="text-base font-semibold text-zinc-300">Seu plano de alimentação ainda não foi montado.</p>
          <p className="text-sm text-zinc-500">Quando o seu nutricionista montar, ele aparece aqui.</p>
        </div>
      </div>
    )
  }

  const totals = planTotals(plan)
  const allItems = plan.meals.flatMap((meal) => meal.items)
  const hasTargets = TARGET_NUTRIENTS.some(({ key }) => plan.targets[key] !== null)

  return (
    <div className="space-y-4">
      {header}
      <Alert variant="info">Valores aproximados. Este plano não substitui a orientação do seu nutricionista ou médico.</Alert>
      <p className="px-1 text-sm leading-relaxed text-zinc-300">
        Plano elaborado por <span className="font-bold text-white">{plan.responsibleName}</span> ({plan.responsibleCrn}).
      </p>
      {fromCopy && (
        <Alert variant="info" onRetry={() => setAttempt((value) => value + 1)}>
          Sem internet agora. Mostrando a cópia deste aparelho, de {shortDate(plan.updatedAt)}.
        </Alert>
      )}

      <Stagger className="space-y-4">
        <Tile>
          <Eyebrow>O dia todo</Eyebrow>
          {hasTargets ? (
            <ul className="mt-3 space-y-3">
              {TARGET_NUTRIENTS.filter(({ key }) => plan.targets[key] !== null).map(({ nutrient, key, label, unit }) => {
                const target = plan.targets[key] as number
                const value = totals.values[nutrient]
                const noData = allMissing(allItems, nutrient)
                return (
                  <li key={key}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-semibold text-zinc-300">{label}</span>
                      <span className="text-base font-bold tabular-nums text-white">
                        {noData ? 'sem dado' : formatNutrient(nutrient, value)} <span className="text-sm font-medium text-zinc-500">de {formatNutrient(nutrient, target)} {unit}</span>
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`${label}: ${formatNutrient(nutrient, value)} de ${formatNutrient(nutrient, target)} ${unit}`}
                      aria-valuemin={0}
                      aria-valuemax={target}
                      aria-valuenow={Math.min(value, target)}
                      className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.08]"
                    >
                      <BarFill value={targetRatio(value, target) ?? 0} className="bg-brand" />
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-2 text-base font-bold tabular-nums text-white">
              {formatNutrient('kcal', totals.values.kcal)} kcal
              <span className="text-sm font-medium text-zinc-500">
                {' '}
                · proteína {formatNutrient('protein_g', totals.values.protein_g)} g · carboidrato {formatNutrient('carb_g', totals.values.carb_g)} g · gordura{' '}
                {formatNutrient('fat_g', totals.values.fat_g)} g
              </span>
            </p>
          )}
          {totals.incomplete.some((nutrient: Nutrient) => nutrient in nutrientLabel) && (
            <p className="mt-3 text-xs text-zinc-500">
              Total parcial: alguns alimentos não têm o dado de {totals.incomplete.filter((nutrient) => nutrient in nutrientLabel).map((nutrient) => nutrientLabel[nutrient]).join(', ')}.
            </p>
          )}
        </Tile>

        {plan.meals.length === 0 && (
          <p className="rounded-3xl border border-dashed border-line-strong p-6 text-center text-sm text-zinc-400">As refeições ainda não foram montadas.</p>
        )}
        {plan.meals.map((meal) => {
          const kcal = mealTotals(meal)
          return (
            <Tile key={meal.id} aria-labelledby={`refeicao-${meal.id}`}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 id={`refeicao-${meal.id}`} className="font-display text-2xl font-bold uppercase leading-none">
                  {meal.name}
                  {meal.time && <span className="ml-2 text-base text-zinc-500">{meal.time}</span>}
                </h2>
                {meal.items.length > 0 && (
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-400">
                    {allMissing(meal.items, 'kcal') ? 'sem dado de calorias' : `${formatNutrient('kcal', kcal.values.kcal)} kcal${kcal.incomplete.includes('kcal') ? '*' : ''}`}
                  </span>
                )}
              </div>
              {meal.items.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">Nada nesta refeição ainda.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {meal.items.map((item) => (
                    <li key={item.id} className="py-3">
                      <p className="text-lg font-bold leading-snug text-white">{item.portionText ?? `${formatNutrient('fat_g', item.grams)} g`}</p>
                      <p className="mt-0.5 text-sm text-zinc-400">
                        {item.food.name}
                        {item.portionText && <span className="text-zinc-500"> · {formatNutrient('fat_g', item.grams)} g</span>}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Tile>
          )
        })}

        {plan.notes && (
          <Tile>
            <Eyebrow>Observações</Eyebrow>
            <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-zinc-200">{plan.notes}</p>
          </Tile>
        )}

        <p className="px-1 pb-2 text-xs leading-relaxed text-zinc-500">
          Atualizado em {shortDate(plan.updatedAt)}.
          {mealsHaveIncomplete(plan) && ' * Algum alimento desta refeição não tem o dado de calorias.'}
        </p>
      </Stagger>
    </div>
  )
}

const mealsHaveIncomplete = (plan: Plan) => plan.meals.some((meal) => mealTotals(meal).incomplete.includes('kcal'))
