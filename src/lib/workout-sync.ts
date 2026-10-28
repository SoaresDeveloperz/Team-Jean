'use client'

// Fila de gravações do treino. Cada série marcada vira uma operação guardada
// no aparelho e enviada ao Supabase em ordem; sem internet a fila espera e
// reenvia sozinha quando a conexão volta. Os ids são gerados no aparelho, então
// reenviar nunca duplica (23505 = já estava gravado).
import { useSyncExternalStore } from 'react'
import type { createClient } from './supabase/client'

type Supabase = ReturnType<typeof createClient>

export type QueuedSession = { id: string; assigned_workout_id: string; student_id: string; status: 'in_progress' }
export type QueuedSet = {
  id: string
  session_id: string
  exercise_id: string
  assigned_exercise_id: string | null
  set_number: number
  weight_kg: number
  reps: number
  rir: number | null
  set_type: string
  completed: true
}
export type FinishPatch = {
  completed_at: string
  session_rpe: number
  status: 'completed'
  feedback?: string | null
  feedback_tags?: string[]
  // Treino feito na versão curta (supabase/treino-curto.sql).
  short_mode?: boolean
}

export type SyncOp =
  | { kind: 'session'; row: QueuedSession }
  | { kind: 'set'; row: QueuedSet }
  | { kind: 'unset'; id: string; sessionId: string }
  | { kind: 'finish'; sessionId: string; patch: FinishPatch }

type Snapshot = {
  userId: string | null
  ops: SyncOp[]
  syncing: boolean
  // A última tentativa falhou por falta de conexão.
  offline: boolean
  // Algo foi recusado pelo servidor (não adianta reenviar).
  issue: string | null
  // Treino finalizado e enviado depois de ficar na fila.
  delivered: number
}

const EMPTY: Snapshot = { userId: null, ops: [], syncing: false, offline: false, issue: null, delivered: 0 }
const storageKey = (userId: string) => `team-jean:fila-treino:${userId}`

let snapshot: Snapshot = EMPTY
let flushing: Promise<void> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryDelay = 4_000
let client: Supabase | null = null
let listening = false
const listeners = new Set<() => void>()

function emit(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch }
  listeners.forEach((listener) => listener())
}

function persist() {
  if (!snapshot.userId) return
  try {
    if (snapshot.ops.length === 0) window.localStorage.removeItem(storageKey(snapshot.userId))
    else window.localStorage.setItem(storageKey(snapshot.userId), JSON.stringify(snapshot.ops))
  } catch {
    // Sem armazenamento (aba anônima): a fila vale até fechar a aba.
  }
}

function readOps(userId: string): SyncOp[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(userId)) ?? '[]') as SyncOp[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function bindUser(userId: string) {
  if (snapshot.userId === userId) return
  snapshot = { ...EMPTY, userId, ops: readOps(userId) }
}

function listen() {
  if (listening || typeof window === 'undefined') return
  listening = true
  const kick = () => {
    retryDelay = 4_000
    void flushWorkoutQueue()
  }
  window.addEventListener('online', kick)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') kick()
  })
}

function scheduleRetry() {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = setTimeout(() => {
    retryTimer = null
    void flushWorkoutQueue()
  }, retryDelay)
  retryDelay = Math.min(retryDelay * 2, 60_000)
}

type Result = { error: { code?: string; message?: string } | null; status: number; data?: unknown }

// Sem conexão (status 0), servidor instável (5xx), limite (429) ou token
// vencido durante o tempo offline (401): tenta de novo depois.
function isTransient(result: Result) {
  return result.status === 0 || result.status >= 500 || result.status === 429 || result.status === 408 || result.status === 401
}

type Outcome = 'ok' | 'retry' | { drop: string }

async function send(supabase: Supabase, op: SyncOp): Promise<Outcome> {
  if (op.kind === 'session' || op.kind === 'set') {
    const result = (op.kind === 'session'
      ? await supabase.from('workout_sessions').insert(op.row)
      : await supabase.from('session_sets').insert(op.row)) as Result
    if (!result.error || result.error.code === '23505') return 'ok'
    if (isTransient(result)) return 'retry'
    return { drop: result.error.message ?? 'erro desconhecido' }
  }
  if (op.kind === 'unset') {
    const result = (await supabase.from('session_sets').delete().eq('id', op.id)) as Result
    if (!result.error) return 'ok'
    if (isTransient(result)) return 'retry'
    return { drop: result.error.message ?? 'erro desconhecido' }
  }
  const update = (patch: Partial<FinishPatch>) =>
    supabase.from('workout_sessions').update(patch).eq('id', op.sessionId).select('id') as unknown as Promise<Result>
  let result = await update(op.patch)
  // Sem o treino-curto.sql não existe a coluna short_mode: salva o treino sem ela
  // (nunca trava a fila por causa disso).
  let patch = op.patch
  if (result.error?.code === 'PGRST204' && 'short_mode' in patch && /short_mode/.test(result.error.message ?? '')) {
    const withoutShort: Partial<FinishPatch> = { ...patch }
    delete withoutShort.short_mode
    patch = withoutShort as FinishPatch
    result = await update(patch)
  }
  // Sem o gestao.sql não existem as colunas do recado: salva o treino sem ele.
  if (result.error?.code === 'PGRST204' && ('feedback' in patch || 'feedback_tags' in patch)) {
    const withoutFeedback: Partial<FinishPatch> = { ...patch }
    delete withoutFeedback.feedback
    delete withoutFeedback.feedback_tags
    result = await update(withoutFeedback)
  }
  if (result.error) return isTransient(result) ? 'retry' : { drop: result.error.message ?? 'erro desconhecido' }
  if (!Array.isArray(result.data) || result.data.length === 0) return { drop: 'a sessão do treino não foi encontrada no servidor' }
  return 'ok'
}

export function flushWorkoutQueue(): Promise<void> {
  const supabase = client
  if (!supabase || !snapshot.userId) return Promise.resolve()
  if (flushing) return flushing

  flushing = (async () => {
    if (snapshot.ops.length === 0) return
    emit({ syncing: true })
    // Renova o login se ele venceu enquanto o aparelho estava sem internet. Se
    // outra pessoa entrou no aparelho, a fila espera o dono voltar.
    const owner = snapshot.userId
    const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
    if (!data.session || data.session.user.id !== owner) return
    while (snapshot.ops.length > 0 && snapshot.userId === owner) {
      const op = snapshot.ops[0]
      let outcome: Outcome
      try {
        outcome = await send(supabase, op)
      } catch {
        outcome = 'retry'
      }
      if (outcome === 'retry') {
        emit({ offline: true })
        scheduleRetry()
        return
      }
      const delivered = op.kind === 'finish' && outcome === 'ok' ? snapshot.delivered + 1 : snapshot.delivered
      snapshot = { ...snapshot, ops: snapshot.ops.filter((item) => item !== op) }
      persist()
      emit({
        offline: false,
        delivered,
        issue: outcome === 'ok' ? snapshot.issue : `Não foi possível salvar no servidor: ${outcome.drop}`,
      })
    }
    retryDelay = 4_000
  })().finally(() => {
    flushing = null
    emit({ syncing: false })
  })
  return flushing
}

// Liga a fila ao usuário logado e tenta enviar o que ficou pendente.
export function startWorkoutSync(supabase: Supabase, userId: string) {
  client = supabase
  bindUser(userId)
  listen()
  emit({})
  return flushWorkoutQueue()
}

export function enqueueWorkoutOp(supabase: Supabase, userId: string, op: SyncOp) {
  client = supabase
  bindUser(userId)
  listen()
  let ops = snapshot.ops
  // A operação em envio não pode sair da fila no meio do caminho.
  const inFlight = flushing ? ops[0] : undefined
  if (op.kind === 'unset') {
    // A série ainda não tinha subido: basta tirá-la da fila.
    const pending = ops.find((item) => item.kind === 'set' && item.row.id === op.id)
    if (pending && pending !== inFlight) ops = ops.filter((item) => item !== pending)
    else ops = [...ops, op]
  } else if (op.kind === 'finish') {
    ops = [...ops.filter((item) => item === inFlight || !(item.kind === 'finish' && item.sessionId === op.sessionId)), op]
  } else {
    ops = [...ops, op]
  }
  snapshot = { ...snapshot, ops }
  persist()
  emit({})
  return flushWorkoutQueue()
}

export function clearSyncIssue() {
  emit({ issue: null })
}

export function getWorkoutSyncState() {
  return snapshot
}

// Ainda há algo desta sessão esperando para subir?
export function sessionPending(state: Pick<Snapshot, 'ops'>, sessionId: string) {
  return state.ops.some((op) =>
    op.kind === 'session' ? op.row.id === sessionId : op.kind === 'set' ? op.row.session_id === sessionId : op.sessionId === sessionId,
  )
}

export const hasQueuedOps = (sessionId: string) => sessionPending(snapshot, sessionId)

function subscribeOnline(listener: () => void) {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

// Conexão segundo o navegador (no servidor, considera online).
export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  )
}

// O que a fila ainda tem desta sessão (para retomar o treino sem internet).
export function queuedSessionState(userId: string, sessionId: string) {
  bindUser(userId)
  const created = snapshot.ops.some((op) => op.kind === 'session' && op.row.id === sessionId)
  const sets = snapshot.ops.flatMap((op) => (op.kind === 'set' && op.row.session_id === sessionId ? [op.row] : []))
  const removed = new Set(snapshot.ops.flatMap((op) => (op.kind === 'unset' && op.sessionId === sessionId ? [op.id] : [])))
  return { created, sets, removed }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useWorkoutSync() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  )
}

// Ids das séries que ainda não chegaram ao servidor.
export function pendingSetIds(state: Snapshot) {
  return new Set(state.ops.flatMap((op) => (op.kind === 'set' ? [op.row.id] : [])))
}

// Ids gerados no aparelho (o treino segue sem internet e a fila reenvia sem duplicar).
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
