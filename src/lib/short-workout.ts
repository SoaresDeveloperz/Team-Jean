// "Tenho pouco tempo": versão curta do treino de hoje. Contas puras, sem
// dependências (nem alias "@/"), testadas direto no Node (tests/contas-curto.mjs).
//
// A versão curta só muda o que a tela mostra: a prescrição do treinador, as
// séries (`sets`) e os ids da fila do aparelho continuam intactos. Por isso o
// corte é calculado aqui e aplicado só na hora de desenhar.

export type ShortSet = { type: string; completed: boolean; extra: boolean }
// essential: o treinador marcou o exercício como essencial (nunca sai da versão curta).
export type ShortRow = { id: string; name: string; sets: ShortSet[]; essential?: boolean }

// Meta de duração da versão curta e a partir de quanto o treino "passa do tempo".
export const SHORT_TARGET_MINUTES = 20
export const SHORT_OFFER_MINUTES = 30
// Séries "de trabalho" mantidas por exercício; aquecimento e série principal ficam sempre.
export const SHORT_SET_CAP = 2
// Pelo menos estes exercícios ficam, mesmo estourando a meta.
const MIN_EXERCISES = 2

// Mesma conta do resumo do treino (src/lib/workout-summary.ts): ~40 s de execução
// e 90 s de descanso por série, mais 1 min de troca por exercício, em blocos de 5 min.
export function minutesFor(sets: number, exercises: number) {
  if (sets === 0) return 0
  return Math.max(5, Math.round((sets * 130 + exercises * 60) / 300) * 5)
}

const ALWAYS_KEPT = new Set(['warmup', 'top'])

// Posições (na lista original) das séries que a versão curta esconde. Nunca
// esconde série concluída nem série extra do aluno; aquecimento e série
// principal ficam; das demais ficam as `cap` primeiras.
export function hiddenSetIndexes(sets: ShortSet[], cap: number): Set<number> {
  const hidden = new Set<number>()
  let working = 0
  sets.forEach((entry, index) => {
    if (entry.extra || ALWAYS_KEPT.has(entry.type)) return
    working += 1
    if (working > cap && !entry.completed) hidden.add(index)
  })
  return hidden
}

export function visibleSetCount(sets: ShortSet[], cap: number | null) {
  return cap === null ? sets.length : sets.length - hiddenSetIndexes(sets, cap).size
}

// Duração estimada do treino inteiro.
export function fullMinutes(rows: ShortRow[]) {
  return minutesFor(
    rows.reduce((sum, row) => sum + row.sets.length, 0),
    rows.length,
  )
}

// Duração estimada mantendo só os exercícios que não estão em `hidden`.
export function shortMinutes(rows: ShortRow[], hidden: ReadonlySet<string>, cap = SHORT_SET_CAP) {
  const kept = rows.filter((row) => !hidden.has(row.id))
  return minutesFor(
    kept.reduce((sum, row) => sum + visibleSetCount(row.sets, cap), 0),
    kept.length,
  )
}

// O botão só aparece quando o treino passa do tempo (um treino de ~20 min não tem o que cortar).
export function canOfferShort(rows: ShortRow[]) {
  return rows.length > MIN_EXERCISES && fullMinutes(rows) > SHORT_OFFER_MINUTES
}

// Regra padrão: os essenciais (marcados pelo treinador) ficam sempre; depois os
// exercícios entram na ordem do treino enquanto couberem na meta (com `cap`
// séries de trabalho cada), no mínimo MIN_EXERCISES. O aluno pode mudar a
// escolha no painel ("Manter"), menos os essenciais.
export function planShort(rows: ShortRow[], targetMinutes = SHORT_TARGET_MINUTES, cap = SHORT_SET_CAP) {
  const keep: string[] = []
  const leave: string[] = []
  const essentials = rows.filter((row) => row.essential)
  let sets = essentials.reduce((sum, row) => sum + visibleSetCount(row.sets, cap), 0)
  let kept = essentials.length
  let stopped = false
  for (const row of rows) {
    if (row.essential) {
      keep.push(row.id)
      continue
    }
    const next = sets + visibleSetCount(row.sets, cap)
    const fits = (next * 130 + (kept + 1) * 60) / 60 <= targetMinutes
    if (!stopped && (fits || kept < MIN_EXERCISES)) {
      keep.push(row.id)
      sets = next
      kept += 1
    } else {
      stopped = true
      leave.push(row.id)
    }
  }
  return { keep, leave }
}

// Estado guardado no aparelho: vale só para este treino e neste dia.
export type ShortState = { workoutId: string; day: string; hidden: string[]; cap: number }

export function parseShortState(raw: string | null, workoutId: string, day: string, validRows: string[]): ShortState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ShortState>
    const valid =
      parsed.workoutId === workoutId &&
      parsed.day === day &&
      typeof parsed.cap === 'number' &&
      Number.isInteger(parsed.cap) &&
      parsed.cap >= 1 &&
      parsed.cap <= 10 &&
      Array.isArray(parsed.hidden) &&
      parsed.hidden.every((id) => typeof id === 'string' && validRows.includes(id))
    return valid ? (parsed as ShortState) : null
  } catch {
    return null
  }
}

export const SHORT_STORAGE_KEY = 'team-jean:treino-curto'

// Dia local (AAAA-MM-DD) do aparelho (o mesmo relógio que o aluno vê); a versão
// curta não passa para o dia seguinte.
export function localDay(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
