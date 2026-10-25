'use client'

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import {
  AtSign,
  Box,
  Check,
  ChevronRight,
  ClipboardList,
  HeartPulse,
  KeyRound,
  LayoutList,
  LoaderCircle,
  Megaphone,
  NotebookPen,
  Pencil,
  Scale,
  Search,
  Send,
  ShieldAlert,
  User,
  UserPlus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { WhatsAppComeback } from '@/components/coach/WhatsAppComeback'
import type { AssignedWorkout, Profile } from '@/lib/types'
import { avatarUrlOf, goalInfo } from '@/lib/profile'
import { relativeDay, relativeDayPhrase, startOfWeek } from '@/lib/stats'
import { cn } from '@/lib/cn'
import { friendlyError } from '@/lib/errors'
import { Alert } from '@/components/ui/alert'
import { Avatar } from '@/components/ui/avatar'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { Eyebrow, Stagger, tileVariants } from '@/components/ui/tile'
import { MeasurementsCard } from '@/components/profile/MeasurementsCard'
import { AnamneseCard } from '@/components/health/AnamneseCard'
import { loadParqAlerts } from '@/lib/health'
import { CoachNotes } from '@/components/coach/CoachNotes'
import { MuscleWeek } from '@/components/coach/MuscleWeek'
import { TabPanel, Tabs, type TabItem } from '@/components/ui/tabs'
import { FeedbackCard } from '@/components/coach/FeedbackCard'
import { StudentPasswordReset } from '@/components/admin/StudentPasswordReset'
import { hasFeedback } from '@/lib/feedback'
import { toFeedbackItem } from '@/lib/coach-feedback'
import { createStudent } from './actions'

type DetailTab = 'summary' | 'body' | 'measures' | 'health' | 'notes'
const DETAIL_TABS: TabItem<DetailTab>[] = [
  { value: 'summary', label: 'Resumo', icon: LayoutList },
  { value: 'body', label: 'Corpo 3D', icon: Box },
  { value: 'measures', label: 'Medidas', icon: Scale },
  { value: 'health', label: 'Saúde', icon: HeartPulse },
  { value: 'notes', label: 'Notas', icon: NotebookPen },
]

type SessionRow = {
  id: string
  student_id: string
  completed_at: string
  session_rpe: number | null
  assigned_workouts: { name: string | null } | null
  // supabase/gestao.sql (recado do treino)
  feedback?: string | null
  feedback_tags?: string[] | null
  coach_reply?: string | null
  coach_reply_at?: string | null
}

type Filter = 'all' | 'active' | 'inactive' | 'tired'

const WINDOW_DAYS = 90
const inputClassName =
  'w-full rounded-2xl border border-line-strong bg-black/40 p-3.5 text-sm text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none'
const labelClassName = 'mb-1.5 block text-xs font-black uppercase tracking-[0.1em] text-zinc-400'

function readinessTone(score: number | null | undefined) {
  if (score === null || score === undefined) return { label: '—', className: 'text-zinc-500', bar: 'bg-white/20' }
  if (score >= 80) return { label: `${score}%`, className: 'text-brand', bar: 'bg-brand' }
  if (score >= 50) return { label: `${score}%`, className: 'text-gold', bar: 'bg-gold' }
  return { label: `${score}%`, className: 'text-danger', bar: 'bg-danger' }
}

// Senha provisória fácil de ditar: sem caracteres ambíguos (0/O, 1/l).
function generatePassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const values = crypto.getRandomValues(new Uint32Array(8))
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('')
}

export default function AdminStudentsPage() {
  const [supabase] = useState(() => createClient())
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const toast = useToast()

  const [students, setStudents] = useState<Profile[] | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [workouts, setWorkouts] = useState<AssignedWorkout[]>([])
  // Alerta do PAR-Q por aluno (null sem o gestao.sql).
  const [parqAlerts, setParqAlerts] = useState<Map<string, boolean> | null>(null)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  // Links do painel abrem direto a ficha (?aluno=) ou o cadastro (?novo=1).
  const [detailId, setDetailId] = useState<string | null>(() => searchParams.get('aluno'))
  const [detailTab, setDetailTab] = useState<DetailTab>('summary')
  const tabsId = useId()
  const [showCreateModal, setShowCreateModal] = useState(() => searchParams.get('novo') === '1')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<{ message: string; email: string; password: string } | null>(null)

  const [editingName, setEditingName] = useState<string | null>(null)
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    if (searchParams.get('aluno') || searchParams.get('novo')) router.replace(pathname, { scroll: false })
  }, [searchParams, router, pathname])

  useEffect(() => {
    let active = true

    const load = async () => {
      const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000)
      const [studentsResult, sessionsResult, workoutsResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'student').order('created_at', { ascending: false }),
        supabase
          .from('workout_sessions')
          // select('*'): o recado do treino só existe depois do gestao.sql.
          .select('*, assigned_workouts(name)')
          .eq('status', 'completed')
          .gte('completed_at', since.toISOString())
          .order('completed_at', { ascending: false })
          .limit(1000),
        supabase.from('assigned_workouts').select('*').eq('is_current', true).order('name'),
      ])
      if (!active) return

      const error = studentsResult.error ?? sessionsResult.error ?? workoutsResult.error
      if (error) {
        // Mantém a lista que já estava na tela (sem fingir "nenhum aluno").
        setLoadError(friendlyError(error, 'Não foi possível carregar os alunos'))
        return
      }
      setLoadError('')
      void loadParqAlerts(supabase).then((alerts) => {
        if (active) setParqAlerts(alerts)
      })
      setStudents((studentsResult.data ?? []) as Profile[])
      setSessions(((sessionsResult.data ?? []) as unknown as SessionRow[]).filter((session) => session.completed_at))
      setWorkouts((workoutsResult.data ?? []) as AssignedWorkout[])
    }

    void load()
    return () => {
      active = false
    }
  }, [supabase, reloadKey])

  const reload = () => setReloadKey((key) => key + 1)

  const stats = useMemo(() => {
    const weekStart = startOfWeek(new Date())
    const byStudent = new Map<string, { last: Date | null; week: number; total: number; recent: SessionRow[] }>()
    for (const session of sessions) {
      const entry = byStudent.get(session.student_id) ?? { last: null, week: 0, total: 0, recent: [] }
      const date = new Date(session.completed_at)
      if (!entry.last || date > entry.last) entry.last = date
      if (date >= weekStart) entry.week += 1
      entry.total += 1
      if (entry.recent.length < 5) entry.recent.push(session)
      byStudent.set(session.student_id, entry)
    }
    return byStudent
  }, [sessions])

  const statsOf = useCallback(
    (studentId: string) => stats.get(studentId) ?? { last: null, week: 0, total: 0, recent: [] as SessionRow[] },
    [stats],
  )

  const isInactive = useCallback(
    (studentId: string) => {
      const last = statsOf(studentId).last
      return !last || Date.now() - last.getTime() > 7 * 86_400_000
    },
    [statsOf],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (students ?? []).filter((student) => {
      if (term && !`${student.full_name ?? ''} ${student.email ?? ''}`.toLowerCase().includes(term)) return false
      if (filter === 'active') return statsOf(student.id).week > 0
      if (filter === 'inactive') return isInactive(student.id)
      if (filter === 'tired') return typeof student.readiness_score === 'number' && student.readiness_score < 50
      return true
    })
  }, [students, search, filter, statsOf, isInactive])

  const counts = useMemo(
    () => ({
      all: students?.length ?? 0,
      active: (students ?? []).filter((student) => statsOf(student.id).week > 0).length,
      inactive: (students ?? []).filter((student) => isInactive(student.id)).length,
      tired: (students ?? []).filter((student) => typeof student.readiness_score === 'number' && student.readiness_score < 50)
        .length,
    }),
    [students, statsOf, isInactive],
  )

  const detail = students?.find((student) => student.id === detailId) ?? null
  const detailStats = detail ? statsOf(detail.id) : null
  const detailGoal = goalInfo(detail?.goal)
  const detailWorkouts = detail ? workouts.filter((workout) => workout.student_id === detail.id) : []

  const closeCreate = useCallback(() => setShowCreateModal(false), [])
  const closeDetail = useCallback(() => {
    setDetailId(null)
    setEditingName(null)
    setDetailTab('summary')
  }, [])

  const openCreateModal = () => {
    setFullName('')
    setEmail('')
    setPassword(generatePassword())
    setCreateError('')
    setCreated(null)
    setShowCreateModal(true)
  }

  const handleCreateStudent = async (event: React.FormEvent) => {
    event.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      const result = await createStudent({ fullName, email, password })
      if (!result.ok) {
        setCreateError(result.message)
        return
      }
      // O modal continua aberto mostrando o acesso, para o treinador enviar ao aluno.
      setCreated({ message: result.message, email: email.trim(), password })
      reload()
    } catch {
      setCreateError('Falha de conexão ao cadastrar. Tente novamente.')
    } finally {
      setCreating(false)
    }
  }

  const shareAccess = async () => {
    if (!created) return
    const text = `Seu acesso ao Team Jean:\nE-mail: ${created.email}\nSenha: ${created.password}\n${window.location.origin}/login`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Acesso ao Team Jean', text })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      toast({ tone: 'success', title: 'Acesso copiado', description: 'Cole na conversa com o aluno.' })
    } catch {
      toast({ tone: 'error', title: 'Não foi possível copiar', description: 'Anote o e-mail e a senha mostrados.' })
    }
  }

  const handleSaveName = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!detail || editingName === null) return
    const name = editingName.trim()
    if (!name) {
      setEditError('Informe o nome do aluno.')
      return
    }
    setSavingEdit(true)
    const { error } = await supabase.from('profiles').update({ full_name: name }).eq('id', detail.id)
    setSavingEdit(false)
    if (error) {
      setEditError(friendlyError(error, 'Não foi possível atualizar o nome'))
      return
    }
    setEditingName(null)
    toast({ tone: 'success', title: 'Nome atualizado' })
    reload()
  }

  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: `Todos · ${counts.all}` },
    { value: 'active', label: `Treinaram · ${counts.active}` },
    { value: 'inactive', label: `Sem treinar · ${counts.inactive}` },
    { value: 'tired', label: `Fadigados · ${counts.tired}` },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <Eyebrow>Consultoria</Eyebrow>
          <h1 className="mt-1 font-display text-[2.75rem] font-bold uppercase leading-[0.9]">Alunos</h1>
        </div>
        <m.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={openCreateModal}
          className="flex h-11 items-center gap-1.5 rounded-2xl bg-white px-4 text-xs font-black uppercase tracking-wider text-black"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" /> Cadastrar
        </m.button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-4 h-4 w-4 text-zinc-500" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          aria-label="Buscar aluno"
          className={cn(inputClassName, 'pl-11')}
        />
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Filtrar alunos">
        {filters.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={cn(
              'h-9 shrink-0 rounded-full border px-3.5 text-xs font-bold transition',
              filter === option.value
                ? 'border-white bg-white text-black'
                : 'border-line bg-surface text-zinc-400 hover:text-white',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loadError && (
        <Alert
          variant="error"
          onRetry={() => {
            setLoadError('')
            reload()
          }}
        >
          {loadError}
        </Alert>
      )}

      {students === null ? (
        loadError ? null : (
          <div className="grid gap-2.5 lg:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Carregando alunos">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-24 rounded-3xl" />
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line-strong p-10 text-center">
          <User className="h-9 w-9 text-zinc-600" aria-hidden="true" />
          <p className="text-sm font-semibold text-zinc-400">
            {students.length === 0 ? 'Nenhum aluno cadastrado ainda.' : 'Nenhum aluno neste filtro.'}
          </p>
        </div>
      ) : (
        <Stagger className="grid gap-2.5 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((student) => {
            const studentStats = statsOf(student.id)
            const readiness = readinessTone(student.readiness_score)
            return (
              <m.div key={student.id} variants={tileVariants} layout className="flex h-full flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setDetailId(student.id)}
                  className="flex w-full flex-1 items-center gap-3.5 rounded-3xl border border-line bg-surface p-4 text-left transition hover:border-line-strong"
                >
                  <Avatar name={student.full_name ?? student.email} seed={student.id} src={avatarUrlOf(student)} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-white">{student.full_name || 'Aluno sem nome'}</span>
                    <span className="block truncate text-xs text-zinc-500">{student.email}</span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-bold">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5',
                          studentStats.week > 0 ? 'bg-brand-soft text-brand' : 'bg-white/[0.06] text-zinc-400',
                        )}
                      >
                        {studentStats.week} na semana
                      </span>
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-zinc-400">
                        {studentStats.last ? `Treinou ${relativeDayPhrase(studentStats.last)}` : 'Sem treinos'}
                      </span>
                      {parqAlerts?.get(student.id) && (
                        <span className="flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-danger">
                          <ShieldAlert className="h-3 w-3" aria-hidden="true" /> PAR-Q
                          <span className="sr-only">com alerta</span>
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className={cn('font-display text-xl font-bold leading-none', readiness.className)}>{readiness.label}</span>
                    <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Prontidão</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden="true" />
                </button>
                {/* Filtro "Sem treinar": chamar de volta pelo WhatsApp (fora do botão do cartão). */}
                {filter === 'inactive' && (
                  <WhatsAppComeback fullName={student.full_name} last={studentStats.last} className="self-end" />
                )}
              </m.div>
            )
          })}
        </Stagger>
      )}

      {/* Ficha do aluno */}
      <Modal open={detail !== null} onClose={closeDetail} title={detail?.full_name || 'Aluno'} description={detail?.email} size="wide">
        {detail && detailStats && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={detail.full_name ?? detail.email} seed={detail.id} src={avatarUrlOf(detail)} size="xl" />
              <dl className="grid flex-1 grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Treinos', value: String(detailStats.total), hint: `${WINDOW_DAYS} dias` },
                  { label: 'Semana', value: String(detailStats.week), hint: 'treinos' },
                  { label: 'Prontidão', value: readinessTone(detail.readiness_score).label, hint: 'hoje' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-line bg-black/30 px-1 py-2.5">
                    <dt className="text-xs font-black uppercase tracking-wider text-zinc-500">{stat.label}</dt>
                    <dd className="font-display text-2xl font-bold leading-tight">{stat.value}</dd>
                    <dd className="text-xs text-zinc-500">{stat.hint}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <Tabs id={tabsId} items={DETAIL_TABS} value={detailTab} onChange={setDetailTab} label="Seções da ficha do aluno" />

            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={detailTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <TabPanel tabsId={tabsId} value={detailTab} className="space-y-5">
                  {detailTab === 'summary' && (
                    <>
                    {(detailGoal || detail.bio || detail.instagram) && (
                      <div className="rounded-2xl border border-line bg-black/20 p-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {detailGoal && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-zinc-200">
                              <span aria-hidden="true">{detailGoal.emoji}</span> Objetivo: {detailGoal.label}
                            </span>
                          )}
                          {detail.instagram && (
                            <a
                              href={`https://instagram.com/${encodeURIComponent(detail.instagram)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-brand hover:underline"
                            >
                              <AtSign className="h-3.5 w-3.5" aria-hidden="true" />
                              {detail.instagram}
                              <span className="sr-only"> no Instagram (abre em nova aba)</span>
                            </a>
                          )}
                        </div>
                        {detail.bio && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-300">{detail.bio}</p>}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={`/admin/workouts?novo=${detail.id}`}
                        className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white text-xs font-black uppercase tracking-wider text-black"
                      >
                        <ClipboardList className="h-4 w-4" aria-hidden="true" /> Prescrever
                      </Link>
                      <Link
                        href={`/admin/announcements?para=${detail.id}`}
                        className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-line-strong bg-white/[0.04] text-xs font-black uppercase tracking-wider text-white"
                      >
                        <Megaphone className="h-4 w-4" aria-hidden="true" /> Avisar
                      </Link>
                    </div>

                    <section aria-labelledby="detail-workouts">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 id="detail-workouts" className="text-xs font-black uppercase tracking-[0.1em] text-zinc-500">
                          Treinos ativos
                        </h3>
                        <Link href={`/admin/workouts?aluno=${detail.id}`} className="text-xs font-bold text-brand">
                          Gerenciar
                        </Link>
                      </div>
                      {detailWorkouts.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-line-strong p-4 text-center text-xs text-zinc-500">
                          Nenhum treino ativo.
                        </p>
                      ) : (
                        <ul className="flex flex-wrap gap-2">
                          {detailWorkouts.map((workout) => (
                            <li key={workout.id} className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-zinc-200">
                              {workout.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <section aria-labelledby="detail-sessions">
                      <h3 id="detail-sessions" className="mb-2 text-xs font-black uppercase tracking-[0.1em] text-zinc-500">
                        Últimos treinos
                      </h3>
                      {detailStats.recent.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-line-strong p-4 text-center text-xs text-zinc-500">
                          Nenhum treino nos últimos {WINDOW_DAYS} dias.
                        </p>
                      ) : (
                        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                          {detailStats.recent.map((session) =>
                            hasFeedback(session) ? (
                              <li key={session.id} className="p-1.5">
                                <FeedbackCard
                                  item={toFeedbackItem({ ...session, assigned_workout_id: '', status: 'completed' })}
                                  student={detail}
                                  showStudent={false}
                                  onReplied={(replied) =>
                                    setSessions((current) =>
                                      current.map((row) =>
                                        row.id === replied.sessionId
                                          ? { ...row, coach_reply: replied.reply, coach_reply_at: replied.replyAt?.toISOString() ?? null }
                                          : row,
                                      ),
                                    )
                                  }
                                />
                              </li>
                            ) : (
                              <li key={session.id} className="flex items-center justify-between gap-3 px-4 py-3">
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold text-white">
                                    {session.assigned_workouts?.name ?? 'Treino'}
                                  </span>
                                  <span className="block text-xs text-zinc-500">{relativeDay(new Date(session.completed_at))}</span>
                                </span>
                                {session.session_rpe != null && (
                                  <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-bold text-zinc-300">
                                    RPE {session.session_rpe}
                                  </span>
                                )}
                              </li>
                            ),
                          )}
                        </ul>
                      )}
                    </section>

                    <AnimatePresence initial={false} mode="wait">
                      {editingName === null ? (
                        <m.button
                          key="edit-button"
                          type="button"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => {
                            setEditingName(detail.full_name ?? '')
                            setEditError('')
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line py-3 text-xs font-bold text-zinc-300 hover:text-white"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Editar nome
                        </m.button>
                      ) : (
                        <m.form
                          key="edit-form"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          onSubmit={handleSaveName}
                          className="space-y-2"
                        >
                          <label htmlFor="edit-student-name" className={labelClassName}>
                            Nome completo
                          </label>
                          <input
                            id="edit-student-name"
                            type="text"
                            required
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                            className={inputClassName}
                          />
                          {editError && <Alert variant="error">{editError}</Alert>}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingName(null)}
                              className="h-11 w-2/5 rounded-2xl border border-line text-xs font-bold uppercase text-zinc-300"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              disabled={savingEdit}
                              className="flex h-11 flex-1 items-center justify-center rounded-2xl bg-white text-xs font-black uppercase tracking-wider text-black disabled:opacity-60"
                            >
                              {savingEdit ? <LoaderCircle className="h-4 w-4 animate-spin" aria-label="Salvando" /> : 'Salvar nome'}
                            </button>
                          </div>
                        </m.form>
                      )}
                    </AnimatePresence>
                    <StudentPasswordReset
                      key={detail.id}
                      studentId={detail.id}
                      studentName={detail.full_name || detail.email || 'Aluno'}
                      email={detail.email}
                    />
                    </>
                  )}
                  {detailTab === 'body' && <MuscleWeek studentId={detail.id} studentName={detail.full_name || detail.email || 'Aluno'} />}
                  {detailTab === 'measures' && (
                    <MeasurementsCard
                      userId={detail.id}
                      goal={detail.goal}
                      studentName={detail.full_name || detail.email}
                      profile={detail}
                      onProfileChange={(patch) =>
                        setStudents((current) => current?.map((student) => (student.id === detail.id ? { ...student, ...patch } : student)) ?? current)
                      }
                      bare
                    />
                  )}
                  {detailTab === 'health' && <AnamneseCard studentId={detail.id} studentName={detail.full_name || detail.email || 'Aluno'} />}
                  {detailTab === 'notes' && <CoachNotes studentId={detail.id} studentName={detail.full_name || detail.email || 'Aluno'} />}
                </TabPanel>
              </m.div>
            </AnimatePresence>
          </div>
        )}
      </Modal>

      {/* Cadastro */}
      <Modal
        open={showCreateModal}
        onClose={closeCreate}
        title={created ? 'Aluno cadastrado' : 'Novo aluno'}
        description={created ? undefined : 'O aluno entra com este e-mail e a senha provisória.'}
      >
        <AnimatePresence mode="wait" initial={false}>
          {created ? (
            <m.div
              key="created"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <m.span
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.05 }}
                  className="glow-brand grid h-16 w-16 place-items-center rounded-full bg-brand text-black"
                >
                  <Check className="h-8 w-8 stroke-[3]" aria-hidden="true" />
                </m.span>
                <p role="status" className="text-sm font-semibold text-white">
                  {created.message}
                </p>
              </div>
              <dl className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-black/30 text-sm">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <dt className="text-xs font-black uppercase tracking-[0.1em] text-zinc-500">E-mail</dt>
                  <dd className="min-w-0 truncate font-semibold text-white">{created.email}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <dt className="text-xs font-black uppercase tracking-[0.1em] text-zinc-500">Senha provisória</dt>
                  <dd className="font-mono font-bold tracking-wider text-brand">{created.password}</dd>
                </div>
              </dl>
              <div className="grid grid-cols-2 gap-2">
                <m.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={shareAccess}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white text-xs font-black uppercase tracking-wider text-black"
                >
                  <Send className="h-4 w-4" aria-hidden="true" /> Enviar acesso
                </m.button>
                <button
                  type="button"
                  onClick={closeCreate}
                  className="h-12 rounded-2xl border border-line-strong text-xs font-black uppercase tracking-wider text-zinc-200"
                >
                  Concluir
                </button>
              </div>
            </m.div>
          ) : (
            <m.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleCreateStudent}
              className="space-y-4"
            >
              <div>
                <label htmlFor="student-name" className={labelClassName}>
                  Nome completo
                </label>
                <input
                  id="student-name"
                  type="text"
                  required
                  autoComplete="off"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Ex: João Silva"
                  className={inputClassName}
                />
              </div>
              <div>
                <label htmlFor="student-email" className={labelClassName}>
                  E-mail do aluno
                </label>
                <input
                  id="student-email"
                  type="email"
                  required
                  autoComplete="off"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="joao@email.com"
                  className={inputClassName}
                />
              </div>
              <div>
                <label htmlFor="student-password" className={labelClassName}>
                  Senha provisória
                </label>
                <div className="flex gap-2">
                  <input
                    id="student-password"
                    type="text"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    className={cn(inputClassName, 'font-mono tracking-wider')}
                  />
                  <button
                    type="button"
                    onClick={() => setPassword(generatePassword())}
                    aria-label="Gerar nova senha"
                    className="grid h-[50px] w-12 shrink-0 place-items-center rounded-2xl border border-line-strong text-zinc-300 hover:text-white"
                  >
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-zinc-500">Envie a senha para o aluno; ele pode trocá-la no Perfil do app.</p>
              </div>

              {createError && <Alert variant="error">{createError}</Alert>}

              <m.button
                type="submit"
                disabled={creating}
                whileTap={{ scale: 0.98 }}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-white text-sm font-black uppercase tracking-[0.16em] text-black disabled:opacity-60"
              >
                {creating ? <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Cadastrando" /> : 'Cadastrar aluno'}
              </m.button>
            </m.form>
          )}
        </AnimatePresence>
      </Modal>
    </div>
  )
}
