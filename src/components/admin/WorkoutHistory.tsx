'use client'

import { History } from 'lucide-react'
import type { WorkoutSession } from '@/lib/types'
import { capitalize } from '@/lib/text'
import { formatKg } from '@/lib/workouts'
import { LineChart } from '@/components/fitness/LineChart'
import { Alert } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Eyebrow } from '@/components/ui/tile'

export type HistorySet = {
  id: string
  session_id: string
  set_number: number
  weight_kg: number | null
  reps: number | null
  rir: number | null
  exercises: { name: string | null } | null
}

export type HistorySession = WorkoutSession & { volume: number; groups: { name: string; sets: HistorySet[] }[] }

export function groupHistory(sessions: WorkoutSession[], sets: HistorySet[]): HistorySession[] {
  return sessions.map((session) => {
    const groups: HistorySession['groups'] = []
    let volume = 0
    for (const set of sets) {
      if (set.session_id !== session.id) continue
      volume += (Number(set.weight_kg) || 0) * (Number(set.reps) || 0)
      const name = set.exercises?.name || 'Exercício'
      const group = groups.find((item) => item.name === name)
      if (group) group.sets.push(set)
      else groups.push({ name, sets: [set] })
    }
    return { ...session, volume, groups }
  })
}

type WorkoutHistoryProps = {
  sessions: HistorySession[]
  loading: boolean
  error: string
}

export function WorkoutHistory({ sessions, loading, error }: WorkoutHistoryProps) {
  if (loading) {
    return (
      <div role="status" aria-label="Buscando histórico de cargas" className="space-y-3">
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-56 rounded-3xl" />
      </div>
    )
  }

  // As sessões chegam da mais recente para a mais antiga; o gráfico lê da esquerda (antiga) para a direita.
  const points = [...sessions]
    .reverse()
    .filter((session) => session.volume > 0 && session.completed_at)
    .map((session) => ({
      key: session.id,
      label: new Date(session.completed_at as string).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      value: session.volume,
    }))

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}

      {sessions.length === 0 && !error ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line-strong p-8 text-center">
          <History className="h-10 w-10 text-zinc-600" aria-hidden="true" />
          <p className="text-sm font-semibold text-zinc-300">Nenhum treino concluído ainda.</p>
          <p className="text-xs text-zinc-500">Quando o aluno marcar as séries e finalizar o treino, as cargas aparecem aqui.</p>
        </div>
      ) : (
        <>
          {points.length >= 2 && (
            <section aria-label="Volume por sessão" className="rounded-3xl border border-line bg-surface p-4">
              <Eyebrow>Volume por sessão</Eyebrow>
              <div className="mt-2">
                <LineChart points={points} format={(value) => `${formatKg(value)} kg`} title="Volume total por sessão" />
              </div>
            </section>
          )}

          {sessions.map((session) => (
            <article key={session.id} className="rounded-3xl border border-line bg-surface p-4">
              <header className="flex items-start justify-between gap-3 border-b border-line pb-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Sessão concluída</p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {session.completed_at
                      ? capitalize(
                          new Date(session.completed_at).toLocaleString('pt-BR', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          }),
                        )
                      : '—'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {session.session_rpe != null && (
                    <span className="rounded-full bg-gold-soft px-2.5 py-1 text-[10px] font-black text-gold">
                      RPE {session.session_rpe}/10
                    </span>
                  )}
                  {session.volume > 0 && (
                    <span className="text-[11px] font-semibold tabular-nums text-zinc-400">{formatKg(session.volume)} kg</span>
                  )}
                </div>
              </header>

              {session.groups.length === 0 ? (
                <p className="pt-3 text-center text-xs text-zinc-500">Nenhuma série registrada.</p>
              ) : (
                <ul className="space-y-3 pt-3">
                  {session.groups.map((group) => (
                    <li key={group.name}>
                      <p className="text-xs font-bold text-white">{group.name}</p>
                      <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label={`Séries de ${group.name}`}>
                        {group.sets.map((set) => (
                          <li
                            key={set.id}
                            className="rounded-lg bg-white/[0.06] px-2 py-1 text-[11px] font-semibold tabular-nums text-zinc-200"
                          >
                            <span className="text-brand">{formatKg(Number(set.weight_kg) || 0)} kg</span> × {set.reps ?? 0}
                            {set.rir !== null && <span className="text-zinc-500"> · RIR {set.rir}</span>}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </>
      )}
    </div>
  )
}
