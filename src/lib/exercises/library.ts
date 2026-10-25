// Biblioteca de exercícios com GIFs (public/exercicios/biblioteca.json, gerada
// por scripts/gerar-biblioteca-exercicios.mjs). Carregada sob demanda, só
// quando o treinador abre a busca: não entra no código do app.
//
// Sem dependências nem alias "@/": o teste em Node importa este arquivo direto.

export type LibraryItem = {
  id: string
  media: string
  nome: string
  nome_en: string
  grupo: string
  equipamento: string
  musculo_alvo: string
  credito: string
}

export type LibraryIndex = {
  credito: string
  total: number
  grupos: { grupo: string; passos: string; total: number }[]
  itens: LibraryItem[]
}

export const LIBRARY_URL = '/exercicios/biblioteca.json'
export const LIBRARY_PAGE_SIZE = 20
export const ANY = 'Todos'

let cached: Promise<LibraryIndex> | null = null

export function loadExerciseLibrary(fetcher: typeof fetch = fetch): Promise<LibraryIndex> {
  cached ??= fetcher(LIBRARY_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`biblioteca ${response.status}`)
      return response.json() as Promise<LibraryIndex>
    })
    .then((index) => {
      if (!index || !Array.isArray(index.itens)) throw new Error('biblioteca inválida')
      return index
    })
    .catch((error) => {
      // Sem internet ou arquivo fora do ar: a próxima abertura tenta de novo.
      cached = null
      throw error
    })
  return cached
}

export const normalizeSearch = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export type LibraryFilters = { term?: string; group?: string; equipment?: string }

// Todas as palavras precisam aparecer no nome (português ou inglês), no grupo,
// no equipamento ou no músculo-alvo. "supino halter" acha "Supino Inclinado
// com Halteres". Os que começam pelo termo vêm antes e, entre eles, os nomes
// mais curtos (o movimento básico antes das variações).
export function searchLibrary(items: readonly LibraryItem[], { term = '', group = ANY, equipment = ANY }: LibraryFilters) {
  const words = normalizeSearch(term).split(' ').filter(Boolean)
  const query = words.join(' ')
  const matches = items.filter((item) => {
    if (group !== ANY && item.grupo !== group) return false
    if (equipment !== ANY && item.equipamento !== equipment) return false
    if (words.length === 0) return true
    const haystack = normalizeSearch(`${item.nome} ${item.nome_en} ${item.grupo} ${item.equipamento} ${item.musculo_alvo}`)
    return words.every((word) => haystack.includes(word))
  })
  if (!query) return matches
  const rank = (item: LibraryItem) => {
    const name = normalizeSearch(item.nome)
    if (name === query) return 0
    if (name.startsWith(query)) return 1
    return normalizeSearch(item.nome_en).startsWith(query) ? 2 : 3
  }
  return matches
    .map((item, index) => ({ item, index, rank: rank(item) }))
    .sort((a, b) => a.rank - b.rank || a.item.nome.length - b.item.nome.length || a.index - b.index)
    .map(({ item }) => item)
}

export function equipmentOptions(items: readonly LibraryItem[], group = ANY) {
  const counts = new Map<string, number>()
  for (const item of items) {
    if (group !== ANY && item.grupo !== group) continue
    counts.set(item.equipamento, (counts.get(item.equipamento) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')).map(([name]) => name)
}
