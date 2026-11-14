// Contas da aba de nutrição (alimentos por 100 g da TACO e os cadastrados pelo treinador).
// Puras e sem imports do app: rodam no Node (tests/contas-nutricao.mjs). É a única
// fonte dos totais: a tela do treinador e a do aluno usam estas mesmas funções.

export type Nutrient = 'kcal' | 'protein_g' | 'fat_g' | 'carb_g' | 'fiber_g' | 'sodium_mg' | 'cholesterol_mg'

export const NUTRIENTS: Nutrient[] = ['kcal', 'protein_g', 'fat_g', 'carb_g', 'fiber_g', 'sodium_mg', 'cholesterol_mg']

// null = sem dado (NA da TACO ou não informado). Nunca é o mesmo que zero.
export type Food = { id: string; name: string; group_name: string | null } & Record<Nutrient, number | null>

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
