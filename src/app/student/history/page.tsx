'use client'

import { useEffect, useState } from 'react'
import { Award, Calendar, ChevronDown, ChevronUp, Clock, Dumbbell, History, LoaderCircle } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import type { WorkoutSession } from '@/lib/types'
import { formatKg } from '@/lib/workouts'
import { Alert } from '@/components/ui/alert'
import { PageLoader } from '@/components/ui/page-loader'

type HistorySession = WorkoutSession & { assigned_workouts: { name: string | null } | null }

type SessionDetail = {
  volume: number
  groups: { name: string; sets: { setNumber: number; weight: number; reps: number }[] }[]
}

type SetRow = {
  set_number: number
  weight_kg: number | null
  reps: number | null
  exercises: { name: string | null } | null
}

function getDurationMinutes(session: WorkoutSession) {
  if (!session.completed_at) return null
  const minutes = Math.round((new Date(session.completed_at).getTime() - new Date(session.created_at).getTime()) / 60_000)
  return minutes > 0 && minutes < 600 ? minutes : null
}

function monthLabel(date: string) {
  const label = new Date(date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function StudentHistoryPage() {
  const [supabase] = useState(() => createClient())
  const [sessions, setSessions] = useState<HistorySession[] | null>(null)
  const [loadError, setLoadError] = useState('')
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
        .limit(100)
      if (!active) return

      if (error) setLoadError(`Não foi possível carregar o histórico: ${error.message}`)
      setSessions((data ?? []) as HistorySession[])
    }

    void load()
    return () => {
      active = false
    }
  }, [supabase])

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
      .order('created_at', { ascending: true })

    if (error) {
      setDetails((previous) => ({ ...previous, [sessionId]: 'error' }))
      return
    }

    const groups: SessionDetail['groups'] = []
    let volume = 0
    for (const row of (data ?? []) as unknown as SetRow[]) {
      const name = row.exercises?.name || 'Exercício'
      const set = { setNumber: row.set_number, weight: Number(row.weight_kg) || 0, reps: Number(row.reps) || 0 }
      volume += set.weight * set.reps
      const group = groups.find((item) => item.name === name)
      if (group) group.sets.push(set)
      else groups.push({ name, sets: [set] })
    }
    setDetails((previous) => ({ ...previous, [sessionId]: { volume, groups } }))
  }

  const months: { label: string; items: HistorySession[] }[] = []
  for (const session of sessions ?? []) {
    const label = monthLabel(session.completed_at ?? session.created_at)
    const month = months.find((item) => item.label === label)
    if (month) month.items.push(session)
    else months.push({ label, items: [session] })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-wide">Histórico</h1>
        <p className="text-xs font-medium text-zinc-500">
          {sessions ? `${sessions.length} ${sessions.length === 1 ? 'treino concluído' : 'treinos concluídos'}` : 'Sessões concluídas'}
        </p>
      </div>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {sessions === null ? (
        <PageLoader label="Carregando histórico" />
      ) : sessions.length === 0 ? (
        <div className="space-y-2 rounded-3xl border border-zinc-900 bg-zinc-950 p-8 text-center">
          <History className="mx-auto h-10 w-10 text-zinc-800" aria-hidden="true" />
          <h2 className="text-sm font-bold text-zinc-400">Nenhum treino no histórico</h2>
          <p className="text-xs text-zinc-600">Seus treinos finalizados aparecerão aqui.</p>
        </div>
      ) : (
        months.map((month) => (
          <section key={month.label} className="space-y-3">
            <h2 className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{month.label}</h2>
            <ul className="space-y-3">
              {month.items.map((session) => {
                const isExpanded = expandedId === session.id
                const detail = details[session.id]
                const duration = getDurationMinutes(session)

                return (
                  <li key={session.id} className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => toggleSession(session.id)}
                      className="w-full space-y-2 p-4 text-left"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="truncate text-sm font-black text-white">
                          {session.assigned_workouts?.name || 'Treino concluído'}
                        </h3>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden="true" />
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t border-zinc-900 pt-2 text-xs font-medium text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-zinc-600" aria-hidden="true" />
                          {new Date(session.completed_at ?? session.created_at).toLocaleDateString('pt-BR', {
                            weekday: 'short',
                            day: '2-digit',
                            month: '2-digit',
                          })}
                        </span>
                        {duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-zinc-600" aria-hidden="true" /> {duration} min
                          </span>
                        )}
                        <span className="flex items-center gap-1 font-bold text-zinc-300">
                          <Award className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                          RPE {session.session_rpe ?? '-'}/10
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="space-y-2 border-t border-zinc-900 bg-black/40 p-4">
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
                            <p className="text-[10px] font-black uppercase text-emerald-400">
                              Volume: {formatKg(detail.volume)} kg
                            </p>
                            {detail.groups.map((group) => (
                              <div key={group.name} className="rounded-xl border border-zinc-900 bg-zinc-950 p-3">
                                <p className="flex items-center gap-1.5 text-xs font-bold text-white">
                                  <Dumbbell className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" /> {group.name}
                                </p>
                                <p className="mt-1 text-[11px] text-zinc-400">
                                  {group.sets.map((set) => `${formatKg(set.weight)}kg × ${set.reps}`).join('  ·  ')}
                                </p>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
