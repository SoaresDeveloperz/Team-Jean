'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { m } from 'framer-motion'
import { Check, ChevronDown, ChevronRight, Clock, Dumbbell, Flame, Hourglass, Megaphone, Moon, Play, RotateCcw, Sparkles, Target } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import type { AssignedWorkout, Exercise, PrescribedExercise } from '@/lib/types'
import { getPlannedSets, getSetsCount } from '@/lib/workouts'
import { WEEKDAY_NAMES, WEEKDAY_SHORT, buildLastDone, completionOf, doneThisWeek, orderWorkouts, planWeek, weekdayThisWeek, workoutWeekState, type WeekPlan } from '@/lib/week-plan'
import { queuedCompletions } from '@/lib/workout-sync'
import { readActiveSession } from '@/lib/active-session'
import { canOfferShort } from '@/lib/short-workout'
import { REGION_LABELS, computeRecovery, loadFill, muscleLoad, recoveryFill, splitSecondary, type MuscleRegion } from '@/lib/muscles'
import { WEEKDAY_INITIALS, countInMonth, isSameDay, relativeDay, startOfWeek, weekDayCounts, weekStreak } from '@/lib/stats'
import { usePreferences } from '@/lib/preferences'
import { openNotifications, useNotifications } from '@/lib/notifications'
import { cn } from '@/lib/cn'
import { BarFill } from '@/components/ui/bar-fill'
import { MISSING_SESSION, friendlyError } from '@/lib/errors'
import { Alert } from '@/components/ui/alert'
import { PageSkeleton } from '@/components/ui/skeleton'
import { ProgressRing } from '@/components/ui/progress-ring'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Eyebrow, Stagger, Tile } from '@/components/ui/tile'
import { MuscleMap } from '@/components/fitness/MuscleMap'
import { ReadinessCard } from '@/components/fitness/ReadinessCard'
import { AnamnesePrompt } from '@/components/health/AnamnesePrompt'

type ExerciseRow = PrescribedExercise & { exercises: (Partial<Exercise> & { secondary_muscle?: string | null }) | null }

type TodayData = {
  firstName: string
  workouts: AssignedWorkout[]
  // Plano da semana (qual treino mostrar agora); `next` é o treino do cartão principal.
  plan: WeekPlan<AssignedWorkout> | null
  next: AssignedWorkout | null
  inProgress: boolean
  lastDoneByWorkout: Map<string, string>
  completedDates: Date[]
  exercises: ExerciseRow[]
  recovery: Partial<Record<MuscleRegion, number>>
}

const READINESS_SAVE_DELAY_MS = 700
// Estimativa: execução + descanso médio por série.
const MINUTES_PER_SET = 2.5
// Janela para calcular recuperação: o maior tempo de recuperação (72h) + folga.
const RECOVERY_WINDOW_MS = 4 * 86_400_000

function workoutLetter(index: number) {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1)
}

export default function StudentTodayPage() {
  const [supabase] = useState(() => createClient())
  const [data, setData] = useState<TodayData | null>(null)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [readiness, setReadiness] = useState(80)
  const [readinessStatus, setReadinessStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimer = useRef<number | null>(null)
  const saveRequest = useRef(0)
  const { weeklyGoal } = usePreferences()
  const { items: notices, unseen } = useNotifications()

  useEffect(() => {
    let active = true

    const load = async () => {
      const user = await getCurrentUser(supabase)
      if (!active) return
      if (!user) {
        setLoadError(friendlyError(MISSING_SESSION, 'Não foi possível carregar seu treino'))
        return
      }
      setUserId(user.id)

      const [profileResult, workoutsResult, sessionsResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase
          .from('assigned_workouts')
          .select('*')
          .eq('student_id', user.id)
          .eq('is_current', true)
          .order('name', { ascending: true }),
        supabase
          .from('workout_sessions')
          .select('id, assigned_workout_id, completed_at, assigned_workouts(name)')
          .eq('student_id', user.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(60),
      ])
      if (!active) return

      const error = profileResult.error ?? workoutsResult.error ?? sessionsResult.error
      if (error) {
        // Se já havia um treino na tela, ele continua lá com o aviso.
        setLoadError(friendlyError(error, 'Não foi possível carregar seu treino'))
        return
      }

      const workouts = (workoutsResult.data ?? []) as AssignedWorkout[]
      const sessions = (
        (sessionsResult.data ?? []) as unknown as { id: string; assigned_workout_id: string; completed_at: string | null; assigned_workouts?: { name: string } | null }[]
      ).filter((session): session is { id: string; assigned_workout_id: string; completed_at: string; assigned_workouts?: { name: string } | null } => Boolean(session.completed_at))

      // Servidor + o que foi finalizado no aparelho e ainda não subiu (conta como feito na semana).
      const lastDoneByWorkout = buildLastDone([
        ...sessions.map((session) => ({ workoutId: session.assigned_workout_id, completedAt: session.completed_at, workoutName: session.assigned_workouts?.name })),
        ...queuedCompletions(user.id).map((item) => ({ ...item, workoutName: workouts.find((workout) => workout.id === item.workoutId)?.name })),
      ])
      const inProgressWorkoutId = readActiveSession(user.id)?.workoutId ?? null
      const plan = planWeek(workouts, lastDoneByWorkout, new Date(), inProgressWorkoutId)
      const next = plan ? (plan.kind === 'rest' ? plan.suggestion : plan.workout) : null
      const recentSessions = sessions.filter((session) => Date.now() - new Date(session.completed_at).getTime() < RECOVERY_WINDOW_MS)

      const [exercisesResult, recentSetsResult] = await Promise.all([
        next
          ? supabase
              .from('assigned_workout_exercises')
              .select('*, exercises(*)')
              .eq('assigned_workout_id', next.id)
              .order('order', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        recentSessions.length > 0
          ? supabase
              .from('session_sets')
              .select('session_id, exercises(*)')
              .in(
                'session_id',
                recentSessions.map((session) => session.id),
              )
              .eq('completed', true)
          : Promise.resolve({ data: [], error: null }),
      ])
      if (!active) return

      const completedAtBySession = new Map(recentSessions.map((session) => [session.id, new Date(session.completed_at)]))
      const recoveryEntries = (
        (recentSetsResult.data ?? []) as unknown as { session_id: string; exercises: ExerciseRow['exercises'] }[]
      ).flatMap((set) => {
        const completedAt = completedAtBySession.get(set.session_id)
        if (!completedAt) return []
        return [
          { completedAt, muscle: set.exercises?.muscle_group, amount: 1, exercise: set.exercises?.name },
          ...splitSecondary(set.exercises?.secondary_muscle).map((muscle) => ({ completedAt, muscle, amount: 0.5 })),
        ]
      })

      const profile = profileResult.data as { full_name?: string | null; readiness_score?: number | null } | null
      if (typeof profile?.readiness_score === 'number') setReadiness(profile.readiness_score)

      setLoadError('')
      setData({
        firstName: profile?.full_name?.trim().split(' ')[0] || 'Atleta',
        workouts,
        plan,
        next,
        inProgress: plan?.kind === 'in-progress',
        lastDoneByWorkout,
        completedDates: sessions.map((session) => new Date(session.completed_at)),
        exercises: (exercisesResult.data ?? []) as ExerciseRow[],
        recovery: computeRecovery(recoveryEntries),
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

  useEffect(
    () => () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
    },
    [],
  )

  // Salva só depois que o aluno para de arrastar.
  const handleReadinessChange = (value: number) => {
    setReadiness(value)
    if (!userId) return
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)

    saveTimer.current = window.setTimeout(async () => {
      const requestId = ++saveRequest.current
      setReadinessStatus('saving')
      const { error } = await supabase.from('profiles').update({ readiness_score: value }).eq('id', userId)
      if (requestId === saveRequest.current) setReadinessStatus(error ? 'error' : 'saved')
    }, READINESS_SAVE_DELAY_MS)
  }

  const derived = useMemo(() => {
    if (!data) return null
    const now = new Date()
    const totalSets = data.exercises.reduce((total, item) => total + getSetsCount(item), 0)
    const load = muscleLoad(
      data.exercises.flatMap((item) => [
        { muscle: item.exercises?.muscle_group, amount: getSetsCount(item), exercise: item.exercises?.name },
        ...splitSecondary(item.exercises?.secondary_muscle).map((muscle) => ({ muscle, amount: getSetsCount(item) / 2 })),
      ]),
    )
    const workFills: Partial<Record<MuscleRegion, string>> = {}
    for (const [region, intensity] of Object.entries(load) as [MuscleRegion, number][]) {
      workFills[region] = loadFill(intensity)
    }
    const recoveryFills: Partial<Record<MuscleRegion, string>> = {}
    for (const [region, value] of Object.entries(data.recovery) as [MuscleRegion, number][]) {
      const fill = recoveryFill(value)
      if (fill) recoveryFills[region] = fill
    }
    const recovering = (Object.entries(data.recovery) as [MuscleRegion, number][])
      .filter(([, value]) => value < 0.85)
      .sort((first, second) => first[1] - second[1])

    return {
      totalSets,
      // "Tenho pouco tempo" só aparece quando o treino passa de ~30 min.
      offerShort: canOfferShort(
        data.exercises.map((item) => ({
          id: item.id,
          name: item.exercises?.name ?? 'Exercício',
          sets: getPlannedSets(item).map((set) => ({ type: set.type, completed: false, extra: false })),
        })),
      ),
      estimatedMinutes: Math.max(10, Math.round((totalSets * MINUTES_PER_SET) / 5) * 5),
      muscles: [
        ...new Set(data.exercises.map((item) => item.exercises?.muscle_group).filter((muscle): muscle is string => Boolean(muscle))),
      ],
      workFills,
      recoveryFills,
      recovering,
      streak: weekStreak(data.completedDates, now),
      monthCount: countInMonth(data.completedDates, now),
      weekDays: weekDayCounts(data.completedDates, now),
      weekCount: data.completedDates.filter((date) => date >= startOfWeek(now)).length,
      trainedToday: data.completedDates.some((date) => isSameDay(date, now)),
      todayIndex: (now.getDay() + 6) % 7,
    }
  }, [data])

  const errorAlert = loadError ? (
    <Alert variant="error" onRetry={retry}>
      {loadError}
    </Alert>
  ) : null
  if (!data || !derived) return errorAlert ?? <PageSkeleton label="Carregando seu dia" />

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const next = data.next
  const lastDone = next ? completionOf(next, data.lastDoneByWorkout) : undefined
  const latestNotice = unseen[0] ?? notices[0]
  const goalProgress = Math.min(1, derived.weekCount / Math.max(1, weeklyGoal))
  // "Repetir" só faz sentido na rotação sem dias (o próximo treino já tem dia, ou é descanso, nos outros casos).
  const doneForToday = derived.trainedToday && !data.inProgress && data.plan?.kind === 'next'
  // Dia de descanso (ou semana completa): o cartão mostra o que dá para adiantar, com botão discreto.
  const restPlan = data.plan?.kind === 'rest' && !data.inProgress ? data.plan : null
  const weekDone = data.plan?.kind === 'week-done' && !data.inProgress
  const softCta = doneForToday || Boolean(restPlan) || weekDone
  const suggestionDayNumber = restPlan ? weekdayThisWeek(restPlan.suggestion, new Date()) : null
  const suggestionDay = suggestionDayNumber !== null ? WEEKDAY_NAMES[suggestionDayNumber] : null

  let subtitle = 'Seu treinador ainda não liberou um treino. Aproveite para recuperar.'
  if (data.inProgress) subtitle = 'Você tem um treino em andamento. Quer terminar?'
  else if (data.plan?.kind === 'rest') subtitle = data.plan.doneToday ? 'Treino de hoje feito. Descansar também é treinar.' : 'Hoje não tem treino marcado.'
  else if (derived.trainedToday && data.plan?.kind === 'next') subtitle = 'Treino de hoje feito. Descansar também é treinar.'
  else if (data.plan?.kind === 'week-done') subtitle = 'Semana completa! Parabéns.'
  else if (data.plan?.kind === 'today' && next) subtitle = `Hoje é dia de ${next.name}.`
  else if (next && data.workouts.every((workout) => !doneThisWeek(completionOf(workout, data.lastDoneByWorkout), new Date()))) subtitle = `Semana nova! Começa pelo ${next.name}.`
  else if (next) subtitle = `Bora pro ${next.name}?`

  return (
    <Stagger className="space-y-4">
      {errorAlert}
      <m.header variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="px-1 pb-1 pt-1">
        <p className="text-sm font-semibold text-zinc-400 first-letter:uppercase">{today}</p>
        <h1 className="mt-1.5 font-display text-[2.75rem] font-bold uppercase leading-[0.9] tracking-tight">
          Fala, {data.firstName}!
        </h1>
        <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
        <Link href="/student/week" className="-ml-1 mt-1 inline-flex min-h-11 items-center px-1 text-sm font-bold text-brand hover:text-white">
          Ver minha semana
        </Link>
      </m.header>

      {/* Treino do dia */}
      {next ? (
        <Tile className="glow-brand rounded-[2rem] p-0">
          <div className="flex gap-3 p-5 pb-0">
            <div className="min-w-0 flex-1">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-[0.1em]',
                  data.inProgress
                    ? 'border-gold/30 bg-gold-soft text-gold'
                    : softCta
                      ? 'border-line-strong bg-white/5 text-zinc-300'
                      : 'border-brand/30 bg-brand-soft text-brand',
                )}
              >
                {data.inProgress ? (
                  <>
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" /> Em andamento
                  </>
                ) : restPlan ? (
                  <>
                    <Moon className="h-3 w-3" aria-hidden="true" /> {restPlan.doneToday ? 'Treino de hoje feito' : 'Dia de descanso'}
                  </>
                ) : weekDone ? (
                  <>
                    <Sparkles className="h-3 w-3" aria-hidden="true" /> Semana completa!
                  </>
                ) : doneForToday ? (
                  <>
                    <Check className="h-3 w-3" aria-hidden="true" /> Próximo da rotina
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" aria-hidden="true" /> Treino de hoje
                  </>
                )}
              </span>
              <h2 className="mt-3 font-display text-[2.1rem] font-bold uppercase leading-[0.92]">{next.name}</h2>
              <p className="mt-2 text-xs text-zinc-400">
                {restPlan
                  ? `Descansar também conta.${suggestionDay ? ` Próximo: ${suggestionDay}.` : ''}`
                  : weekDone
                    ? 'Você fez todos os treinos desta semana. Treinar de novo é bônus.'
                    : lastDone
                      ? `Feito pela última vez ${relativeDay(new Date(lastDone))}`
                      : 'Hoje é um bom dia para este treino'}
              </p>
            </div>
            <div className="w-[40%] max-w-[160px] shrink-0">
              <MuscleMap fills={derived.workFills} />
            </div>
          </div>

          <dl className="mx-5 mt-4 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-black/30">
            {[
              { label: 'Exercícios', value: String(data.exercises.length) },
              { label: 'Séries', value: String(derived.totalSets) },
              { label: 'Duração', value: `~${derived.estimatedMinutes} min` },
            ].map((stat) => (
              <div key={stat.label} className="px-3 py-2.5 text-center">
                <dt className="text-xs font-bold text-zinc-400">{stat.label}</dt>
                <dd className="font-display text-2xl font-bold leading-tight">{stat.value}</dd>
              </div>
            ))}
          </dl>

          {derived.muscles.length > 0 && (
            <ul className="mx-5 mt-3 flex flex-wrap gap-1.5" aria-label="Grupos musculares">
              {derived.muscles.slice(0, 5).map((muscle) => (
                <li
                  key={muscle}
                  className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-zinc-300"
                >
                  {muscle}
                </li>
              ))}
            </ul>
          )}

          <div className="p-5 pt-4">
            <m.div whileTap={{ scale: 0.97 }}>
              <Link
                href={`/student/workout/${next.id}`}
                className={cn(
                  'flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl text-base font-bold transition',
                  softCta
                    ? 'border border-line-strong bg-white/5 text-white hover:bg-white/10'
                    : 'bg-white text-black shadow-[0_8px_30px_rgba(255,255,255,0.12)] hover:bg-zinc-200',
                )}
              >
                {data.inProgress ? (
                  <>
                    <RotateCcw className="h-5 w-5" aria-hidden="true" /> Continuar treino
                  </>
                ) : restPlan ? (
                  <>
                    <Play className="h-5 w-5 fill-current" aria-hidden="true" /> Adiantar este treino
                  </>
                ) : weekDone ? (
                  <>
                    <RotateCcw className="h-5 w-5" aria-hidden="true" /> Treinar de novo (bônus)
                  </>
                ) : doneForToday ? (
                  <>
                    <RotateCcw className="h-5 w-5" aria-hidden="true" /> Repetir treino
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 fill-current" aria-hidden="true" /> Começar treino
                  </>
                )}
              </Link>
            </m.div>
            {derived.offerShort && !data.inProgress && !doneForToday && !weekDone && !restPlan && (
              <Link
                href={`/student/workout/${next.id}?curto=1`}
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line-strong text-sm font-bold text-zinc-200 transition hover:bg-white/5"
              >
                <Hourglass className="h-4 w-4" aria-hidden="true" /> Tenho pouco tempo
              </Link>
            )}
          </div>
        </Tile>
      ) : (
        <Tile className="rounded-[2rem] py-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-zinc-400">
            <Moon className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold uppercase">Dia de descanso</h2>
          <p className="mx-auto mt-1 max-w-[16rem] text-sm text-zinc-500">
            Quando o treinador liberar seu treino, ele aparece aqui.
          </p>
        </Tile>
      )}

      {/* Recado do treinador: logo abaixo do treino do dia */}
      {latestNotice && (
        <Tile className="p-0">
          <button type="button" onClick={openNotifications} className="flex w-full items-start gap-3 p-5 text-left">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-black">
              <Megaphone className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <Eyebrow>Recado do treinador</Eyebrow>
                {unseen.length > 0 && (
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-brand px-2 py-0.5 text-xs font-black text-black">
                    {unseen.length} novo{unseen.length > 1 ? 's' : ''}
                  </span>
                )}
              </span>
              <span className="mt-1 block truncate text-sm font-bold text-white">{latestNotice.title}</span>
              <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-400">{latestNotice.message}</span>
            </span>
            <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-zinc-600" aria-hidden="true" />
          </button>
        </Tile>
      )}

      {/* Bento: sequência + meta semanal */}
      <div className="grid grid-cols-2 gap-3">
        <Tile className="flex flex-col justify-between">
          <Eyebrow icon={Flame} className="text-gold/80">
            Sequência
          </Eyebrow>
          <div className="mt-3">
            <p className="font-display text-6xl font-bold leading-none text-white">
              <AnimatedNumber value={derived.streak} />
            </p>
            <p className="mt-1 text-xs font-semibold text-zinc-400">
              {derived.streak === 1 ? 'semana seguida' : 'semanas seguidas'}
            </p>
          </div>
          <p className="mt-3 border-t border-line pt-2.5 text-xs text-zinc-500">
            <span className="font-bold text-zinc-300">{derived.monthCount}</span> treinos neste mês
          </p>
        </Tile>

        <Tile className="flex flex-col justify-between">
          <Eyebrow icon={Target}>Meta da semana</Eyebrow>
          <div className="mt-3 flex items-center gap-3">
            <ProgressRing value={goalProgress} size={58} stroke={6} label={`${derived.weekCount} de ${weeklyGoal} treinos nesta semana`}>
              <span className="font-display text-xl font-bold leading-none">
                {derived.weekCount}
                <span className="text-sm text-zinc-500">/{weeklyGoal}</span>
              </span>
            </ProgressRing>
            <p className="text-xs leading-snug text-zinc-400">
              {derived.weekCount >= weeklyGoal ? 'Meta batida!' : derived.weekCount === 0 ? 'Um treino começa a semana' : 'Boa! Vem mais um.'}
            </p>
          </div>
          <ol className="mt-3 flex justify-between border-t border-line pt-2.5" aria-label="Dias treinados nesta semana">
            {WEEKDAY_INITIALS.map((initial, index) => {
              const trained = derived.weekDays[index] > 0
              const isToday = index === derived.todayIndex
              return (
                <li key={index}>
                  <span
                    className={cn(
                      'grid h-5 w-5 place-items-center rounded-full text-xs font-black',
                      trained
                        ? 'bg-brand text-black'
                        : isToday
                          ? 'text-white ring-1 ring-white/40'
                          : 'bg-white/[0.06] text-zinc-500',
                    )}
                  >
                    {trained ? <Check className="h-3 w-3" aria-label="treinou" /> : initial}
                  </span>
                </li>
              )
            })}
          </ol>
        </Tile>
      </div>

      {userId && <AnamnesePrompt studentId={userId} />}

      <ReadinessCard value={readiness} onChange={handleReadinessChange} status={readinessStatus} />

      {/* Rotina em carrossel */}
      {data.workouts.length > 1 && (
        <m.section variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }} aria-label="Sua rotina">
          <div className="mb-2.5 flex items-center justify-between px-1">
            <Eyebrow>Sua rotina</Eyebrow>
            <Link href="/student/week" className="inline-flex min-h-11 items-center text-xs font-bold text-zinc-400 hover:text-white">
              Semana completa
            </Link>
          </div>
          <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
            {orderWorkouts(data.workouts).map((workout, index) => {
              const isNext = workout.id === next?.id
              const done = completionOf(workout, data.lastDoneByWorkout)
              const weekState = workoutWeekState(workout, data.lastDoneByWorkout, new Date())
              const weekDay = weekdayThisWeek(workout, new Date())
              return (
                <li key={workout.id} className="w-[62%] max-w-[220px] shrink-0 snap-start">
                  <Link
                    href={`/student/workout/${workout.id}`}
                    className={cn(
                      'flex h-full flex-col gap-3 rounded-3xl border bg-surface p-4 transition hover:border-line-strong',
                      isNext ? 'border-brand/40' : 'border-line',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-10 min-w-10 place-items-center self-start rounded-xl px-2 font-display text-xl font-bold',
                        isNext ? 'bg-brand text-black' : 'bg-white/[0.06] text-zinc-300',
                      )}
                      aria-hidden="true"
                    >
                      {weekDay !== null ? WEEKDAY_SHORT[weekDay] : workoutLetter(index)}
                    </span>
                    <span className="line-clamp-2 text-sm font-bold leading-snug text-white">
                      {weekDay !== null && <span className="sr-only">{WEEKDAY_NAMES[weekDay]}: </span>}
                      {workout.name}
                    </span>
                    <span className="mt-auto text-xs text-zinc-400">
                      {done ? `Feito ${relativeDay(new Date(done))}` : weekState === 'missed' ? 'Ainda dá tempo esta semana' : 'Ainda não feito'}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </m.section>
      )}
      {/* O resto do dia fica recolhido: a tela Hoje mostra primeiro o treino. */}
      <details className="group space-y-4">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 text-sm font-bold text-zinc-200 [&::-webkit-details-marker]:hidden">
          Ver mais do seu dia
          <ChevronDown className="h-4 w-4 transition-transform motion-reduce:transition-none group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="space-y-4 pt-1">
          {/* Recuperação muscular */}
          <Tile>
            <div className="flex gap-4">
              <div className="min-w-0 flex-1">
                <Eyebrow>Recuperação muscular</Eyebrow>
                {derived.recovering.length === 0 ? (
                  <>
                    <p className="mt-2 font-display text-2xl font-bold uppercase leading-none text-brand">Tudo pronto</p>
                    <p className="mt-1.5 text-xs text-zinc-400">Nenhum músculo em recuperação. Corpo liberado pra treinar.</p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-xs text-zinc-400">Com base nos seus últimos treinos:</p>
                    <ul className="mt-2.5 space-y-2">
                      {derived.recovering.slice(0, 4).map(([region, value]) => (
                        <li key={region}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-zinc-200">{REGION_LABELS[region]}</span>
                            <span className={cn('font-bold', value < 0.5 ? 'text-danger' : 'text-gold')}>
                              {Math.round(value * 100)}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                            <BarFill value={Math.max(0.06, value)} className={value < 0.5 ? 'bg-danger' : 'bg-gold'} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
              <div className="w-[38%] max-w-[150px] shrink-0">
                <MuscleMap
                  fills={derived.recoveryFills}
                  label={
                    derived.recovering.length > 0
                      ? `Em recuperação: ${derived.recovering.map(([region]) => REGION_LABELS[region]).join(', ')}`
                      : 'Todos os músculos recuperados'
                  }
                />
              </div>
            </div>
            {derived.recovering.length > 0 && (
              <div className="mt-3 flex gap-3 border-t border-line pt-2.5 text-xs font-semibold text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-danger" /> Recuperando
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-gold" /> Quase pronto
                </span>
              </div>
            )}
          </Tile>

          {/* Exercícios do próximo treino */}
          {next && data.exercises.length > 0 && (
            <Tile className="p-0">
              <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-5">
                <Eyebrow icon={Dumbbell} className="min-w-0 truncate">
                  O que vem aí
                </Eyebrow>
                <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-zinc-500">
                  <Clock className="h-3 w-3" aria-hidden="true" /> ~{derived.estimatedMinutes} min
                </span>
              </div>
              <ol className="divide-y divide-line">
                {data.exercises.map((item, index) => {
                  const sets = getPlannedSets(item)
                  // Mostra as repetições da série de trabalho, não as do aquecimento.
                  const mainReps = (sets.find((set) => set.type !== 'warmup') ?? sets[0])?.reps
                  return (
                    <li key={item.id} className="flex items-center gap-3.5 px-5 py-3">
                      <span className="w-5 text-center font-display text-lg font-bold text-zinc-600">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-zinc-100">{item.exercises?.name ?? 'Exercício'}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {sets.length} {sets.length === 1 ? 'série' : 'séries'}
                          {mainReps ? ` · ${mainReps} reps` : ''}
                          {item.exercises?.muscle_group ? ` · ${item.exercises.muscle_group}` : ''}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </Tile>
          )}
        </div>
      </details>
    </Stagger>
  )
}
