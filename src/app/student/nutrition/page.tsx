'use client'

import { useEffect, useState } from 'react'
import { Apple, Coffee, Dumbbell, Moon, Salad, Soup, UtensilsCrossed } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import { MISSING_SESSION, friendlyError } from '@/lib/errors'
import { formatNutrient, type Nutrient } from '@/lib/nutrition'
import {
  NutritionLoadError,
  forgetNutritionCopy,
  loadPlan,
  mealTotals,
  planTotals,
  readNutritionCopy,
  saveNutritionCopy,
  type MealItem,
  type Plan,
} from '@/lib/nutrition-plan'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Skeleton } from '@/components/ui/skeleton'
import { Eyebrow, Stagger, Tile } from '@/components/ui/tile'
import { NutrientDetails } from '@/components/nutrition/NutrientDetails'

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

// Verdadeiro quando há itens e nenhum deles tem o dado: mostrar "sem dado" em vez de 0.
const allMissing = (items: MealItem[], nutrient: Nutrient) => items.length > 0 && items.every((item) => item.food[nutrient] === null)

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

// Minutos desde a meia-noite em São Paulo (o horário das refeições é o do Brasil, não o do aparelho).
function nowInSaoPaulo() {
  const parts = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value ?? 0)
  return part('hour') * 60 + part('minute')
}

// Ícone da refeição pelo nome (sem acento e sem maiúscula).
function mealIcon(name: string) {
  const text = name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  if (/lanche|fruta/.test(text)) return Apple
  if (/cafe|desjejum/.test(text)) return Coffee
  if (/ceia/.test(text)) return Moon
  if (/pre|treino|pos/.test(text)) return Dumbbell
  if (/jantar/.test(text)) return Soup
  return UtensilsCrossed
}

// "Alimentação" do aluno: o plano que o nutricionista montou, em refeições. Só leitura.
export default function StudentNutritionPage() {
  const [supabase] = useState(() => createClient())
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined)
  const [fromCopy, setFromCopy] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  // Marca a "próxima" refeição pelo horário que o nutricionista definiu; atualiza a cada minuto e ao voltar para a aba.
  const [minutesNow, setMinutesNow] = useState(nowInSaoPaulo)
  useEffect(() => {
    const tick = () => setMinutesNow(nowInSaoPaulo())
    const timer = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

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
          <span className="sr-only">Carregando sua alimentação…</span>
          <Skeleton className="h-44 rounded-3xl" />
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
  const meals = plan.meals.filter((meal) => meal.items.length > 0)
  const nextMealId = meals.find((meal) => meal.time && minutesOf(meal.time) >= minutesNow)?.id
  const macros: { nutrient: Nutrient; key: 'protein_g' | 'carb_g' | 'fat_g'; label: string; dot: string }[] = [
    { nutrient: 'protein_g', key: 'protein_g', label: 'Proteína', dot: 'bg-brand' },
    { nutrient: 'carb_g', key: 'carb_g', label: 'Carboidrato', dot: 'bg-gold' },
    { nutrient: 'fat_g', key: 'fat_g', label: 'Gordura', dot: 'bg-sky-300' },
  ]
  const partial = (['kcal', 'protein_g', 'carb_g', 'fat_g'] as Nutrient[]).some((nutrient) => totals.incomplete.includes(nutrient) && !allMissing(allItems, nutrient))
  const kcalMissing = allMissing(allItems, 'kcal')

  return (
    <div className="space-y-4">
      {header}
      <div className="space-y-2 px-1 text-sm leading-relaxed">
        <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-zinc-300">
          <Salad className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
          <span>
            Plano de <span className="font-bold text-white">{plan.responsibleName}</span>
          </span>
        </p>
        <p className="text-zinc-500">Valores aproximados. Siga também as orientações do seu médico.</p>
      </div>
      {fromCopy && (
        <Alert variant="info" onRetry={() => setAttempt((value) => value + 1)}>
          Sem internet agora. Mostrando a cópia deste aparelho, de {shortDate(plan.updatedAt)}.
        </Alert>
      )}

      <Stagger className="space-y-4">
        <Tile className="glow-brand relative overflow-hidden">
          {/* Marca d'água decorativa */}
          <Salad aria-hidden="true" className="pointer-events-none absolute -right-5 -top-5 h-36 w-36 rotate-12 text-brand/[0.07]" />
          <Eyebrow>O dia todo</Eyebrow>
          <p className="mt-2 flex items-end gap-2">
            {kcalMissing ? (
              <span className="font-display text-4xl font-bold leading-none text-zinc-400">sem dado</span>
            ) : (
              <span className="font-display text-7xl font-bold leading-none tabular-nums text-white">
                {/* A contagem é só visual; o leitor de tela lê o valor final desde o primeiro instante. */}
                <span aria-hidden="true">
                  <AnimatedNumber value={totals.values.kcal} duration={0.4} format={(value) => formatNutrient('kcal', value)} />
                </span>
                <span className="sr-only">{formatNutrient('kcal', totals.values.kcal)}</span>
              </span>
            )}
            <span className="pb-1.5 text-base font-semibold text-zinc-400">kcal</span>
          </p>
          {plan.targets.kcal !== null && <p className="mt-1.5 text-sm text-zinc-500">Meta do plano: {formatNutrient('kcal', plan.targets.kcal)} kcal</p>}
          <dl className="mt-5 grid grid-cols-3 gap-2">
            {macros.map(({ nutrient, key, label, dot }) => {
              const target = plan.targets[key]
              return (
                <div key={key} className="rounded-2xl border border-line bg-black/30 px-3 py-3">
                  <dt className="flex items-center gap-1.5 text-xs font-bold text-zinc-400">
                    <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', dot)} />
                    {label}
                  </dt>
                  <dd className="mt-1.5 font-display text-3xl font-bold leading-none tabular-nums">
                    {allMissing(allItems, nutrient) ? (
                      <span className="text-lg text-zinc-500">sem dado</span>
                    ) : (
                      <>
                        {formatNutrient(nutrient, totals.values[nutrient])}
                        <span className="ml-0.5 text-sm font-semibold text-zinc-500">g</span>
                      </>
                    )}
                  </dd>
                  {target !== null && <dd className="mt-1 text-xs text-zinc-500">meta {formatNutrient(nutrient, target)} g</dd>}
                </div>
              )
            })}
          </dl>
          {partial && <p className="mt-4 text-sm text-zinc-400">Alguns alimentos não têm todos os dados; o total real pode ser um pouco maior.</p>}
        </Tile>

        {/* Horários do dia: toque para ir à refeição */}
        {meals.some((meal) => meal.time) && (
          <nav aria-label="Horários das refeições" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {meals
              .filter((meal) => meal.time)
              .map((meal) => (
                <a
                  key={meal.id}
                  href={`#refeicao-${meal.id}`}
                  className={cn(
                    'flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-bold transition',
                    meal.id === nextMealId ? 'border-brand/40 bg-brand-soft text-brand' : 'border-line bg-surface text-zinc-300 hover:border-line-strong',
                  )}
                >
                  <span className="tabular-nums">{meal.time}</span>
                  <span className={meal.id === nextMealId ? 'text-brand/80' : 'text-zinc-500'}>{meal.name}</span>
                </a>
              ))}
          </nav>
        )}

        {plan.notes && (
          <Tile>
            <Eyebrow>Recado do seu nutricionista</Eyebrow>
            <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-zinc-200">{plan.notes}</p>
          </Tile>
        )}

        {meals.length === 0 && (
          <p className="rounded-3xl border border-dashed border-line-strong p-6 text-center text-sm text-zinc-400">As refeições ainda não foram montadas.</p>
        )}
        {meals.length > 0 && (
          <div className="relative space-y-4 pl-8 before:absolute before:bottom-6 before:left-[11px] before:top-6 before:w-px before:bg-gradient-to-b before:from-brand/50 before:via-line-strong before:to-transparent">
            {meals.map((meal) => {
              const kcal = mealTotals(meal)
              const Icon = mealIcon(meal.name)
              const isNext = meal.id === nextMealId
              return (
                <div key={meal.id} className="relative">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute -left-8 top-7 h-[23px] w-[23px] rounded-full border-2',
                      isNext ? 'border-brand bg-brand shadow-[0_0_0_5px_rgb(52_211_153/0.18)]' : 'border-line-strong bg-surface-2',
                    )}
                  />
                  <Tile aria-labelledby={`refeicao-${meal.id}`} className={cn(isNext && 'border-brand/40 glow-brand')}>
                    <div className="flex items-center gap-3">
                      <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-2xl', isNext ? 'bg-brand text-black' : 'bg-white/[0.06] text-zinc-300')}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 id={`refeicao-${meal.id}`} className="scroll-mt-24 font-display text-2xl font-bold uppercase leading-none">
                          {meal.name}
                        </h2>
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          {meal.time && <span className={cn('font-bold tabular-nums', isNext ? 'text-brand' : 'text-zinc-400')}>{meal.time}</span>}
                          {isNext && <span className="pop-in rounded-full bg-brand-soft px-2 py-0.5 text-xs font-black uppercase tracking-wide text-brand">Próxima</span>}
                        </p>
                      </div>
                      <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-400">
                        {allMissing(meal.items, 'kcal') ? 'sem dado de calorias' : `${formatNutrient('kcal', kcal.values.kcal)} kcal${kcal.incomplete.includes('kcal') ? ' · parcial' : ''}`}
                      </span>
                    </div>
                    <ul className="mt-4 space-y-2">
                      {meal.items.map((item, index) => (
                        <li key={item.id} style={{ '--i': index } as React.CSSProperties} className="rise-in rounded-2xl border border-line bg-black/25 px-4 py-3">
                          <p className="text-lg font-bold leading-snug text-white">{item.portionText ?? `${formatNutrient('fat_g', item.grams)} g`}</p>
                          <p className="mt-0.5 text-sm text-zinc-300">
                            {item.food.name}
                            {item.portionText && <span className="text-zinc-500"> · {formatNutrient('fat_g', item.grams)} g</span>}
                          </p>
                          {item.food.group_name && <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">{item.food.group_name}</p>}
                        </li>
                      ))}
                    </ul>
                  </Tile>
                </div>
              )
            })}
          </div>
        )}

        <NutrientDetails items={allItems} variant="student" />

        <p className="px-1 pb-2 text-xs leading-relaxed text-zinc-500">Atualizado em {shortDate(plan.updatedAt)}.</p>
      </Stagger>
    </div>
  )
}
