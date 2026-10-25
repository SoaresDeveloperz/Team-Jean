'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, m } from 'framer-motion'
import { CornerDownRight, LoaderCircle, MessageSquareReply, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { replyToFeedback, type FeedbackItem } from '@/lib/coach-feedback'
import { REPLY_MAX, TAG_TONES, tagInfo } from '@/lib/feedback'
import { avatarUrlOf } from '@/lib/profile'
import { relativeDay } from '@/lib/stats'
import { cn } from '@/lib/cn'
import { Avatar } from '@/components/ui/avatar'
import { useToast } from '@/components/ui/toast'
import { friendlyError } from '@/lib/errors'

const QUICK_REPLIES = ['Boa! Continua assim 💪', 'Vou ajustar seu treino.', 'Descansa e me conta como ficou.']

type FeedbackCardProps = {
  item: FeedbackItem
  student?: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_path'>
  onReplied: (item: FeedbackItem) => void
  // Na ficha do aluno o avatar e o nome sobram.
  showStudent?: boolean
}

// Recado do aluno no fim do treino, com a resposta do treinador.
export function FeedbackCard({ item, student, onReplied, showStudent = true }: FeedbackCardProps) {
  const [supabase] = useState(() => createClient())
  const toast = useToast()
  const replyId = useId()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const name = student?.full_name?.trim().split(' ')[0] || 'Aluno'

  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!text.trim()) {
      setError('Escreva a resposta.')
      return
    }
    setSending(true)
    setError('')
    try {
      const result = await replyToFeedback(supabase, item, text)
      onReplied(result.item)
      setOpen(false)
      toast({
        tone: result.notified ? 'success' : 'info',
        title: 'Resposta enviada',
        description: result.notified ? `${name} vai ver no sino de avisos.` : 'Salva no treino (o aviso não pôde ser enviado).',
      })
    } catch (sendError) {
      setError(friendlyError(sendError, 'Não foi possível responder'))
    } finally {
      setSending(false)
    }
  }

  return (
    <article className="rounded-2xl bg-white/[0.03] p-3.5" aria-label={`Recado de ${name}`}>
      <div className="flex items-start gap-3">
        {showStudent && (
          <Link href={`/admin/students?aluno=${item.studentId}`} className="shrink-0 rounded-2xl">
            <Avatar name={student?.full_name ?? student?.email} seed={item.studentId} src={avatarUrlOf(student)} size="sm" />
            <span className="sr-only">Abrir a ficha de {student?.full_name ?? 'aluno'}</span>
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug text-white">
            {showStudent ? `${name} · ${item.workoutName}` : item.workoutName}
          </p>
          <p className="text-[11px] text-zinc-500">
            {relativeDay(item.date)}
            {item.rpe !== null && ` · RPE ${item.rpe}`}
          </p>
          {item.tags.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1" aria-label="Como foi o treino">
              {item.tags.map((tag) => {
                const info = tagInfo(tag)
                return (
                  <li key={tag} className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold', TAG_TONES[info.tone])}>
                    <span aria-hidden="true">{info.emoji}</span> {tag}
                  </li>
                )
              })}
            </ul>
          )}
          {item.feedback && (
            <blockquote className="mt-2 whitespace-pre-line rounded-xl border-l-2 border-brand/50 bg-black/25 px-3 py-2 text-[13px] leading-relaxed text-zinc-200">
              “{item.feedback}”
            </blockquote>
          )}

          <AnimatePresence initial={false} mode="wait">
            {item.reply ? (
              <m.p key="reply" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 flex gap-1.5 text-xs leading-relaxed text-zinc-300">
                <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
                <span>
                  <span className="font-bold text-brand">Você: </span>
                  {item.reply}
                </span>
              </m.p>
            ) : open ? (
              <m.form key="form" onSubmit={send} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2.5 space-y-2 overflow-hidden">
                <label htmlFor={replyId} className="sr-only">
                  Resposta para {name}
                </label>
                <textarea
                  id={replyId}
                  value={text}
                  maxLength={REPLY_MAX}
                  rows={2}
                  autoFocus
                  onChange={(event) => setText(event.target.value)}
                  placeholder={`Responda ${name}…`}
                  className="block max-h-36 w-full resize-none rounded-xl border border-line-strong bg-black/40 px-3 py-2.5 text-white placeholder:text-zinc-600 [field-sizing:content] focus:border-brand focus:outline-none"
                />
                <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
                  {QUICK_REPLIES.map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => setText(quick)}
                      className="h-8 shrink-0 rounded-full border border-line px-3 text-[11px] font-semibold text-zinc-300 transition hover:border-line-strong hover:text-white"
                    >
                      {quick}
                    </button>
                  ))}
                </div>
                {error && (
                  <p role="alert" className="text-[11px] font-semibold text-danger">
                    {error}
                  </p>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-xl border border-line px-3 text-[11px] font-bold text-zinc-300">
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand text-[11px] font-black text-black disabled:opacity-60"
                  >
                    {sending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
                    Enviar resposta
                  </button>
                </div>
              </m.form>
            ) : (
              <m.button
                key="open"
                type="button"
                onClick={() => setOpen(true)}
                whileTap={{ scale: 0.95 }}
                className="mt-2.5 flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-[11px] font-black text-black"
              >
                <MessageSquareReply className="h-3.5 w-3.5" aria-hidden="true" /> Responder
                <span className="sr-only"> {name}</span>
              </m.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </article>
  )
}
