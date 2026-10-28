// "Trocar exercício": quais opções o aluno vê no lugar de um exercício do
// treino. Contas puras, sem dependências (nem alias "@/"), testadas direto no
// Node (tests/contas-trocar.mjs).
//
// Regras:
// - as alternativas que o treinador marcou vêm primeiro e sempre valem;
// - sem alternativas marcadas, o app sugere exercícios do mesmo grupo muscular;
// - exercício "essencial" só troca por alternativa do treinador (nunca por
//   sugestão automática);
// - nunca oferece o próprio exercício nem um que já está no treino de hoje;
// - no máximo 3 opções, para o aluno decidir com um toque.

export type SwapLibraryItem = { id: string; name: string; muscle_group?: string | null; media_id?: string | null }

export type SwapOption = { id: string; name: string; muscle_group: string | null; source: 'jean' | 'app' }

export const SWAP_MAX_OPTIONS = 3
// Alternativas que o treinador pode marcar por exercício.
export const SWAP_MAX_ALTERNATIVES = 5

const normalize = (text: string | null | undefined) =>
  (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

type SwapInput = {
  // Exercício que está no treino (o prescrito).
  original: { exercise_id: string; muscle_group?: string | null }
  essential?: boolean | null
  // Ids marcados pelo treinador (podem apontar para exercícios que já não existem).
  alternatives?: string[] | null
  library: SwapLibraryItem[]
  // Exercícios que já estão no treino de hoje (inclusive os já trocados).
  taken: ReadonlySet<string>
}

export function swapOptions({ original, essential, alternatives, library, taken }: SwapInput): SwapOption[] {
  const byId = new Map(library.map((item) => [item.id, item]))
  const blocked = (id: string) => id === original.exercise_id || taken.has(id)
  const options: SwapOption[] = []
  const seen = new Set<string>()
  const push = (item: SwapLibraryItem, source: SwapOption['source']) => {
    if (options.length >= SWAP_MAX_OPTIONS || seen.has(item.id) || blocked(item.id) || !item.name?.trim()) return
    seen.add(item.id)
    options.push({ id: item.id, name: item.name, muscle_group: item.muscle_group ?? null, source })
  }

  for (const id of alternatives ?? []) {
    const item = byId.get(id)
    if (item) push(item, 'jean')
  }
  if (essential) return options

  const group = normalize(original.muscle_group)
  if (!group) return options
  const sameGroup = library
    .filter((item) => normalize(item.muscle_group) === group)
    // Com GIF primeiro (o aluno vê o movimento), depois por nome.
    .sort((a, b) => Number(Boolean(b.media_id)) - Number(Boolean(a.media_id)) || a.name.localeCompare(b.name, 'pt-BR'))
  for (const item of sameGroup) push(item, 'app')
  return options
}

// O botão "Trocar" só aparece com opção e antes de qualquer série do exercício ser feita.
export function canOfferSwap(options: SwapOption[], completedSets: number) {
  return options.length > 0 && completedSets === 0
}

// Estado guardado no aparelho: vale só para este treino e neste dia.
export type SwapState = { workoutId: string; day: string; swaps: Record<string, string> }

export const SWAP_STORAGE_KEY = 'team-jean:trocas'

// Lê o que foi guardado; descarta outro treino, outro dia, linha que não existe
// mais e exercício que não está mais na biblioteca.
export function parseSwapState(
  raw: string | null,
  workoutId: string,
  day: string,
  validRows: string[],
  validExercises: string[],
): Record<string, string> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Partial<SwapState>
    if (parsed.workoutId !== workoutId || parsed.day !== day || typeof parsed.swaps !== 'object' || parsed.swaps === null) return {}
    const clean: Record<string, string> = {}
    for (const [rowId, exerciseId] of Object.entries(parsed.swaps)) {
      if (typeof exerciseId === 'string' && validRows.includes(rowId) && validExercises.includes(exerciseId)) clean[rowId] = exerciseId
    }
    return clean
  } catch {
    return {}
  }
}

// "Estou trocando por causa de dor": guardado para o recado "Senti dor" não se
// perder se a tela recarregar. Só treino e dia, nada de texto.
export const PAIN_STORAGE_KEY = 'team-jean:trocas-dor'

export function parsePainFlag(raw: string | null, workoutId: string, day: string): boolean {
  try {
    const parsed = JSON.parse(raw ?? 'null') as { workoutId?: string; day?: string } | null
    return parsed?.workoutId === workoutId && parsed?.day === day
  } catch {
    return false
  }
}
