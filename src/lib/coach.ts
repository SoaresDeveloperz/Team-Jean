// Ferramentas do treinador: notas privadas por aluno, desafios da equipe e
// avisos rápidos. Tabelas e permissões em supabase/coach.sql.
import type { createClient } from './supabase/client'
import { formatKg } from './workouts'
import { plural } from './text'
import { requestPushDelivery } from './push/client'

type Supabase = ReturnType<typeof createClient>
type DbError = { code?: string; message?: string } | null | undefined

export const NOTE_MAX = 1000

export type CoachNote = {
  id: string
  student_id: string
  author_id: string
  body: string
  pinned: boolean
  created_at: string
}

export type ChallengeMetric = 'workouts' | 'volume' | 'active_days'

export type Challenge = {
  id: string
  title: string
  description: string | null
  metric: ChallengeMetric
  goal: number
  starts_on: string
  ends_on: string
  created_at: string
}

export type Standing = { user_id: string; full_name: string; avatar_path: string | null; progress: number }

export const METRICS: { value: ChallengeMetric; label: string; unit: string; hint: string }[] = [
  { value: 'workouts', label: 'Treinos', unit: 'treinos', hint: 'Treinos concluídos no período' },
  { value: 'active_days', label: 'Dias ativos', unit: 'dias', hint: 'Dias diferentes com treino' },
  { value: 'volume', label: 'Volume', unit: 'kg', hint: 'Soma de carga × repetições' },
]

export const metricInfo = (metric: ChallengeMetric) => METRICS.find((item) => item.value === metric) ?? METRICS[0]

export function formatProgress(metric: ChallengeMetric, value: number) {
  if (metric === 'volume') return `${formatKg(Math.round(value))} kg`
  if (metric === 'active_days') return plural(Math.round(value), 'dia', 'dias')
  return plural(Math.round(value), 'treino', 'treinos')
}

// Sem o coach.sql, o Supabase responde "tabela/função não existe".
export function isCoachSetupMissing(error: DbError) {
  if (!error) return false
  if (['PGRST205', 'PGRST202', '42P01', '42883'].includes(error.code ?? '')) return true
  return /schema cache|does not exist/i.test(error.message ?? '')
}

export class CoachError extends Error {
  readonly missing: boolean

  constructor(message: string, missing = false) {
    super(message)
    this.missing = missing
  }
}

function fail(prefix: string, error: NonNullable<DbError>): never {
  throw new CoachError(`${prefix}: ${error.message ?? 'erro desconhecido'}`, isCoachSetupMissing(error))
}

// ------------------------------------------------------------------ datas
// "2026-10-20" no fuso do aparelho (o banco calcula no horário de Brasília).
export function isoDay(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export const dayFromIso = (value: string) => new Date(`${value}T12:00:00`)

export function challengeStatus(challenge: Pick<Challenge, 'starts_on' | 'ends_on'>, today = isoDay(new Date())) {
  if (today < challenge.starts_on) return 'upcoming' as const
  if (today > challenge.ends_on) return 'ended' as const
  return 'active' as const
}

export function daysLeft(challenge: Pick<Challenge, 'ends_on'>, now = new Date()) {
  const end = dayFromIso(challenge.ends_on)
  const today = dayFromIso(isoDay(now))
  return Math.max(0, Math.round((end.getTime() - today.getTime()) / 86_400_000))
}

// ------------------------------------------------------------------ notas
export async function loadNotes(supabase: Supabase, studentId: string) {
  const { data, error } = await supabase
    .from('coach_notes')
    .select('*')
    .eq('student_id', studentId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) fail('Não foi possível carregar as notas', error)
  return (data ?? []) as CoachNote[]
}

export async function addNote(supabase: Supabase, studentId: string, authorId: string, body: string) {
  const { data, error } = await supabase
    .from('coach_notes')
    .insert({ student_id: studentId, author_id: authorId, body: body.trim() })
    .select('*')
    .single()
  if (error) fail('Não foi possível salvar a nota', error)
  return data as CoachNote
}

export async function setNotePinned(supabase: Supabase, noteId: string, pinned: boolean) {
  const { error } = await supabase.from('coach_notes').update({ pinned }).eq('id', noteId)
  if (error) fail('Não foi possível fixar a nota', error)
}

export async function deleteNote(supabase: Supabase, noteId: string) {
  const { error } = await supabase.from('coach_notes').delete().eq('id', noteId)
  if (error) fail('Não foi possível apagar a nota', error)
}

// -------------------------------------------------------------- desafios
export async function loadChallenges(supabase: Supabase) {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .order('ends_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) fail('Não foi possível carregar os desafios', error)
  return ((data ?? []) as Challenge[]).map((challenge) => ({ ...challenge, goal: Number(challenge.goal) || 0 }))
}

export async function loadStandings(supabase: Supabase, challengeId: string) {
  const { data, error } = await supabase.rpc('challenge_standings', { p_challenge: challengeId })
  if (error) fail('Não foi possível carregar o placar', error)
  return ((data ?? []) as Standing[]).map((row) => ({ ...row, progress: Number(row.progress) || 0 }))
}

export type ChallengeInput = Pick<Challenge, 'title' | 'description' | 'metric' | 'goal' | 'starts_on' | 'ends_on'>

export async function createChallenge(supabase: Supabase, input: ChallengeInput, createdBy: string) {
  const { data, error } = await supabase
    .from('challenges')
    .insert({ ...input, title: input.title.trim(), description: input.description?.trim() || null, created_by: createdBy })
    .select('*')
    .single()
  if (error) fail('Não foi possível criar o desafio', error)
  return { ...(data as Challenge), goal: Number((data as Challenge).goal) || 0 }
}

export async function deleteChallenge(supabase: Supabase, challengeId: string) {
  const { error } = await supabase.from('challenges').delete().eq('id', challengeId)
  if (error) fail('Não foi possível apagar o desafio', error)
}

// ------------------------------------------------------------------ avisos
// Recado do treinador no sino do aluno. Se o banco recusar o tipo (restrição
// antiga em notifications.type), manda como aviso comum.
export type NoticeType = 'announcement' | 'community' | 'workout_updated' | 'feedback_reply' | 'billing'

export async function notifyStudents(
  supabase: Supabase,
  recipients: string[],
  title: string,
  message: string,
  type: NoticeType = 'announcement',
) {
  if (recipients.length === 0) return
  const rows = (kind: string) => recipients.map((recipient_id) => ({ recipient_id, type: kind, title, message }))
  const { error } = await supabase.from('notifications').insert(rows(type))
  if (!error) {
    requestPushDelivery()
    return
  }
  if (type !== 'announcement' && error.code === '23514') {
    const retry = await supabase.from('notifications').insert(rows('announcement'))
    if (!retry.error) {
      requestPushDelivery()
      return
    }
    fail('Não foi possível enviar o aviso', retry.error)
  }
  fail('Não foi possível enviar o aviso', error)
}
