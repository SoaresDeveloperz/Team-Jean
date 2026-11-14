// Plano alimentar: leitura do banco (supabase/nutricao-plano.sql), totais e a cópia guardada
// no aparelho para o aluno ver o plano sem internet. As contas ficam em nutrition.ts.
import type { createClient } from './supabase/client'
import { friendlyError } from './errors'
import { sumItems, type Food, type Nutrient, type Totals } from './nutrition'

type Supabase = ReturnType<typeof createClient>

export const FOOD_COLUMNS = 'id, name, group_name, kcal, protein_g, fat_g, carb_g, fiber_g, sodium_mg, cholesterol_mg'

export type MealItem = { id: string; food: Food; grams: number; portionText: string | null }
export type PlanMeal = { id: string; name: string; time: string | null; items: MealItem[] }
export type Plan = {
  id: string
  studentId: string
  responsibleName: string
  responsibleCrn: string
  // Metas do dia (opcionais).
  targets: { kcal: number | null; protein_g: number | null; carb_g: number | null; fat_g: number | null }
  notes: string | null
  updatedAt: string
  meals: PlanMeal[]
}

type DbError = { code?: string; message?: string } | null | undefined

// Sem o supabase/nutricao-plano.sql, as tabelas não existem.
export function isNutritionSetupMissing(error: DbError) {
  if (!error) return false
  if (['PGRST205', 'PGRST200', '42P01'].includes(error.code ?? '')) return true
  return /schema cache|does not exist/i.test(error.message ?? '')
}

export const NUTRITION_SETUP_MESSAGE = 'Para usar a nutrição, rode os arquivos supabase/nutricao.sql, nutricao-taco.sql e nutricao-plano.sql no Supabase.'

export class NutritionLoadError extends Error {
  missing: boolean
  constructor(message: string, missing: boolean, options?: { cause?: unknown }) {
    super(message, options)
    this.missing = missing
  }
}

const num = (value: unknown) => (value === null || value === undefined ? null : Number(value))

export function toFood(row: Record<string, unknown>): Food {
  return {
    id: String(row.id),
    name: String(row.name),
    group_name: (row.group_name as string | null) ?? null,
    kcal: num(row.kcal),
    protein_g: num(row.protein_g),
    fat_g: num(row.fat_g),
    carb_g: num(row.carb_g),
    fiber_g: num(row.fiber_g),
    sodium_mg: num(row.sodium_mg),
    cholesterol_mg: num(row.cholesterol_mg),
  }
}

// Plano do aluno com refeições e itens, ou null se ele ainda não tem plano.
export async function loadPlan(supabase: Supabase, studentId: string): Promise<Plan | null> {
  const fail = (error: NonNullable<DbError>) => {
    throw new NutritionLoadError(friendlyError(error, 'Não foi possível carregar o plano'), isNutritionSetupMissing(error), { cause: error })
  }
  const { data: plan, error: planError } = await supabase.from('nutrition_plans').select('*').eq('student_id', studentId).maybeSingle()
  if (planError) fail(planError)
  if (!plan) return null

  const { data: meals, error: mealsError } = await supabase
    .from('nutrition_meals')
    .select('id, name, meal_time, position')
    .eq('plan_id', plan.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (mealsError) fail(mealsError)
  const mealRows = (meals ?? []) as { id: string; name: string; meal_time: string | null }[]

  const { data: items, error: itemsError } = mealRows.length
    ? await supabase
        .from('nutrition_meal_items')
        .select(`id, meal_id, grams, portion_text, position, foods(${FOOD_COLUMNS})`)
        .in('meal_id', mealRows.map((meal) => meal.id))
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })
    : { data: [], error: null }
  if (itemsError) fail(itemsError)
  const itemRows = (items ?? []) as unknown as { id: string; meal_id: string; grams: number | string; portion_text: string | null; foods: Record<string, unknown> | null }[]

  return {
    id: plan.id,
    studentId: plan.student_id,
    responsibleName: plan.responsible_name,
    responsibleCrn: plan.responsible_crn,
    targets: { kcal: num(plan.kcal_target), protein_g: num(plan.protein_target_g), carb_g: num(plan.carb_target_g), fat_g: num(plan.fat_target_g) },
    notes: plan.notes ?? null,
    updatedAt: plan.updated_at,
    meals: mealRows.map((meal) => ({
      id: meal.id,
      name: meal.name,
      time: meal.meal_time,
      items: itemRows
        .filter((item) => item.meal_id === meal.id && item.foods)
        .map((item) => ({ id: item.id, food: toFood(item.foods as Record<string, unknown>), grams: Number(item.grams), portionText: item.portion_text })),
    })),
  }
}

export const mealTotals = (meal: PlanMeal): Totals => sumItems(meal.items.map((item) => ({ food: item.food, grams: item.grams })))
export const planTotals = (plan: Plan): Totals => sumItems(plan.meals.flatMap((meal) => meal.items.map((item) => ({ food: item.food, grams: item.grams }))))

// "Quanto da meta": 0 a 1+ (passa de 1 quando ultrapassa); null sem meta.
export function targetRatio(total: number, target: number | null): number | null {
  return target && target > 0 ? total / target : null
}

export const TARGET_NUTRIENTS: { nutrient: Nutrient; key: 'kcal' | 'protein_g' | 'carb_g' | 'fat_g'; label: string; unit: string }[] = [
  { nutrient: 'kcal', key: 'kcal', label: 'Calorias', unit: 'kcal' },
  { nutrient: 'protein_g', key: 'protein_g', label: 'Proteína', unit: 'g' },
  { nutrient: 'carb_g', key: 'carb_g', label: 'Carboidrato', unit: 'g' },
  { nutrient: 'fat_g', key: 'fat_g', label: 'Gordura', unit: 'g' },
]

// ---- Cópia no aparelho (o plano abre sem internet) ------------------------------------------
// Dado de saúde: fica só neste aparelho, com o id da conta, e sai ao sair da conta.
const COPY_PREFIX = 'team-jean:alimentacao:'
const copyKey = (userId: string) => `${COPY_PREFIX}${userId}`

// A cópia vale 30 dias; passando disso (ou de outra conta neste aparelho) ela é descartada.
const COPY_MAX_AGE_MS = 30 * 86_400_000

export function saveNutritionCopy(userId: string, plan: Plan) {
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(COPY_PREFIX) && key !== copyKey(userId))
      .forEach((key) => window.localStorage.removeItem(key))
    window.localStorage.setItem(copyKey(userId), JSON.stringify({ savedAt: Date.now(), plan }))
  } catch {
    // Sem armazenamento (aba privada, cheio): o plano só não abre sem internet.
  }
}

export function readNutritionCopy(userId: string): Plan | null {
  try {
    const raw = window.localStorage.getItem(copyKey(userId))
    if (!raw) return null
    const copy = JSON.parse(raw) as { savedAt?: number; plan?: Plan } | null
    const plan = copy?.plan
    const fresh = typeof copy?.savedAt === 'number' && Date.now() - copy.savedAt <= COPY_MAX_AGE_MS
    if (fresh && plan && Array.isArray(plan.meals) && plan.studentId === userId) return plan
    window.localStorage.removeItem(copyKey(userId))
    return null
  } catch {
    return null
  }
}

export function forgetNutritionCopy(userId: string) {
  try {
    window.localStorage.removeItem(copyKey(userId))
  } catch {
    // Nada a apagar.
  }
}

// Ao sair da conta: o aparelho pode ser emprestado.
export function clearSavedNutrition() {
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(COPY_PREFIX))
      .forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // Sem armazenamento: nada a limpar.
  }
}
