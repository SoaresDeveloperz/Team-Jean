import { RESUME_WINDOW_MS } from './workouts'

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

export function clearActiveSession() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignora: nada a limpar.
  }
}
