// Recado do aluno ao finalizar o treino (workout_sessions.feedback e
// feedback_tags, supabase/gestao.sql) e a resposta do treinador.

export const FEEDBACK_MAX = 500
export const REPLY_MAX = 500

// Os rótulos são gravados como estão (o treinador lê o mesmo texto no aviso).
export const FEEDBACK_TAGS = [
  { label: 'Treino top', emoji: '🔥', tone: 'brand' },
  { label: 'Muito leve', emoji: '🪶', tone: 'neutral' },
  { label: 'Pesado demais', emoji: '🥵', tone: 'gold' },
  { label: 'Senti dor', emoji: '🩹', tone: 'danger' },
  { label: 'Faltou tempo', emoji: '⏱️', tone: 'neutral' },
  { label: 'Aparelho ocupado', emoji: '🚧', tone: 'neutral' },
] as const

export type FeedbackTone = (typeof FEEDBACK_TAGS)[number]['tone']

export function tagInfo(label: string) {
  return FEEDBACK_TAGS.find((tag) => tag.label === label) ?? { label, emoji: '💬', tone: 'neutral' as FeedbackTone }
}

export const TAG_TONES: Record<FeedbackTone, string> = {
  brand: 'border-brand/30 bg-brand-soft text-brand',
  gold: 'border-gold/30 bg-gold-soft text-gold',
  danger: 'border-danger/30 bg-danger-soft text-danger',
  neutral: 'border-line bg-white/[0.04] text-zinc-300',
}

export function hasFeedback(session: { feedback?: string | null; feedback_tags?: string[] | null }) {
  return Boolean(session.feedback?.trim()) || (session.feedback_tags?.length ?? 0) > 0
}
