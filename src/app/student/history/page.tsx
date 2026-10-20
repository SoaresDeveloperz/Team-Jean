'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ChevronDown, ChevronLeft, ChevronRight, Clock, Dumbbell, Gauge, History, LoaderCircle, X } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import type { WorkoutSession } from '@/lib/types'
import { formatKg } from '@/lib/workouts'
import { WEEKDAY_INITIALS, isSameDay, startOfDay, weekStreak } from '@/lib/stats'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Skeleton } from '@/components/ui/skeleton'
import { Eyebrow, Stagger, Tile } from '@/components/ui/tile'

type HistorySession = WorkoutSession & { completed_at: string; assigned_workouts: { name: string | null } | null }

type SessionDetail = {
  volume: number
  sets: number
  groups: { name: string; sets: { setNumber: number; weight: number; reps: number }[] }[]
}

type SetRow = {
  set_number: number
  weight_kg: number | null
  reps: number | null
  exercises: { name: string | null } | null
}

// A tabela não guarda a hora de início; se um dia tiver, a duração aparece.
function getDurationMinutes(session: WorkoutSession) {
  const startedAt = session.started_at ?? session.created_at
  if (!session.completed_at || !startedAt) return null
  const minutes = Math.round((new Date(session.completed_at).getTime() - new Date(startedAt).getTime()) / 60_000)
  return minutes > 0 && minutes < 600 ? minutes : null
}

function monthTitle(date: Date) {
  const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function StudentHistoryPage() {
  const [supabase] = useState(() => createClient())
  const [sessions, setSessions] = useState<HistorySession[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [monthDirection, setMonthDirection] = useState(0)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, SessionDetail | 'loading' | 'error'>>({})

  useEffect(() => {
    let active = true

    const load = async () => {
      const user = await getCurrentUser(supabase)
      if (!active || !user) return

      const { data, error } = await supabase
        .from('workout_sessions')
        .select('*, assigned_workouts(name)')
        .eq('student_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(300)
      if (!active) return

      if (error) setLoadError(`Não foi possível carregar o histórico: ${error.message}`)
      setSessions(((data ?? []) as HistorySession[]).filter((session) => session.completed_at))
    }

    void load()
    return () => {
      active = false
    }
  }, [supabase])

  const stats = useMemo(() => {
    const dates = (sessions ?? []).map((session) => new Date(session.completed_at))
    const now = new Date()
    return {
      total: dates.length,
      thisMonth: dates.filter((date) => date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()).length,
      streak: weekStreak(dates, now),
    }
  }, [sessions])

  const calendar = useMemo(() => {
    const countsByDay = new Map<number, number>()
    for (const session of sessions ?? []) {
      const key = startOfDay(new Date(session.completed_at)).getTime()
      countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1)
    }
    const firstWeekday = (month.getDay() + 6) % 7
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const cells: (Date | null)[] = [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)),
    ]
    return { cells, countsByDay }
  }, [sessions, month])

  const visibleSessions = (sessions ?? []).filter((session) => {
    const date = new Date(session.completed_at)
    if (selectedDay) return isSameDay(date, selectedDay)
    return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear()
  })

  const now = new Date()
  const isCurrentMonth = month.getMonth() === now.getMonth() && month.getFullYear() === now.getFullYear()

  const changeMonth = (delta: number) => {
    setMonthDirection(delta)
    setSelectedDay(null)
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  const toggleSession = async (sessionId: string) => {
    if (expandedId === sessionId) {
      setExpandedId(null)
      return
    }
    setExpandedId(sessionId)
    if (details[sessionId] && details[sessionId] !== 'error') return

    setDetails((previous) => ({ ...previous, [sessionId]: 'loading' }))
    const { data, error } = await supabase
      .from('session_sets')
      .select('set_number, weight_kg, reps, exercises(name)')
      .eq('session_id', sessionId)
      .eq('completed', true)
      .order('set_number', { ascending: true })

    if (error) {
      setDetails((previous) => ({ ...previous, [sessionId]: 'error' }))
      return
    }

    const groups: SessionDetail['groups'] = []
    let volume = 0
    let count = 0
    for (const row of (data ?? []) as unknown as SetRow[]) {
      const name = row.exercises?.name || 'Exercício'
      const set = { setNumber: row.set_number, weight: Number(row.weight_kg) || 0, reps: Number(row.reps) || 0 }
      volume += set.weight * set.reps
      count += 1
      const group = groups.find((item) => item.name === name)
      if (group) group.sets.push(set)
      else groups.push({ name, sets: [set] })
    }
    setDetails((previous) => ({ ...previous, [sessionId]: { volume, sets: count, groups } }))
  }

  return (
    <div className="space-y-4">
      <div className="px-1">
        <Eyebrow>Sua jornada</Eyebrow>
        <h1 className="mt-1 font-display text-[2.75rem] font-bold uppercase leading-[0.9]">Histórico</h1>
      </div>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {sessions === null ? (
        <div className="space-y-3" role="status" aria-label="Carregando histórico">
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-24 rounded-3xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-3xl" />
        </div>
      ) : (
        <Stagger className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Treinos', value: stats.total },
              { label: 'No mês', value: stats.thisMonth },
              { label: 'Semanas', value: stats.streak, hint: 'seguidas' },
            ].map((stat) => (
              <Tile key={stat.label} className="p-4">
                <Eyebrow>{stat.label}</Eyebrow>
                <p className="mt-2 font-display text-4xl font-bold leading-none">
                  <AnimatedNumber value={stat.value} />
                </p>
                {stat.hint && <p className="text-[10px] text-zinc-500">{stat.hint}</p>}
              </Tile>
            ))}
          </div>

          {/* Calendário */}
          <Tile className="p-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                aria-label="Mês anterior"
                className="grid h-10 w-10 place-items-center rounded-xl text-zinc-400 hover:bg-white/5 hover:text-white"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <h2 className="font-display text-xl font-bold uppercase tracking-wide" aria-live="polite">
                {monthTitle(month)}
              </h2>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                disabled={isCurrentMonth}
                aria-label="Próximo mês"
                className="grid h-10 w-10 place-items-center rounded-xl text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1.5 text-center" aria-hidden="true">
              {WEEKDAY_INITIALS.map((initial, index) => (
                <span key={index} className="text-[10px] font-black text-zinc-600">
                  {initial}
                </span>
              ))}
            </div>

            <AnimatePresence mode="wait" initial={false} custom={monthDirection}>
              <m.ol
                key={month.getTime()}
                custom={monthDirection}
                initial={{ opacity: 0, x: monthDirection * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: monthDirection * -24 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="mt-2 grid grid-cols-7 gap-1.5"
                aria-label={`Dias de ${monthTitle(month)}`}
              >
                {calendar.cells.map((date, index) => {
                  if (!date) return <li key={`empty-${index}`} aria-hidden="true" />
                  const count = calendar.countsByDay.get(date.getTime()) ?? 0
                  const isToday = isSameDay(date, now)
                  const isSelected = selectedDay !== null && isSameDay(date, selectedDay)
                  const isFuture = date > now
                  return (
                    <li key={date.getTime()}>
                      <button
                        type="button"
                        disabled={count === 0}
                        onClick={() => setSelectedDay(isSelected ? null : date)}
                        aria-pressed={isSelected}
                        aria-label={`${date.getDate()} de ${monthTitle(month)}: ${count > 0 ? `${count} treino(s)` : 'sem treino'}`}
                        className={cn(
                          'grid aspect-square w-full place-items-center rounded-xl text-xs font-bold transition',
                          count > 1
                            ? 'bg-brand text-black'
                            : count === 1
                              ? 'bg-brand/80 text-black'
                              : isFuture
                                ? 'text-zinc-700'
                                : 'bg-white/[0.03] text-zinc-500',
                          isToday && count === 0 && 'text-white ring-1 ring-white/40',
                          isSelected && 'ring-2 ring-white ring-offset-2 ring-offset-surface',
                        )}
                      >
                        {date.getDate()}
                      </button>
                    </li>
                  )
                })}
              </m.ol>
            </AnimatePresence>
          </Tile>

          {/* Lista */}
          <section aria-labelledby="sessions-title" className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h2 id="sessions-title" className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                {selectedDay
                  ? selectedDay.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
                  : `${visibleSessions.length} ${visibleSessions.length === 1 ? 'treino' : 'treinos'} em ${monthTitle(month).split(' ')[0].toLowerCase()}`}
              </h2>
              {selectedDay && (
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold text-zinc-300"
                >
                  <X className="h-3 w-3" aria-hidden="true" /> Ver mês
                </button>
              )}
            </div>

            {visibleSessions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-line-strong p-8 text-center">
                <History className="h-8 w-8 text-zinc-700" aria-hidden="true" />
                <p className="text-sm font-semibold text-zinc-400">
                  {sessions.length === 0 ? 'Nenhum treino concluído ainda.' : 'Nenhum treino neste mês.'}
                </p>
                <p className="text-xs text-zinc-600">Seus treinos finalizados aparecem aqui.</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {visibleSessions.map((session) => {
                  const isExpanded = expandedId === session.id
                  const detail = details[session.id]
                  const duration = getDurationMinutes(session)
                  const date = new Date(session.completed_at)
                  return (
                    <li key={session.id} className="overflow-hidden rounded-3xl border border-line bg-surface">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => toggleSession(session.id)}
                        className="flex w-full items-center gap-4 p-4 text-left"
                      >
                        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/[0.05] text-center">
                          <span>
                            <span className="block font-display text-2xl font-bold leading-none">{date.getDate()}</span>
                            <span className="block text-[9px] font-black uppercase tracking-wider text-zinc-500">
                              {date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                            </span>
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-white">
                            {session.assigned_workouts?.name || 'Treino concluído'}
                          </span>
                          <span className="mt-1.5 flex flex-wrap gap-1.5">
                            <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-zinc-300">
                              <Gauge className="h-3 w-3" aria-hidden="true" /> RPE {session.session_rpe ?? '–'}/10
                            </span>
                            {duration && (
                              <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-zinc-300">
                                <Clock className="h-3 w-3" aria-hidden="true" /> {duration} min
                              </span>
                            )}
                          </span>
                        </span>
                        <m.span animate={{ rotate: isExpanded ? 180 : 0 }} className="text-zinc-500">
                          <ChevronDown className="h-5 w-5" aria-hidden="true" />
                        </m.span>
                      </button>

                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <m.div
                            key="details"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-2 border-t border-line p-4">
                              {detail === 'loading' || detail === undefined ? (
                                <div className="flex justify-center py-3 text-zinc-500">
                                  <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Carregando séries" />
                                </div>
                              ) : detail === 'error' ? (
                                <Alert variant="error">Não foi possível carregar as séries.</Alert>
                              ) : detail.groups.length === 0 ? (
                                <p className="text-center text-xs text-zinc-600">Nenhuma série registrada.</p>
                              ) : (
                                <>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-2xl bg-white/[0.03] px-3 py-2">
                                      <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Volume</p>
                                      <p className="font-display text-xl font-bold">{formatKg(detail.volume)} kg</p>
                                    </div>
                                    <div className="rounded-2xl bg-white/[0.03] px-3 py-2">
                                      <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Séries</p>
                                      <p className="font-display text-xl font-bold">{detail.sets}</p>
                                    </div>
                                  </div>
                                  {detail.groups.map((group) => (
                                    <div key={group.name} className="rounded-2xl border border-line p-3">
                                      <p className="flex items-center gap-1.5 text-xs font-bold text-white">
                                        <Dumbbell className="h-3.5 w-3.5 text-brand" aria-hidden="true" /> {group.name}
                                      </p>
                                      <ul className="mt-2 flex flex-wrap gap-1.5">
                                        {group.sets.map((set, index) => (
                                          <li
                                            key={index}
                                            className="rounded-lg bg-white/[0.05] px-2 py-1 text-[11px] font-semibold tabular-nums text-zinc-300"
                                          >
                                            {formatKg(set.weight)}kg × {set.reps}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          </m.div>
                        )}
                      </AnimatePresence>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </Stagger>
      )}
    </div>
  )
}
