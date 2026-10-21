// Recados dos alunos no fim do treino e a resposta do treinador
// (workout_sessions.feedback / coach_reply, supabase/gestao.sql).
import type { createClient } from './supabase/client'
import type { Profile, WorkoutSession } from './types'
import { hasFeedback } from './feedback'
import { notifyStudents } from './coach'

type Supabase = ReturnType<typeof createClient>

export type FeedbackItem = {
  sessionId: string
  studentId: string
  workoutName: string
  date: Date
  rpe: number | null
  feedback: string
  tags: string[]
  reply: string | null
  replyAt: Date | null
}

type SessionRow = WorkoutSession & { assigned_workouts?: { name: string | null } | null }

export function toFeedbackItem(row: SessionRow): FeedbackItem {
  return {
    sessionId: row.id,
    studentId: row.student_id,
    workoutName: row.assigned_workouts?.name ?? 'Treino',
    date: new Date(row.completed_at ?? Date.now()),
    rpe: row.session_rpe ?? null,
    feedback: row.feedback?.trim() ?? '',
    tags: row.feedback_tags ?? [],
    reply: row.coach_reply?.trim() || null,
    replyAt: row.coach_reply_at ? new Date(row.coach_reply_at) : null,
  }
}

// Recados dos últimos dias (os sem resposta primeiro). select('*'): sem o
// gestao.sql as colunas não existem e a lista só fica vazia.
export async function loadFeedback(supabase: Supabase, students: Pick<Profile, 'id'>[], days = 14) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*, assigned_workouts(name)')
    .eq('status', 'completed')
    .gte('completed_at', since)
    .order('completed_at', { ascending: false })
    .limit(300)
  if (error) throw new Error(error.message)
  const ids = new Set(students.map((student) => student.id))
  return ((data ?? []) as SessionRow[])
    .filter((row) => ids.has(row.student_id) && row.completed_at && hasFeedback(row))
    .map(toFeedbackItem)
    .sort((first, second) => Number(first.reply !== null) - Number(second.reply !== null) || second.date.getTime() - first.date.getTime())
}

export async function replyToFeedback(supabase: Supabase, item: FeedbackItem, text: string) {
  const reply = text.trim()
  const repliedAt = new Date()
  const { data, error } = await supabase
    .from('workout_sessions')
    .update({ coach_reply: reply, coach_reply_at: repliedAt.toISOString() })
    .eq('id', item.sessionId)
    .select('id')
  if (error) {
    if (error.code === 'PGRST204') throw new Error('Para responder recados, rode o arquivo supabase/gestao.sql no Supabase.')
    throw new Error(`Não foi possível salvar a resposta: ${error.message}`)
  }
  if (!data?.length) throw new Error('O treino não foi encontrado.')
  let notified = true
  try {
    await notifyStudents(supabase, [item.studentId], 'Resposta do treinador 💬', `${item.workoutName}: ${reply}`, 'feedback_reply')
  } catch {
    // A resposta ficou salva; o aluno vê no histórico mesmo sem o aviso.
    notified = false
  }
  return { item: { ...item, reply, replyAt: repliedAt }, notified }
}
