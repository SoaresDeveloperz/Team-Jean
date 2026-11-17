'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Leaf, Pencil, Plus, Salad, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/errors'
import { formatNutrient, nutrientIn, parseAmount, type Food } from '@/lib/nutrition'
import {
  FOOD_COLUMNS,
  NUTRITION_SETUP_MESSAGE,
  NutritionLoadError,
  TARGET_NUTRIENTS,
  loadPlan,
  mealTotals,
  planTotals,
  targetRatio,
  toFood,
  type MealItem,
  type Plan,
  type PlanMeal,
} from '@/lib/nutrition-plan'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { BarFill } from '@/components/ui/bar-fill'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { NutrientDetails } from '@/components/nutrition/NutrientDetails'
import { FoodPicker } from './FoodPicker'

const inputClassName =
  'w-full rounded-2xl border border-line-strong bg-black/40 p-3.5 text-sm text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none'
const smallInputClassName =
  'min-h-11 w-full rounded-xl border border-line-strong bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none'
const labelClassName = 'mb-1.5 block text-xs font-black uppercase tracking-[0.1em] text-zinc-400'
const iconButton = 'grid h-11 w-11 shrink-0 place-items-center rounded-xl text-zinc-500 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50'

const SHOWN_LABELS = { kcal: 'calorias', protein_g: 'proteína', carb_g: 'carboidrato', fat_g: 'gordura' }
const RESPONSIBLE_KEY = 'team-jean:nutri-responsavel'
const SUGGESTED_MEALS = ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia']

type DbResult = PromiseLike<{ error: { code?: string; message?: string } | null }>

// Responsável técnico: o treinador digita uma vez e o app lembra neste aparelho (não é dado do aluno).
function rememberedResponsible() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(RESPONSIBLE_KEY) ?? 'null') as { name?: string; crn?: string } | null
    return { name: saved?.name ?? '', crn: saved?.crn ?? '' }
  } catch {
    return { name: '', crn: '' }
  }
}

type FormState = { name: string; crn: string; kcal: string; protein: string; carb: string; fat: string; notes: string }
const emptyOr = (value: number | null) => (value === null ? '' : String(value))

function formFor(plan: Plan | null): FormState {
  if (!plan) return { ...rememberedResponsible(), kcal: '', protein: '', carb: '', fat: '', notes: '' }
  return {
    name: plan.responsibleName,
    crn: plan.responsibleCrn,
    kcal: emptyOr(plan.targets.kcal),
    protein: emptyOr(plan.targets.protein_g),
    carb: emptyOr(plan.targets.carb_g),
    fat: emptyOr(plan.targets.fat_g),
    notes: plan.notes ?? '',
  }
}

// Aba "Nutrição" da ficha do aluno: o plano alimentar, montado em refeições.
export function NutritionPlanEditor({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [supabase] = useState(() => createClient())
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<{ message: string; missing: boolean } | null>(null)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [foods, setFoods] = useState<Food[] | null>(null)
  const [pickerMeal, setPickerMeal] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(() => formFor(null))
  const [formError, setFormError] = useState('')
  const [customMeal, setCustomMeal] = useState('')
  const [microsOpen, setMicrosOpen] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [announcement, setAnnouncement] = useState('')
  const summaryRef = useRef<HTMLElement>(null)
  const announceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [confirm, setConfirm] = useState<{ kind: 'plan' } | { kind: 'meal'; meal: PlanMeal } | null>(null)
  const firstName = studentName.split(' ')[0]
  // Mudanças entram numa fila (uma por vez, na ordem em que o Jean mexeu) e o plano mais recente fica numa ref.
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const pending = useRef(0)
  const planRef = useRef<Plan | null | undefined>(undefined)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const failed = useRef(false)
  // Itens e refeições que o Jean acabou de tirar: ficam escondidos até o banco confirmar (uma resposta antiga não os traz de volta).
  const hiddenItems = useRef(new Set<string>())
  const hiddenMeals = useRef(new Set<string>())

  const fetchPlan = useCallback(async () => {
    try {
      return { plan: await loadPlan(supabase, studentId), error: null }
    } catch (error) {
      return {
        plan: undefined,
        error: {
          message: error instanceof Error ? error.message : friendlyError(error, 'Não foi possível carregar o plano'),
          missing: error instanceof NutritionLoadError && error.missing,
        },
      }
    }
  }, [supabase, studentId])

  const apply = useCallback((result: Awaited<ReturnType<typeof fetchPlan>>) => {
    if (result.error) setLoadError(result.error)
    else {
      const loaded = result.plan
      const next = loaded
        ? {
            ...loaded,
            meals: loaded.meals
              .filter((meal) => !hiddenMeals.current.has(meal.id))
              .map((meal) => ({ ...meal, items: meal.items.filter((item) => !hiddenItems.current.has(item.id)) })),
          }
        : loaded
      planRef.current = next
      setPlan(next)
      setLoadError(null)
    }
  }, [])

  // Depois de uma mudança, um erro ao recarregar vira aviso e não derruba o plano que já está na tela.
  const reload = async () => {
    const result = await fetchPlan()
    if (result.error) {
      const message = result.error.message
      setActionError((current) => current || message)
    } else apply(result)
  }

  useEffect(() => {
    let active = true
    void fetchPlan().then((result) => {
      if (active) apply(result)
    })
    return () => {
      active = false
    }
  }, [fetchPlan, apply])

  useEffect(
    () => () => {
      clearTimeout(savedTimer.current)
      clearTimeout(announceTimer.current)
    },
    [],
  )

  // Frase curta para o leitor de tela (alguém removido, alimento adicionado...); some sozinha.
  const announce = (text: string) => {
    setAnnouncement(text)
    clearTimeout(announceTimer.current)
    announceTimer.current = setTimeout(() => setAnnouncement(''), 4000)
  }
  const flashSaved = () => {
    clearTimeout(savedTimer.current)
    setSaveState('saved')
    savedTimer.current = setTimeout(() => setSaveState('idle'), 2000)
  }

  // Mostra a mudança na hora (o item some com animação) e o banco confirma em seguida; se falhar, o recarregamento devolve.
  const optimistic = (change: (current: Plan) => Plan) => {
    const next = planRef.current ? change(planRef.current) : planRef.current
    planRef.current = next
    setPlan(next)
  }

  // Faz a mudança na sua vez, mostra o erro (se houver) e recarrega o plano para a tela refletir o banco.
  // Devolve se deu certo (a linha volta ao valor antigo quando não deu).
  const run = (action: () => DbResult): Promise<boolean> => {
    const job = queue.current.then(async () => {
      if (pending.current === 0) failed.current = false
      pending.current += 1
      clearTimeout(savedTimer.current)
      setBusy(true)
      setSaveState('saving')
      setActionError('')
      let ok = true
      try {
        const { error } = await action()
        if (error) {
          ok = false
          setActionError(friendlyError(error, 'Não foi possível salvar'))
        }
      } catch (error) {
        ok = false
        setActionError(friendlyError(error, 'Não foi possível salvar'))
      }
      if (!ok) failed.current = true
      await reload()
      pending.current -= 1
      if (pending.current === 0) {
        setBusy(false)
        // "Salvo ✓" por 2 s; se algo falhou, o aviso de erro já diz o que houve.
        if (failed.current) setSaveState('idle')
        else flashSaved()
      }
      return ok
    })
    queue.current = job.catch(() => undefined)
    return job
  }

  const openPicker = async (mealId: string) => {
    setPickerMeal(mealId)
    if (foods) return
    announce('Carregando alimentos…')
    // shortcut: busca até 1000 alimentos de uma vez (TACO 597 + os do treinador); paginar se passar disso.
    const { data, error } = await supabase.from('foods').select(FOOD_COLUMNS).order('name', { ascending: true }).limit(1000)
    if (error) {
      setPickerMeal(null)
      setActionError(friendlyError(error, 'Não foi possível carregar os alimentos'))
      return
    }
    setFoods((data ?? []).map((row) => toFood(row as Record<string, unknown>)))
  }

  const openForm = () => {
    setForm(formFor(plan ?? null))
    setFormError('')
    setFormOpen(true)
  }

  const submitForm = async () => {
    const targets = { kcal: parseAmount(form.kcal), protein: parseAmount(form.protein), carb: parseAmount(form.carb), fat: parseAmount(form.fat) }
    const name = form.name.trim()
    const crn = form.crn.trim()
    const filled = (text: string, value: number | null) => text.trim() === '' || value !== null
    if (name.length < 3 || crn.length < 4) return setFormError('Informe o nome e o CRN do nutricionista responsável.')
    if (!filled(form.kcal, targets.kcal) || !filled(form.protein, targets.protein) || !filled(form.carb, targets.carb) || !filled(form.fat, targets.fat)) {
      return setFormError('Use só números nas metas.')
    }
    if (targets.kcal !== null && (targets.kcal < 800 || targets.kcal > 10000)) return setFormError('A meta de calorias fica entre 800 e 10000.')
    if ((targets.protein ?? 0) > 1000 || (targets.carb ?? 0) > 1500 || (targets.fat ?? 0) > 600) return setFormError('Confira as metas de proteína, carboidrato e gordura: algum valor está alto demais.')
    if (form.notes.length > 500) return setFormError('As observações passam de 500 letras.')
    const row = {
      responsible_name: name,
      responsible_crn: crn,
      kcal_target: targets.kcal === null ? null : Math.round(targets.kcal),
      protein_target_g: targets.protein === null ? null : Math.round(targets.protein),
      carb_target_g: targets.carb === null ? null : Math.round(targets.carb),
      fat_target_g: targets.fat === null ? null : Math.round(targets.fat),
      notes: form.notes.trim() || null,
    }
    try {
      window.localStorage.setItem(RESPONSIBLE_KEY, JSON.stringify({ name, crn }))
    } catch {
      // Sem armazenamento: só não lembra do responsável da próxima vez.
    }
    setFormOpen(false)
    await run(() => (plan ? supabase.from('nutrition_plans').update(row).eq('id', plan.id) : supabase.from('nutrition_plans').insert({ student_id: studentId, ...row })))
  }

  const addMeal = (name: string) => {
    const clean = name.trim().slice(0, 40)
    if (!plan || !clean) return
    setCustomMeal('')
    return run(async () => {
      // Confere de novo na vez da fila: dois toques seguidos no mesmo botão criam uma refeição só.
      const latest = planRef.current
      if (!latest) return { error: null }
      if (latest.meals.some((meal) => meal.name.toLowerCase() === clean.toLowerCase())) return { error: { code: '23505', message: 'duplicate' } }
      return supabase.from('nutrition_meals').insert({ plan_id: latest.id, name: clean, position: Math.min(latest.meals.length, 30) })
    })
  }

  if (loadError) {
    return loadError.missing ? (
      <Alert variant="info">{NUTRITION_SETUP_MESSAGE}</Alert>
    ) : (
      <Alert variant="error" onRetry={() => void reload()}>
        {loadError.message}
      </Alert>
    )
  }
  if (plan === undefined) {
    return (
      <div className="space-y-2" role="status" aria-label="Carregando o plano alimentar">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    )
  }

  const planModal = (
    <Modal open={formOpen} onClose={() => setFormOpen(false)} title={plan ? 'Dados do plano' : 'Criar plano'} description={`Plano de ${firstName}`}>
      <div className="space-y-3">
        {formError && <Alert variant="error">{formError}</Alert>}
        <div>
          <label htmlFor="plan-resp-name" className={labelClassName}>Nutricionista responsável</label>
          <input id="plan-resp-name" type="text" maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClassName} />
        </div>
        <div>
          <label htmlFor="plan-resp-crn" className={labelClassName}>CRN</label>
          <input id="plan-resp-crn" type="text" maxLength={30} value={form.crn} onChange={(event) => setForm({ ...form, crn: event.target.value })} placeholder="Ex.: CRN-3 12345" className={inputClassName} />
        </div>
        <p className="text-xs text-zinc-500">O aluno vê este nome e o CRN no plano.</p>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ['kcal', 'Meta de calorias (kcal)'],
              ['protein', 'Proteína (g)'],
              ['carb', 'Carboidrato (g)'],
              ['fat', 'Gordura (g)'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label htmlFor={`plan-${key}`} className={labelClassName}>{label}</label>
              <input id={`plan-${key}`} type="text" inputMode="numeric" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} placeholder="Opcional" className={inputClassName} />
            </div>
          ))}
        </div>
        <div>
          <label htmlFor="plan-notes" className={labelClassName}>Observações para o aluno</label>
          <textarea id="plan-notes" rows={3} maxLength={500} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className={inputClassName} />
        </div>
        <button type="button" onClick={submitForm} className="flex h-12 w-full items-center justify-center rounded-2xl bg-white text-xs font-black uppercase tracking-wider text-black">
          {plan ? 'Salvar' : 'Criar plano'}
        </button>
        {plan && (
          <button
            type="button"
            onClick={() => {
              setFormOpen(false)
              setConfirm({ kind: 'plan' })
            }}
            className="flex min-h-11 w-full items-center justify-center gap-2 text-xs font-bold text-zinc-500 hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Apagar plano de {firstName}
          </button>
        )}
      </div>
    </Modal>
  )

  if (plan === null) {
    return (
      <div className="space-y-3">
        {actionError && <Alert variant="error">{actionError}</Alert>}
        <div className="space-y-3 rounded-3xl border border-dashed border-line-strong p-6 text-center">
          <Salad className="mx-auto h-9 w-9 text-zinc-600" aria-hidden="true" />
          <p className="text-sm font-semibold text-zinc-300">{firstName} ainda não tem plano de alimentação.</p>
          <p className="text-xs text-zinc-500">Ao criar o plano, a aluna ou o aluno passa a ver a &quot;Alimentação&quot; no app.</p>
          <button type="button" onClick={openForm} disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-xs font-black uppercase tracking-wider text-black disabled:opacity-60">
            <Plus className="h-4 w-4" aria-hidden="true" /> Criar plano
          </button>
        </div>
        {planModal}
      </div>
    )
  }

  const totals = planTotals(plan)
  const targetRows = TARGET_NUTRIENTS.filter(({ key }) => plan.targets[key] !== null)
  // Só calorias e macros: fibra, sódio e colesterol faltando num alimento próprio não é o que o treinador acompanha aqui.
  const shownIncomplete = totals.incomplete.filter((nutrient): nutrient is keyof typeof SHOWN_LABELS => nutrient in SHOWN_LABELS)
  const usedNames = new Set(plan.meals.map((meal) => meal.name.toLowerCase()))
  const mealSummary = (meal: PlanMeal) => {
    if (meal.items.length === 0) return ''
    const sum = mealTotals(meal)
    return `${formatNutrient('kcal', sum.values.kcal)} kcal · P ${formatNutrient('protein_g', sum.values.protein_g)} · C ${formatNutrient('carb_g', sum.values.carb_g)} · G ${formatNutrient('fat_g', sum.values.fat_g)}${sum.incomplete.some((nutrient) => nutrient in SHOWN_LABELS) ? ' · parcial' : ''}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 px-1">
        <p className="min-w-0 text-xs leading-relaxed text-zinc-400">
          Responsável: <span className="font-bold text-white">{plan.responsibleName}</span> ({plan.responsibleCrn})
        </p>
        <button type="button" onClick={openForm} disabled={busy} className="flex min-h-11 shrink-0 items-center gap-1.5 px-2 text-xs font-bold text-brand hover:text-white">
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Editar
        </button>
      </div>

      <section ref={summaryRef} tabIndex={-1} aria-label="Resumo do plano" className="sticky-summary z-10 space-y-2.5 rounded-2xl border border-line bg-surface p-3.5 shadow-lg shadow-black/50 focus:outline-none">
        {actionError && <Alert variant="error">{actionError}</Alert>}
        {targetRows.length === 0 ? (
          <p className="text-sm font-bold tabular-nums text-white">
            {formatNutrient('kcal', totals.values.kcal)} kcal
            <span className="text-xs font-medium text-zinc-500">
              {' '}· P {formatNutrient('protein_g', totals.values.protein_g)} · C {formatNutrient('carb_g', totals.values.carb_g)} · G {formatNutrient('fat_g', totals.values.fat_g)} (sem metas definidas: veja em &quot;Editar&quot;)
            </span>
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {targetRows.map(({ nutrient, key, label, unit }) => {
              const target = plan.targets[key] as number
              const value = totals.values[nutrient]
              const ratio = targetRatio(value, target) ?? 0
              return (
                <li key={key}>
                  <p aria-hidden="true" className="text-xs font-semibold text-zinc-400">{label}</p>
                  <p aria-hidden="true" className={cn('text-sm font-bold tabular-nums', ratio > 1.05 ? 'text-gold' : 'text-white')}>
                    {formatNutrient(nutrient, value)} <span className="font-medium text-zinc-500">/ {formatNutrient(nutrient, target)} {unit}</span>
                    {ratio > 1.05 && <span className="ml-1 text-xs font-semibold text-gold">acima</span>}
                  </p>
                  <div
                    role="progressbar"
                    aria-label={`${label}: ${formatNutrient(nutrient, value)} de ${formatNutrient(nutrient, target)} ${unit}`}
                    aria-valuemin={0}
                    aria-valuemax={target}
                    aria-valuenow={Math.min(value, target)}
                    aria-valuetext={`${formatNutrient(nutrient, value)} de ${formatNutrient(nutrient, target)} ${unit}${ratio > 1.05 ? ', acima da meta' : ''}`}
                    className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
                  >
                    <BarFill value={ratio} className={ratio > 1.05 ? 'bg-gold' : 'bg-brand'} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {shownIncomplete.length > 0 && plan.meals.length > 0 && (
          <p className="text-xs text-zinc-500">
            Total parcial: algum alimento não tem o dado de {shownIncomplete.map((nutrient) => SHOWN_LABELS[nutrient]).join(', ')}.
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setMicrosOpen(true)} className="flex min-h-11 items-center gap-1.5 rounded-xl px-1 text-xs font-bold text-brand hover:text-white">
            <Leaf className="h-3.5 w-3.5" aria-hidden="true" /> Vitaminas e minerais
          </button>
          <span role="status" className={cn('text-xs font-semibold transition-opacity', saveState === 'idle' ? 'opacity-0' : 'opacity-100', saveState === 'saved' ? 'text-brand' : 'text-zinc-400')}>
            {saveState === 'saving' ? 'Salvando…' : saveState === 'saved' ? 'Salvo ✓' : '\u00a0'}
          </span>
        </div>
      </section>

      {plan.meals.map((meal) => (
        <MealCard
          key={meal.id}
          meal={meal}
          summary={mealSummary(meal)}
          onAddFood={() => void openPicker(meal.id)}
          onRename={(name, time) => run(() => supabase.from('nutrition_meals').update({ name, meal_time: time }).eq('id', meal.id))}
          onDelete={() => setConfirm({ kind: 'meal', meal })}
          onSaveItem={(item, grams, portion) => run(() => supabase.from('nutrition_meal_items').update({ grams, portion_text: portion }).eq('id', item.id))}
          onRemoveItem={async (item) => {
            hiddenItems.current.add(item.id)
            announce(`${item.food.name} removido do ${meal.name}`)
            optimistic((current) => ({ ...current, meals: current.meals.map((candidate) => (candidate.id === meal.id ? { ...candidate, items: candidate.items.filter((other) => other.id !== item.id) } : candidate)) }))
            const ok = await run(() => supabase.from('nutrition_meal_items').delete().eq('id', item.id))
            hiddenItems.current.delete(item.id)
            // Se o banco não apagou, o item volta para a lista (junto com o aviso de erro).
            if (!ok) await reload()
            return ok
          }}
        />
      ))}

      <section aria-label="Nova refeição" className="space-y-2">
        <p className="text-xs font-black uppercase tracking-[0.1em] text-zinc-500">Nova refeição</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_MEALS.filter((name) => !usedNames.has(name.toLowerCase())).map((name) => (
            <button key={name} type="button" onClick={() => void addMeal(name)} className="min-h-11 rounded-full border border-line-strong bg-white/[0.04] px-4 text-xs font-bold text-zinc-200 hover:text-white disabled:opacity-60">
              + {name}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void addMeal(customMeal)
          }}
        >
          <input type="text" maxLength={40} value={customMeal} onChange={(event) => setCustomMeal(event.target.value)} placeholder="Outra refeição (ex.: Pré-treino)" aria-label="Nome de outra refeição" className={inputClassName} />
          <button type="submit" disabled={!customMeal.trim()} className="h-12 shrink-0 rounded-2xl bg-white px-5 text-xs font-black uppercase tracking-wider text-black disabled:opacity-50">
            Criar
          </button>
        </form>
      </section>

      <p role="status" className="sr-only">{announcement}</p>
      {planModal}
      <Modal open={microsOpen} onClose={() => setMicrosOpen(false)} title="Vitaminas e minerais" description={`Plano de ${firstName}, o dia todo`}>
        <NutrientDetails items={plan.meals.flatMap((meal) => meal.items)} variant="coach" />
      </Modal>
      <FoodPicker
        open={pickerMeal !== null && foods !== null}
        onClose={() => setPickerMeal(null)}
        foods={foods ?? []}
        onFoodCreated={(food) => setFoods((current) => [...(current ?? []), food].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))}
        onPick={async (food, grams, portionText, itemId) => {
          const meal = plan.meals.find((candidate) => candidate.id === pickerMeal)
          if (!meal) return
          const { error } = await supabase.from('nutrition_meal_items').insert({ id: itemId, meal_id: meal.id, food_id: food.id, grams, portion_text: portionText, position: Math.min(meal.items.length, 60) })
          // 23505: o item já tinha entrado numa tentativa anterior (a resposta se perdeu). Não duplica.
          if (error && error.code !== '23505') throw error
          announce(`${food.name} adicionado ao ${meal.name}`)
          flashSaved()
          await reload()
        }}
      />
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === 'meal' ? `Apagar "${confirm.meal.name}"?` : `Apagar o plano de ${firstName}?`}
        description={
          confirm?.kind === 'meal'
            ? 'Os alimentos desta refeição também saem do plano.'
            : 'Todas as refeições e alimentos saem, e o aluno deixa de ver a Alimentação no app. Não dá para desfazer.'
        }
        confirmLabel="Apagar"
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          const current = confirm
          setConfirm(null)
          if (current?.kind === 'meal') {
            hiddenMeals.current.add(current.meal.id)
            announce(`Refeição ${current.meal.name} apagada`)
            // O botão que abriu a confirmação some junto com a refeição: o foco vai para o resumo.
            setTimeout(() => summaryRef.current?.focus(), 80)
            optimistic((plan) => ({ ...plan, meals: plan.meals.filter((meal) => meal.id !== current.meal.id) }))
            const ok = await run(() => supabase.from('nutrition_meals').delete().eq('id', current.meal.id))
            hiddenMeals.current.delete(current.meal.id)
            if (!ok) await reload()
          }
          else if (current?.kind === 'plan') await run(() => supabase.from('nutrition_plans').delete().eq('id', plan.id))
        }}
      />
    </div>
  )
}

function MealCard({
  meal,
  summary,
  onAddFood,
  onRename,
  onDelete,
  onSaveItem,
  onRemoveItem,
}: {
  meal: PlanMeal
  summary: string
  onAddFood: () => void
  onRename: (name: string, time: string | null) => Promise<boolean>
  onDelete: () => void
  onSaveItem: (item: MealItem, grams: number, portion: string | null) => Promise<boolean>
  onRemoveItem: (item: MealItem) => unknown
}) {
  // Os campos guardam o que o Jean está digitando; só voltam ao valor do banco quando ele muda por fora.
  const [name, setName] = useState(meal.name)
  const [seenName, setSeenName] = useState(meal.name)
  if (meal.name !== seenName) {
    setSeenName(meal.name)
    setName(meal.name)
  }
  const [time, setTime] = useState(meal.time ?? '')
  const [seenTime, setSeenTime] = useState(meal.time ?? '')
  if ((meal.time ?? '') !== seenTime) {
    setSeenTime(meal.time ?? '')
    setTime(meal.time ?? '')
  }
  const [nameError, setNameError] = useState('')
  const addRef = useRef<HTMLButtonElement>(null)
  const save = async () => {
    const clean = name.trim().slice(0, 40)
    if (!clean) {
      setNameError('A refeição precisa de um nome.')
      return setName(meal.name)
    }
    setNameError('')
    if (clean === meal.name && (time || null) === meal.time) return
    if (!(await onRename(clean, time || null))) {
      setName(meal.name)
      setTime(meal.time ?? '')
    }
  }
  const enterSaves = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur()
  }

  return (
    <section aria-label={meal.name} className="rise-in rounded-2xl border border-line">
      <div className="border-b border-line p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => void save()}
            onKeyDown={enterSaves}
            aria-label={`Nome da refeição ${meal.name}`}
            aria-invalid={nameError ? true : undefined}
            className={cn(smallInputClassName, 'min-w-[8rem] flex-1 font-bold')}
          />
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} onBlur={() => void save()} onKeyDown={enterSaves} aria-label={`Horário de ${meal.name}`} className={cn(smallInputClassName, 'w-28 shrink-0')} />
          <button type="button" onClick={onDelete} aria-label={`Apagar a refeição ${meal.name}`} className={iconButton}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {nameError && (
          <p role="alert" className="mt-2 px-1 text-xs font-semibold text-danger">
            {nameError}
          </p>
        )}
        {summary && <p className="mt-2 px-1 text-xs tabular-nums text-zinc-400">{summary}</p>}
      </div>
      {meal.items.length > 0 && (
        <ul className="divide-y divide-line">
          <AnimatePresence initial={false}>
            {meal.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                mealName={meal.name}
                onSave={(grams, portion) => onSaveItem(item, grams, portion)}
                onRemove={() => {
                  // O botão de tirar some com o item: o foco vai para um lugar que continua na tela.
                  addRef.current?.focus()
                  return onRemoveItem(item)
                }}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
      <div className="p-3">
        <button ref={addRef} type="button" onClick={onAddFood} className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong text-xs font-bold text-zinc-300 hover:text-white">
          <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar alimento
        </button>
      </div>
    </section>
  )
}

function ItemRow({ item, mealName, onSave, onRemove }: { item: MealItem; mealName: string; onSave: (grams: number, portion: string | null) => Promise<boolean>; onRemove: () => unknown }) {
  const savedGrams = String(item.grams).replace('.', ',')
  const savedPortion = item.portionText ?? ''
  const [grams, setGrams] = useState(savedGrams)
  const [seenGrams, setSeenGrams] = useState(savedGrams)
  if (savedGrams !== seenGrams) {
    setSeenGrams(savedGrams)
    setGrams(savedGrams)
  }
  const [portion, setPortion] = useState(savedPortion)
  const [seenPortion, setSeenPortion] = useState(savedPortion)
  if (savedPortion !== seenPortion) {
    setSeenPortion(savedPortion)
    setPortion(savedPortion)
  }
  const [error, setError] = useState('')
  const kcal = nutrientIn(item.food, 'kcal', parseAmount(grams) ?? item.grams)
  // Nomes únicos: o mesmo alimento pode estar em duas refeições.
  const where = `${item.food.name} (${mealName})`

  const save = async () => {
    const value = parseAmount(grams)
    if (value === null || value <= 0 || value > 5000) {
      setError('Use um número de 1 a 5000 gramas.')
      return setGrams(savedGrams)
    }
    setError('')
    const nextPortion = portion.trim() || null
    if (value === item.grams && nextPortion === item.portionText) return
    if (!(await onSave(value, nextPortion))) {
      setGrams(savedGrams)
      setPortion(savedPortion)
    }
  }
  const enterSaves = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur()
  }

  return (
    <m.li
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
      className="space-y-2 p-3"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-white">{item.food.name}</p>
          <p className="text-xs tabular-nums text-zinc-500">{kcal === null ? 'sem kcal na tabela' : `${formatNutrient('kcal', kcal)} kcal`}</p>
        </div>
        <button type="button" onClick={() => void onRemove()} aria-label={`Tirar ${where}`} className={iconButton}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-[6rem_1fr] gap-2">
        <div>
          <span aria-hidden="true" className="mb-1 block text-xs font-semibold text-zinc-400">Gramas</span>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={grams}
              onChange={(event) => setGrams(event.target.value)}
              onBlur={() => void save()}
              onKeyDown={enterSaves}
              aria-label={`Gramas de ${where}`}
              aria-invalid={error ? true : undefined}
              className={cn(smallInputClassName, 'pr-7')}
            />
            <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-500">g</span>
          </div>
        </div>
        <div>
          <span aria-hidden="true" className="mb-1 block text-xs font-semibold text-zinc-400">Medida caseira</span>
          <input type="text" maxLength={60} value={portion} onChange={(event) => setPortion(event.target.value)} onBlur={() => void save()} onKeyDown={enterSaves} placeholder="Ex.: 2 unidades" aria-label={`Medida caseira de ${where}`} className={smallInputClassName} />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </m.li>
  )
}
