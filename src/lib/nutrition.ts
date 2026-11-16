// Contas da aba de nutrição (alimentos por 100 g da TACO e os cadastrados pelo treinador).
// Puras e sem imports do app: rodam no Node (tests/contas-nutricao.mjs). É a única
// fonte dos totais: a tela do treinador e a do aluno usam estas mesmas funções.

export type Nutrient = 'kcal' | 'protein_g' | 'fat_g' | 'carb_g' | 'fiber_g' | 'sodium_mg' | 'cholesterol_mg'

export const NUTRIENTS: Nutrient[] = ['kcal', 'protein_g', 'fat_g', 'carb_g', 'fiber_g', 'sodium_mg', 'cholesterol_mg']

// null = sem dado (célula em branco ou "*" da TACO, ou não informado). Nunca é o mesmo que zero;
// o "NA" (não aplicável) e o traço da TACO já entram como 0.
export type Food = { id: string; name: string; group_name: string | null; micros?: Record<string, number> } & Record<Nutrient, number | null>

export type PlanItem = { food: Food; grams: number }

export type Totals = {
  values: Record<Nutrient, number>
  // Nutrientes em que algum item não tinha dado: a tela mostra "parcial", nunca "0" como certeza.
  incomplete: Nutrient[]
}

// Quantidade de um nutriente em tantos gramas do alimento (null quando o alimento não tem o dado).
export function nutrientIn(food: Food, nutrient: Nutrient, grams: number): number | null {
  const per100 = food[nutrient]
  if (per100 === null || per100 === undefined || !Number.isFinite(grams) || grams < 0) return null
  return (per100 * grams) / 100
}

// Soma dos itens. Item sem dado conta 0 no total, mas o nutriente entra em "incomplete".
export function sumItems(items: PlanItem[]): Totals {
  const values = Object.fromEntries(NUTRIENTS.map((nutrient) => [nutrient, 0])) as Record<Nutrient, number>
  const incomplete = new Set<Nutrient>()
  for (const { food, grams } of items) {
    for (const nutrient of NUTRIENTS) {
      const amount = nutrientIn(food, nutrient, grams)
      if (amount === null) incomplete.add(nutrient)
      else values[nutrient] += amount
    }
  }
  return { values, incomplete: NUTRIENTS.filter((nutrient) => incomplete.has(nutrient)) }
}

// Arredonda só para mostrar: kcal e miligramas inteiros, gramas com uma casa.
export function formatNutrient(nutrient: Nutrient, value: number): string {
  const decimals = nutrient === 'protein_g' || nutrient === 'fat_g' || nutrient === 'carb_g' || nutrient === 'fiber_g' ? 1 : 0
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: decimals }).format(value)
}

// Número digitado pelo treinador: "12", "12,5" ou "12.5". Vazio, letras, "1e3", "0x10" e negativo viram null.
export function parseAmount(text: string): number | null {
  const clean = text.trim()
  return /^\d+(?:[.,]\d+)?$/.test(clean) ? Number(clean.replace(',', '.')) : null
}

const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

// Busca por nome sem acento e sem ligar para maiúsculas: quem começa com o texto vem primeiro,
// depois quem só contém. Devolve no máximo "limit" alimentos (a lista inteira pesa no celular fraco).
export function searchFoods<T extends { name: string }>(foods: T[], query: string, limit = 30): T[] {
  const words = plain(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const starts: T[] = []
  const contains: T[] = []
  for (const food of foods) {
    const name = plain(food.name)
    if (!words.every((word) => name.includes(word))) continue
    ;(name.startsWith(words[0]) ? starts : contains).push(food)
  }
  return [...starts, ...contains].slice(0, limit)
}

// ---- Fibra, sódio, colesterol, minerais e vitaminas ("Vitaminas e minerais do dia") -------------
// Fibra, sódio e colesterol são colunas do alimento; o resto fica em "micros" (a unidade vai no nome da chave).
// Chave ausente = sem dado (célula em branco da TACO); 0 é zero de verdade (NA e traço).
export type DetailGroup = 'label' | 'mineral' | 'vitamin'
export type DetailField = { id: string; label: string; technical?: string; unit: 'g' | 'mg' | 'µg'; group: DetailGroup; column?: Nutrient }

export const DETAIL_FIELDS: DetailField[] = [
  { id: 'fiber_g', column: 'fiber_g', label: 'Fibra', unit: 'g', group: 'label' },
  { id: 'sodium_mg', column: 'sodium_mg', label: 'Sódio', unit: 'mg', group: 'label' },
  { id: 'cholesterol_mg', column: 'cholesterol_mg', label: 'Colesterol', unit: 'mg', group: 'label' },
  { id: 'ca_mg', label: 'Cálcio', unit: 'mg', group: 'mineral' },
  { id: 'fe_mg', label: 'Ferro', unit: 'mg', group: 'mineral' },
  { id: 'k_mg', label: 'Potássio', unit: 'mg', group: 'mineral' },
  { id: 'mg_mg', label: 'Magnésio', unit: 'mg', group: 'mineral' },
  { id: 'zn_mg', label: 'Zinco', unit: 'mg', group: 'mineral' },
  { id: 'p_mg', label: 'Fósforo', unit: 'mg', group: 'mineral' },
  { id: 'cu_mg', label: 'Cobre', unit: 'mg', group: 'mineral' },
  { id: 'mn_mg', label: 'Manganês', unit: 'mg', group: 'mineral' },
  { id: 'c_mg', label: 'Vitamina C', unit: 'mg', group: 'vitamin' },
  { id: 'rae_ug', label: 'Vitamina A', technical: 'RAE', unit: 'µg', group: 'vitamin' },
  { id: 'b1_mg', label: 'Vitamina B1', technical: 'tiamina', unit: 'mg', group: 'vitamin' },
  { id: 'b2_mg', label: 'Vitamina B2', technical: 'riboflavina', unit: 'mg', group: 'vitamin' },
  { id: 'b3_mg', label: 'Vitamina B3', technical: 'niacina', unit: 'mg', group: 'vitamin' },
  { id: 'b6_mg', label: 'Vitamina B6', technical: 'piridoxina', unit: 'mg', group: 'vitamin' },
]

export const DETAIL_GROUP_LABELS: Record<DetailGroup, string> = { label: 'Do rótulo', mineral: 'Minerais', vitamin: 'Vitaminas' }

export type DetailTotal = {
  field: DetailField
  value: number
  // Em quantos itens o dado existe, de quantos no total.
  known: number
  total: number
}

const detailAmount = (food: Food, field: DetailField): number | null => {
  const per100 = field.column ? food[field.column] : (food.micros?.[field.id] ?? null)
  return per100 === null || per100 === undefined ? null : per100
}

// Soma de cada campo de detalhe nos itens. Quem não tem o dado conta 0 na soma, mas aparece em
// "known < total" (a tela mostra "parcial"); sem dado em nenhum item, known = 0 (a tela esconde ou diz "sem dado").
export function sumDetails(items: PlanItem[]): DetailTotal[] {
  return DETAIL_FIELDS.map((field) => {
    let value = 0
    let known = 0
    for (const { food, grams } of items) {
      const per100 = detailAmount(food, field)
      if (per100 === null || !Number.isFinite(grams) || grams < 0) continue
      known += 1
      value += (per100 * grams) / 100
    }
    return { field, value, known, total: items.length }
  })
}

// Número curto para vitaminas e minerais: quanto menor o valor, mais casas (0,63 mg; 12,4 mg; 1.234 mg).
export function formatMicro(value: number): string {
  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: decimals }).format(value)
}
