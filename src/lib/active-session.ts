import { RESUME_WINDOW_MS } from './workouts'
import { SHORT_STORAGE_KEY } from './short-workout'
import { PAIN_STORAGE_KEY, SWAP_STORAGE_KEY } from './swap-exercise'

// Treino em andamento guardado no aparelho. A tabela workout_sessions não tem
// coluna com a hora de início, então é aqui que fica o horário usado para
// retomar o treino (até 12h) e calcular a duração.
const STORAGE_KEY = 'team-jean:active-session'

export type ActiveSession = {
  userId: string
  workoutId: string
  sessionId: string
  startedAt: number
}

export function readActiveSession(userId: string): ActiveSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as Partial<ActiveSession>
    const valid =
      session.userId === userId &&
      typeof session.workoutId === 'string' &&
      typeof session.sessionId === 'string' &&
      typeof session.startedAt === 'number' &&
      Date.now() - session.startedAt < RESUME_WINDOW_MS
    return valid ? (session as ActiveSession) : null
  } catch {
    return null
  }
}

export function saveActiveSession(session: ActiveSession) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Sem armazenamento local (aba anônima): só não dá para retomar depois.
  }
}

// keepShort: ao carregar a tela, a sessão antiga sem séries sai, mas a escolha da
// versão curta (por treino e dia) continua valendo.
export function clearActiveSession(keepShort = false) {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    window.localStorage.removeItem(JOURNAL_KEY)
    if (!keepShort) {
      window.localStorage.removeItem(DRAFT_KEY)
      window.localStorage.removeItem(SHORT_STORAGE_KEY)
      window.localStorage.removeItem(SWAP_STORAGE_KEY)
      window.localStorage.removeItem(PAIN_STORAGE_KEY)
    }
  } catch {
    // Ignora: nada a limpar.
  }
}

// Diário das séries marcadas neste aparelho: retoma o treino mesmo sem
// internet (o servidor continua sendo a fonte quando há conexão).
const JOURNAL_KEY = 'team-jean:active-session-sets'

export type JournalSet = {
  id: string
  assigned_exercise_id: string | null
  set_number: number
  weight_kg: number | null
  reps: number | null
}

export function readSessionJournal(sessionId: string): JournalSet[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(JOURNAL_KEY) ?? 'null') as { sessionId?: string; sets?: JournalSet[] } | null
    return parsed?.sessionId === sessionId && Array.isArray(parsed.sets) ? parsed.sets : []
  } catch {
    return []
  }
}

export function saveSessionJournal(sessionId: string, sets: JournalSet[]) {
  try {
    window.localStorage.setItem(JOURNAL_KEY, JSON.stringify({ sessionId, sets }))
  } catch {
    // Sem armazenamento: sem internet não dá para retomar, só isso.
  }
}

// Rascunho do treino: o que o aluno digitou e ainda não confirmou (peso e repetições antes do ✓,
// nota de esforço, recado e etiquetas do fim do treino). Salva sozinho a cada mudança, só neste aparelho,
// para uma queda de internet, um recarregamento ou o sistema fechando o app não perderem nada.
const DRAFT_KEY = 'team-jean:workout-draft'

export type WorkoutDraft = {
  userId: string
  workoutId: string
  // Dia local (aaaa-mm-dd): rascunho de ontem não vale hoje.
  day: string
  // Por linha do treino, peso e repetições de cada série ainda não marcada ('' = nada digitado).
  inputs: Record<string, { weight: string; reps: string }[]>
  rpe: number | null
  feedback: string
  tags: string[]
}

export function readWorkoutDraft(userId: string, workoutId: string, day: string): WorkoutDraft | null {
  try {
    const draft = JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? 'null') as Partial<WorkoutDraft> | null
    if (!draft || draft.userId !== userId || draft.workoutId !== workoutId || draft.day !== day) return null
    if (typeof draft.inputs !== 'object' || draft.inputs === null) return null
    return {
      userId,
      workoutId,
      day,
      inputs: draft.inputs as WorkoutDraft['inputs'],
      rpe: typeof draft.rpe === 'number' ? draft.rpe : null,
      feedback: typeof draft.feedback === 'string' ? draft.feedback : '',
      tags: Array.isArray(draft.tags) ? draft.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    }
  } catch {
    return null
  }
}

// draft = null (ou vazio) apaga o rascunho.
export function saveWorkoutDraft(draft: WorkoutDraft | null) {
  try {
    if (!draft) window.localStorage.removeItem(DRAFT_KEY)
    else window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // Sem armazenamento (aba anônima): só não há rascunho.
  }
}
