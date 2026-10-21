'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { Copy, LoaderCircle, Megaphone, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { avatarUrlOf } from '@/lib/profile'
import { relativeDay } from '@/lib/stats'
import { plural } from '@/lib/text'
import { requestPushDelivery } from '@/lib/push/client'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { Eyebrow } from '@/components/ui/tile'

type NotificationRow = {
  id: string
  recipient_id: string
  title: string
  message: string
  created_at?: string | null
}

type SentGroup = { key: string; title: string; message: string; recipients: string[]; createdAt: string | null }

const ALL_STUDENTS = 'all'
const TITLE_MAX = 120
const MESSAGE_MAX = 500
const HISTORY_PAGE = 6

const TEMPLATES = [
  {
    label: 'Treino novo',
    title: 'Treino novo liberado! 💪',
    message: 'Seu novo treino já está no app. Confira os exercícios e me chame se tiver dúvida em algum movimento.',
  },
  {
    label: 'Subir carga',
    title: 'Hora de subir a carga 📈',
    message: 'Você evoluiu bem nas últimas sessões. No próximo treino, tente aumentar a carga mantendo a execução e as repetições-alvo.',
  },
  {
    label: 'Lembrete',
    title: 'Bora treinar hoje? ⏰',
    message: 'Passando para lembrar do treino de hoje. Constância é o que traz resultado!',
  },
  {
    label: 'Parabéns',
    title: 'Mandou muito bem! 🏆',
    message: 'Parabéns pela consistência nesta semana. Continue assim que os resultados vão aparecer.',
  },
  {
    label: 'Recuperação',
    title: 'Cuide da recuperação 😴',
    message: 'Durma bem, beba água e respeite os intervalos. A evolução acontece no descanso também.',
  },
]

const inputClassName =
  'w-full rounded-2xl border border-line-strong bg-black/40 p-3.5 text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none'
const labelClassName = 'block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400'

// Linhas de um mesmo envio têm o mesmo título e mensagem e, quando a coluna
// existe, o mesmo created_at. Sem created_at, a ordem de inserção separa os envios.
function groupAnnouncements(rows: NotificationRow[]): SentGroup[] {
  const hasDates = rows.some((row) => typeof row.created_at === 'string')
  const ordered = hasDates
    ? [...rows].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    : [...rows].reverse()
  const groups: SentGroup[] = []
  for (const row of ordered) {
    const last = groups[groups.length - 1]
    const sameBatch =
      last &&
      last.title === row.title &&
      last.message === row.message &&
      (!hasDates || last.createdAt === (row.created_at ?? null))
    if (sameBatch) last.recipients.push(row.recipient_id)
    else
      groups.push({
        key: row.id,
        title: row.title,
        message: row.message,
        recipients: [row.recipient_id],
        createdAt: row.created_at ?? null,
      })
  }
  return groups
}

function AvatarStack({ people }: { people: { id: string; name: string | null; avatar: string | null }[] }) {
  const shown = people.slice(0, 4)
  return (
    <span aria-hidden="true" className="flex shrink-0 -space-x-1.5">
      {shown.map((person) => (
        <Avatar key={person.id} name={person.name} seed={person.id} src={person.avatar} size="xs" className="ring-2 ring-surface" />
      ))}
      {people.length > shown.length && (
        <span className="grid h-6 min-w-6 place-items-center rounded-lg bg-surface-3 px-1 text-[9px] font-bold text-zinc-300 ring-2 ring-surface">
          +{people.length - shown.length}
        </span>
      )}
    </span>
  )
}

export default function AdminAnnouncementsPage() {
  const [supabase] = useState(() => createClient())
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const toast = useToast()

  const [students, setStudents] = useState<Profile[]>([])
  const [loadError, setLoadError] = useState('')
  const [history, setHistory] = useState<SentGroup[] | null>(null)
  const [historyVisible, setHistoryVisible] = useState(HISTORY_PAGE)
  const [reloadKey, setReloadKey] = useState(0)
  // ?para=ID (ficha do aluno e painel) já abre o aviso endereçado.
  const [selectedStudent, setSelectedStudent] = useState(() => searchParams.get('para') ?? '')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (searchParams.get('para')) router.replace(pathname, { scroll: false })
  }, [searchParams, router, pathname])

  useEffect(() => {
    let active = true

    const load = async () => {
      const studentsQuery = supabase
        .from('profiles')
        // select('*'): a foto (avatar_path) só existe depois do profile.sql.
        .select('*')
        .eq('role', 'student')
        .order('full_name')
      // created_at pode não existir em notifications: só ordena por ela se a
      // primeira linha trouxer a coluna (select('*') nunca falha por isso).
      const probeQuery = supabase.from('notifications').select('*').eq('type', 'announcement').limit(1)
      const [studentsResult, probe] = await Promise.all([studentsQuery, probeQuery])
      if (!active) return

      if (studentsResult.error) setLoadError(`Não foi possível carregar os alunos: ${studentsResult.error.message}`)
      else setStudents((studentsResult.data ?? []) as Profile[])

      if (probe.error) {
        setHistory([])
        return
      }
      const hasCreatedAt = Boolean(probe.data?.[0] && 'created_at' in probe.data[0])
      const base = supabase.from('notifications').select('*').eq('type', 'announcement')
      const { data, error } = hasCreatedAt
        ? await base.order('created_at', { ascending: false, nullsFirst: false }).limit(400)
        : await base.limit(1000)
      if (!active) return
      setHistory(error ? [] : groupAnnouncements((data ?? []) as NotificationRow[]))
    }

    void load()
    return () => {
      active = false
    }
  }, [supabase, reloadKey])

  const studentById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students])

  const recipients = useMemo(() => {
    if (selectedStudent === ALL_STUDENTS) return students
    const student = studentById.get(selectedStudent)
    return student ? [student] : []
  }, [selectedStudent, students, studentById])

  const applyTemplate = (template: (typeof TEMPLATES)[number]) => {
    setTitle(template.title)
    setMessage(template.message)
    setFormError('')
    messageRef.current?.focus()
  }

  const reuse = (group: SentGroup) => {
    setTitle(group.title)
    setMessage(group.message)
    setFormError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    titleRef.current?.focus({ preventScroll: true })
  }

  const handleSendAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError('')
    if (!selectedStudent) return setFormError('Escolha quem vai receber o aviso.')
    if (recipients.length === 0) return setFormError('Nenhum aluno para receber o aviso.')
    if (!title.trim() || !message.trim()) return setFormError('Preencha o título e a mensagem.')

    setSending(true)
    const { error } = await supabase.from('notifications').insert(
      recipients.map((recipient) => ({
        recipient_id: recipient.id,
        type: 'announcement',
        title: title.trim(),
        message: message.trim(),
      })),
    )
    setSending(false)

    if (error) {
      setFormError(`Erro ao enviar aviso: ${error.message}`)
      return
    }
    requestPushDelivery()
    toast({
      tone: 'success',
      title: 'Aviso enviado',
      description:
        recipients.length > 1
          ? `Para ${plural(recipients.length, 'aluno', 'alunos')}.`
          : `Para ${recipients[0].full_name || recipients[0].email}.`,
    })
    setTitle('')
    setMessage('')
    setHistoryVisible(HISTORY_PAGE)
    setReloadKey((key) => key + 1)
  }

  const recipientLabel = (group: SentGroup) => {
    if (students.length > 1 && group.recipients.length >= students.length) return 'Todos os alunos'
    const names = group.recipients.map((id) => studentById.get(id)?.full_name?.split(' ')[0] || 'Aluno')
    return names.length > 2 ? `${names.slice(0, 2).join(', ')} e mais ${names.length - 2}` : names.join(' e ')
  }

  const titleNearLimit = title.length > TITLE_MAX * 0.9
  const messageNearLimit = message.length > MESSAGE_MAX * 0.9

  return (
    <div className="space-y-4">
      <div className="px-1">
        <Eyebrow>Comunicação</Eyebrow>
        <h1 className="mt-1 font-display text-[2.75rem] font-bold uppercase leading-[0.9]">Avisos</h1>
        <p className="mt-1.5 text-xs text-zinc-500">Aparecem no sino do app do aluno.</p>
      </div>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {/* No computador: formulário à esquerda, enviados à direita. */}
      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
        <form onSubmit={handleSendAnnouncement} className="space-y-4 rounded-3xl border border-line bg-surface p-4 lg:sticky lg:top-10">
          <div className="space-y-2">
            <label htmlFor="announcement-student" className={labelClassName}>
              Para
            </label>
            <select
              id="announcement-student"
              required
              value={selectedStudent}
              onChange={(event) => setSelectedStudent(event.target.value)}
              className={inputClassName}
            >
              <option value="">Selecione...</option>
              {students.length > 1 && <option value={ALL_STUDENTS}>Todos os alunos ({students.length})</option>}
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.full_name || student.email}
                </option>
              ))}
            </select>
            <AnimatePresence initial={false}>
              {recipients.length > 0 && (
                <m.p
                  key="recipients"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 overflow-hidden text-[11px] text-zinc-400"
                >
                  <AvatarStack
                    people={recipients.map((student) => ({
                      id: student.id,
                      name: student.full_name ?? student.email,
                      avatar: avatarUrlOf(student),
                    }))}
                  />
                  {recipients.length > 1 ? `${plural(recipients.length, 'aluno vai', 'alunos vão')} receber` : 'Aviso individual'}
                </m.p>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-2">
            <span id="announcement-templates" className={labelClassName}>
              Modelos rápidos
            </span>
            <div
              role="group"
              aria-labelledby="announcement-templates"
              className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4"
            >
              {TEMPLATES.map((template) => (
                <button
                  key={template.label}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className={cn(
                    'h-9 shrink-0 rounded-full border px-3.5 text-[11px] font-bold transition',
                    title === template.title
                      ? 'border-brand/50 bg-brand-soft text-brand'
                      : 'border-line text-zinc-300 hover:border-line-strong hover:text-white',
                  )}
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-end justify-between">
              <label htmlFor="announcement-title" className={labelClassName}>
                Título
              </label>
              <span
                id="announcement-title-count"
                className={cn('text-[10px] font-bold tabular-nums', titleNearLimit ? 'text-gold' : 'text-zinc-500')}
              >
                {title.length}/{TITLE_MAX}
              </span>
            </div>
            <input
              ref={titleRef}
              id="announcement-title"
              type="text"
              required
              maxLength={TITLE_MAX}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-describedby="announcement-title-count"
              placeholder="Ex: Atualização da carga de treino"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-end justify-between">
              <label htmlFor="announcement-message" className={labelClassName}>
                Mensagem
              </label>
              <span
                id="announcement-message-count"
                className={cn('text-[10px] font-bold tabular-nums', messageNearLimit ? 'text-gold' : 'text-zinc-500')}
              >
                {message.length}/{MESSAGE_MAX}
              </span>
            </div>
            <textarea
              ref={messageRef}
              id="announcement-message"
              required
              rows={4}
              maxLength={MESSAGE_MAX}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              aria-describedby="announcement-message-count"
              placeholder="Escreva a mensagem para o aluno..."
              className={cn(inputClassName, 'resize-none leading-relaxed')}
            />
          </div>

          <section aria-label="Prévia do aviso" className="space-y-2">
            <Eyebrow>Como o aluno vê</Eyebrow>
            <div className="flex gap-3 rounded-2xl border border-brand/25 bg-brand-soft p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-black">
                <Megaphone className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={cn('truncate text-sm font-bold', title.trim() ? 'text-white' : 'text-zinc-500')}>
                    {title.trim() || 'Título do aviso'}
                  </p>
                  <span className="shrink-0 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-black uppercase text-black">
                    Novo
                  </span>
                </div>
                <p
                  className={cn(
                    'mt-1 whitespace-pre-line break-words text-[13px] leading-relaxed',
                    message.trim() ? 'text-zinc-300' : 'text-zinc-500',
                  )}
                >
                  {message.trim() || 'Sua mensagem aparece aqui.'}
                </p>
              </div>
            </div>
          </section>

          {formError && <Alert variant="error">{formError}</Alert>}

          <m.button
            type="submit"
            disabled={sending}
            whileTap={{ scale: 0.98 }}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black uppercase tracking-[0.14em] text-black disabled:opacity-60"
          >
            {sending ? (
              <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Enviando" />
            ) : (
              <>
                <Send className="h-4 w-4" aria-hidden="true" /> Enviar aviso
              </>
            )}
          </m.button>
        </form>

        <section aria-labelledby="sent-title" className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 id="sent-title" className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
              Enviados
            </h2>
            {history && history.length > 0 && (
              <span className="text-[11px] text-zinc-500">{plural(history.length, 'envio', 'envios')}</span>
            )}
          </div>

          {history === null ? (
            <div className="space-y-2" role="status" aria-label="Carregando avisos enviados">
              <Skeleton className="h-28 rounded-3xl" />
              <Skeleton className="h-28 rounded-3xl" />
            </div>
          ) : history.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line-strong p-6 text-center text-xs text-zinc-500">
              Nenhum aviso enviado ainda.
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {history.slice(0, historyVisible).map((group) => (
                  <m.li
                    key={group.key}
                    layout="position"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-3xl border border-line bg-surface p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">{group.title}</p>
                        <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs leading-relaxed text-zinc-400">
                          {group.message}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => reuse(group)}
                        className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 text-[11px] font-bold text-zinc-300 transition hover:border-line-strong hover:text-white"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          Reusar<span className="sr-only"> o aviso {group.title}</span>
                        </span>
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                      <AvatarStack
                        people={group.recipients.map((id) => ({
                          id,
                          name: studentById.get(id)?.full_name ?? studentById.get(id)?.email ?? null,
                          avatar: avatarUrlOf(studentById.get(id)),
                        }))}
                      />
                      <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-400">{recipientLabel(group)}</span>
                      {group.createdAt && (
                        <span className="shrink-0 text-[11px] text-zinc-500">{relativeDay(new Date(group.createdAt))}</span>
                      )}
                    </div>
                  </m.li>
                ))}
              </ul>
              {history.length > historyVisible && (
                <button
                  type="button"
                  onClick={() => setHistoryVisible((count) => count + HISTORY_PAGE)}
                  className="h-11 w-full rounded-2xl border border-line text-xs font-bold text-zinc-300 transition hover:border-line-strong hover:text-white"
                >
                  Ver mais envios
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
