'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { m } from 'framer-motion'
import {
  BatteryLow,
  Camera,
  ChevronRight,
  ClipboardList,
  LoaderCircle,
  Megaphone,
  TimerOff,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { avatarUrlOf } from '@/lib/profile'
import { formatKg } from '@/lib/workouts'
import { relativeDay, relativeDayPhrase, startOfDay, startOfWeek } from '@/lib/stats'
import { cn } from '@/lib/cn'
import { MISSING_SESSION, friendlyError } from '@/lib/errors'
import { Alert } from '@/components/ui/alert'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Avatar } from '@/components/ui/avatar'
import { ProgressRing } from '@/components/ui/progress-ring'
import { PageSkeleton } from '@/components/ui/skeleton'
import { Eyebrow, Stagger, Tile, tileVariants } from '@/components/ui/tile'
import { WeeklyTrainingInsights } from '@/components/workout/WeeklyTrainingInsights'
import { ProfileImageEditor } from '@/components/profile/ProfileImageEditor'
import { CoachRadar } from '@/components/coach/CoachRadar'
import { WhatsAppComeback } from '@/components/coach/WhatsAppComeback'
import { FinanceSummaryTile } from '@/components/finance/FinanceSummaryTile'
import { PushNotificationsTile } from '@/components/account/PushNotificationsTile'

type SessionRow = {
  id: string
  student_id: string
  completed_at: string
  session_rpe: number | null
  assigned_workouts: { name: string | null } | null
}

type DashboardData = {
  coach: Profile
  students: Profile[]
  sessions: SessionRow[]
  volumeBySession: Map<string, number>
}

const WINDOW_DAYS = 30

function greeting(date: Date) {
  const hour = date.getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function AdminDashboardPage() {
  const [supabase] = useState(() => createClient())
  const [data, setData] = useState<DashboardData | null>(null)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const closePhotoMenu = useCallback(() => setPhotoMenuOpen(false), [])
  const handlePhotoUploading = useCallback((kind: string | null) => setUploadingPhoto(kind !== null), [])

  useEffect(() => {
    let active = true

    const load = async () => {
      const user = await getCurrentUser(supabase)
      if (!active) return
      if (!user) {
        setLoadError(friendlyError(MISSING_SESSION, 'Não foi possível carregar o painel'))
        return
      }
      const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000)

      const [coachResult, studentsResult, sessionsResult] = await Promise.all([
        // select('*'): a foto (avatar_path) só existe depois do profile.sql.
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('profiles').select('*').eq('role', 'student').order('full_name'),
        supabase
          .from('workout_sessions')
          .select('id, student_id, completed_at, session_rpe, assigned_workouts(name)')
          .eq('status', 'completed')
          .gte('completed_at', since.toISOString())
          .order('completed_at', { ascending: false })
          .limit(300),
      ])
      if (!active) return

      const error = studentsResult.error ?? sessionsResult.error
      if (error) {
        setLoadError(friendlyError(error, 'Não foi possível carregar o painel'))
        return
      }

      const sessions = ((sessionsResult.data ?? []) as unknown as SessionRow[]).filter((session) => session.completed_at)
      const recent = sessions.slice(0, 8)
      const volumeBySession = new Map<string, number>()
      if (recent.length > 0) {
        const { data: sets } = await supabase
          .from('session_sets')
          .select('session_id, weight_kg, reps')
          .in(
            'session_id',
            recent.map((session) => session.id),
          )
          .eq('completed', true)
        if (!active) return
        for (const set of (sets ?? []) as { session_id: string; weight_kg: number | null; reps: number | null }[]) {
          const volume = (Number(set.weight_kg) || 0) * (Number(set.reps) || 0)
          volumeBySession.set(set.session_id, (volumeBySession.get(set.session_id) ?? 0) + volume)
        }
      }

      setLoadError('')
      setData({
        coach: { id: user.id, role: 'admin', full_name: null, email: user.email ?? null, ...(coachResult.data as Partial<Profile> | null) },
        students: (studentsResult.data ?? []) as Profile[],
        sessions,
        volumeBySession,
      })
    }

    void load()
    return () => {
      active = false
    }
  }, [supabase, attempt])

  const retry = () => {
    setLoadError('')
    setAttempt((value) => value + 1)
  }

  const derived = useMemo(() => {
    if (!data) return null
    const now = new Date()
    const weekStart = startOfWeek(now)
    const lastByStudent = new Map<string, Date>()
    for (const session of data.sessions) {
      if (!lastByStudent.has(session.student_id)) lastByStudent.set(session.student_id, new Date(session.completed_at))
    }
    const weekSessions = data.sessions.filter((session) => new Date(session.completed_at) >= weekStart)
    const trainedThisWeek = new Set(weekSessions.map((session) => session.student_id))
    const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
      const day = startOfDay(now)
      day.setDate(day.getDate() - (6 - index))
      const next = new Date(day)
      next.setDate(next.getDate() + 1)
      return data.sessions.filter((session) => {
        const date = new Date(session.completed_at)
        return date >= day && date < next
      }).length
    })
    const readinessValues = data.students
      .map((student) => student.readiness_score)
      .filter((value): value is number => typeof value === 'number')

    const inactive = data.students
      .map((student) => ({ student, last: lastByStudent.get(student.id) ?? null }))
      .filter(({ last }) => !last || now.getTime() - last.getTime() > 7 * 86_400_000)
      .sort((first, second) => (first.last?.getTime() ?? 0) - (second.last?.getTime() ?? 0))
    const lowReadiness = data.students.filter(
      (student) => typeof student.readiness_score === 'number' && student.readiness_score < 50,
    )

    return {
      studentById: new Map(data.students.map((student) => [student.id, student])),
      weekSessions: weekSessions.length,
      trainedThisWeek: trainedThisWeek.size,
      adherence: data.students.length > 0 ? trainedThisWeek.size / data.students.length : 0,
      lastSevenDays,
      averageReadiness:
        readinessValues.length > 0 ? readinessValues.reduce((total, value) => total + value, 0) / readinessValues.length : null,
      inactive,
      lowReadiness,
    }
  }, [data])

  if (loadError && !data)
    return (
      <Alert variant="error" onRetry={retry}>
        {loadError}
      </Alert>
    )
  if (!data || !derived) return <PageSkeleton label="Carregando painel" />

  const now = new Date()
  const maxDay = Math.max(1, ...derived.lastSevenDays)
  const coachName = data.coach.full_name?.trim().split(' ')[0] || 'treinador'
  const readinessColor =
    derived.averageReadiness === null
      ? 'text-zinc-400'
      : derived.averageReadiness >= 80
        ? 'text-brand'
        : derived.averageReadiness >= 50
          ? 'text-gold'
          : 'text-danger'

  return (
    <div className="space-y-8">
      <Stagger className="space-y-4">
        <m.header variants={tileVariants} className="relative isolate flex items-start justify-between gap-3 px-1">
          <div aria-hidden="true" className="aurora" />
          <div className="min-w-0">
            <Eyebrow>{now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</Eyebrow>
            <h1 className="mt-1.5 font-display text-[2.75rem] font-bold uppercase leading-[0.9]">
              {greeting(now)}, {coachName}!
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              {derived.trainedThisWeek === 0
                ? 'Nenhum aluno treinou ainda nesta semana.'
                : `${derived.trainedThisWeek} de ${data.students.length} alunos já treinaram nesta semana.`}
            </p>
          </div>
          {/* Sua foto aparece nos posts e comentários da comunidade. */}
          <m.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => setPhotoMenuOpen(true)}
            disabled={uploadingPhoto}
            className="relative mt-1 shrink-0 rounded-full"
          >
            <Avatar
              name={data.coach.full_name ?? data.coach.email}
              seed={data.coach.id}
              src={avatarUrlOf(data.coach)}
              size="lg"
              className="rounded-full ring-2 ring-brand/60 ring-offset-2 ring-offset-black"
            />
            <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-black bg-brand text-black">
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            {uploadingPhoto && (
              <span className="absolute inset-0 grid place-items-center rounded-full bg-black/60">
                <LoaderCircle className="h-5 w-5 animate-spin text-white" aria-hidden="true" />
              </span>
            )}
            <span className="sr-only">{data.coach.avatar_path ? 'Trocar sua foto de perfil' : 'Adicionar sua foto de perfil'}</span>
          </m.button>
        </m.header>

        {/* Indicadores */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile className="flex flex-col justify-between p-4">
            <Eyebrow icon={TrendingUp}>Adesão</Eyebrow>
            <div className="mt-3 flex items-center gap-3">
              <ProgressRing value={derived.adherence} size={64} stroke={6} label={`${Math.round(derived.adherence * 100)}% dos alunos treinaram`}>
                <span className="font-display text-xl font-bold">{Math.round(derived.adherence * 100)}%</span>
              </ProgressRing>
              <p className="text-xs leading-snug text-zinc-400">
                <span className="font-bold text-white">{derived.trainedThisWeek}</span> de {data.students.length} treinaram
              </p>
            </div>
          </Tile>

          <Tile className="flex flex-col justify-between p-4">
            <Eyebrow icon={ClipboardList}>Treinos</Eyebrow>
            <p className="mt-2 font-display text-5xl font-bold leading-none">
              <AnimatedNumber value={derived.weekSessions} />
            </p>
            <div className="mt-2 flex h-8 items-end gap-1" aria-label="Treinos concluídos nos últimos 7 dias" role="img">
              {derived.lastSevenDays.map((count, index) => (
                <m.span
                  key={index}
                  className={cn('flex-1 rounded-sm', index === 6 ? 'bg-brand' : count > 0 ? 'bg-white/30' : 'bg-white/[0.07]')}
                  initial={{ height: 0 }}
                  animate={{ height: `${count > 0 ? Math.max(20, (count / maxDay) * 100) : 12}%` }}
                  transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.2 + index * 0.04 }}
                />
              ))}
            </div>
          </Tile>

          <Tile className="flex flex-col justify-between p-4">
            <Eyebrow icon={Users}>Alunos</Eyebrow>
            <p className="mt-2 font-display text-5xl font-bold leading-none">
              <AnimatedNumber value={data.students.length} />
            </p>
            <Link href="/admin/students?novo=1" className="mt-2 flex items-center gap-1 text-xs font-bold text-brand">
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> Cadastrar aluno
            </Link>
          </Tile>

          <Tile className="flex flex-col justify-between p-4">
            <Eyebrow icon={Zap}>Prontidão média</Eyebrow>
            <p className={cn('mt-2 font-display text-5xl font-bold leading-none', readinessColor)}>
              {derived.averageReadiness === null ? '—' : <AnimatedNumber value={derived.averageReadiness} />}
              {derived.averageReadiness !== null && <span className="text-xl">%</span>}
            </p>
            <p className="mt-2 text-xs text-zinc-500">Informada pelos alunos</p>
          </Tile>
        </div>

        {/* Ações rápidas */}
        <m.div variants={tileVariants} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {[
            { href: '/admin/workouts', label: 'Prescrever treino', icon: ClipboardList },
            { href: '/admin/students?novo=1', label: 'Novo aluno', icon: UserPlus },
            { href: '/admin/announcements', label: 'Enviar aviso', icon: Megaphone },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 text-xs font-bold text-zinc-200 transition hover:border-line-strong hover:text-white"
            >
              <action.icon className="h-4 w-4 text-brand" aria-hidden="true" />
              {action.label}
            </Link>
          ))}
        </m.div>

        {/* No computador: radar e atividade à esquerda; dinheiro e alertas à direita. */}
        {/* No celular os dois blocos "se desmancham" (contents) e as peças se ordenam
            pela prioridade: dinheiro e quem precisa de atenção primeiro, depois o radar. */}
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="contents lg:block lg:space-y-4">
            {/* Radar: recados, recordes, progressões e cansaço */}
            <div className="order-3">
              <CoachRadar students={data.students} />
            </div>

            {/* Atividade recente */}
            <Tile className="order-4 p-0">
              <div className="flex items-center justify-between px-5 pb-1 pt-5">
                <Eyebrow>Atividade recente</Eyebrow>
                <span className="text-xs font-bold text-zinc-500">últimos {WINDOW_DAYS} dias</span>
              </div>
              {data.sessions.length === 0 ? (
                <p className="px-5 pb-5 pt-2 text-sm text-zinc-500">Nenhum treino concluído no período.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.sessions.slice(0, 8).map((session) => {
                    const student = derived.studentById.get(session.student_id)
                    const volume = data.volumeBySession.get(session.id)
                    return (
                      <li key={session.id}>
                        <Link
                          href={`/admin/students?aluno=${session.student_id}`}
                          className="flex items-center gap-3 px-5 py-3 transition hover:bg-white/[0.02]"
                        >
                          <Avatar name={student?.full_name ?? student?.email} seed={session.student_id} src={avatarUrlOf(student)} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-zinc-300">
                              <span className="font-bold text-white">{student?.full_name?.split(' ')[0] ?? 'Aluno'}</span> concluiu{' '}
                              <span className="font-semibold text-zinc-200">{session.assigned_workouts?.name ?? 'um treino'}</span>
                            </span>
                            <span className="mt-0.5 block text-xs text-zinc-500">
                              {relativeDay(new Date(session.completed_at))}
                              {session.session_rpe != null && ` · RPE ${session.session_rpe}`}
                              {volume ? ` · ${formatKg(volume)} kg` : ''}
                            </span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden="true" />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Tile>
          </div>

          <div className="contents lg:block lg:space-y-4">
            <div className="order-1">
              <FinanceSummaryTile students={data.students} />
            </div>

            {/* Atenção */}
            {(derived.inactive.length > 0 || derived.lowReadiness.length > 0) && (
              <Tile className="order-2 space-y-4">
                <Eyebrow className="text-gold/90">Precisam de atenção</Eyebrow>
                {derived.inactive.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-zinc-300">
                      <TimerOff className="h-3.5 w-3.5 text-gold" aria-hidden="true" /> Sem treinar há mais de 7 dias
                    </p>
                    <ul className="space-y-1.5">
                      {derived.inactive.slice(0, 5).map(({ student, last }) => (
                        <li key={student.id} className="space-y-2 rounded-2xl bg-white/[0.03] px-3 py-2.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={student.full_name ?? student.email} seed={student.id} src={avatarUrlOf(student)} size="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-white [overflow-wrap:anywhere]">{student.full_name || student.email}</span>
                              <span className="block text-xs text-zinc-400">
                                {last ? `Último treino ${relativeDayPhrase(last)}` : `Sem treinos nos últimos ${WINDOW_DAYS} dias`}
                              </span>
                            </span>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Link
                              href={`/admin/announcements?para=${student.id}`}
                              className="inline-flex h-11 shrink-0 items-center rounded-xl bg-white px-4 text-sm font-bold text-black"
                            >
                              Avisar
                            </Link>
                            <WhatsAppComeback fullName={student.full_name} last={last} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {derived.lowReadiness.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-zinc-300">
                      <BatteryLow className="h-3.5 w-3.5 text-danger" aria-hidden="true" /> Prontidão baixa
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {derived.lowReadiness.map((student) => (
                        <li key={student.id}>
                          <Link
                            href={`/admin/students?aluno=${student.id}`}
                            className="flex items-center gap-2 rounded-full border border-danger/30 bg-danger-soft py-1 pl-1 pr-3 text-xs font-semibold text-white"
                          >
                            <Avatar name={student.full_name ?? student.email} seed={student.id} src={avatarUrlOf(student)} size="sm" className="h-7 w-7 rounded-full text-xs" />
                            {student.full_name?.split(' ')[0] ?? 'Aluno'}
                            <span className="font-bold text-danger">{student.readiness_score}%</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Tile>
            )}

            <div className="order-5">
              <PushNotificationsTile coach />
            </div>
          </div>
        </div>
      </Stagger>

      <WeeklyTrainingInsights mode="admin" />

      <ProfileImageEditor
        userId={data.coach.id}
        kind="avatar"
        open={photoMenuOpen}
        currentPath={data.coach.avatar_path}
        onClose={closePhotoMenu}
        onChange={(_, path) => setData((current) => (current ? { ...current, coach: { ...current.coach, avatar_path: path } } : current))}
        onUploadingChange={handlePhotoUploading}
      />
    </div>
  )
}
