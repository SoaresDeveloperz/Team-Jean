'use client'

import { useEffect, useMemo, useState } from 'react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { inChunks } from '@/lib/coach-insights'
import { buildTrends, formatChange, sortTrends, trendKind, type ExercisePoint, type ReportSession, type ReportSet } from '@/lib/progress-report'
import { formatKg } from '@/lib/workouts'
import { plural } from '@/lib/text'
import { cn } from '@/lib/cn'
import { friendlyError } from '@/lib/errors'
import { Alert } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { LineChart } from '@/components/fitness/LineChart'

const DAY = 86_400_000
// Maior período (90 dias) + 60 dias de folga para achar o treino de referência.
const LOOKBACK_DAYS = 90 + 60
type Period = 7 | 30 | 90

type Loaded = { sessions: ReportSession[]; sets: ReportSet[]; names: Map<string, string>; loadedAt: number }

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

// Relatório de evolução de carga por exercício, com gráfico, para o treinador dar o retorno da semana.
export function ProgressReport({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [supabase] = useState(() => createClient())
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [period, setPeriod] = useState<Period>(7)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const loadedAt = Date.now()
        const since = new Date(loadedAt - LOOKBACK_DAYS * DAY)
        const { data: rows, error: sessionsError } = await supabase
          .from('workout_sessions')
          .select('id, completed_at')
          .eq('student_id', studentId)
          .eq('status', 'completed')
          .gte('completed_at', since.toISOString())
          .order('completed_at', { ascending: false })
          .limit(300)
        if (sessionsError) throw sessionsError
        const sessions = ((rows ?? []) as ReportSession[]).filter((session) => session.completed_at)
        const sets = await inChunks<ReportSet>(sessions.map((session) => session.id), 20, (chunk) =>
          supabase.from('session_sets').select('session_id, exercise_id, weight_kg, reps, set_type').in('session_id', chunk).eq('completed', true),
        )
        const exercises = await inChunks<{ id: string; name: string }>([...new Set(sets.map((set) => set.exercise_id))].filter(Boolean), 60, (chunk) =>
          supabase.from('exercises').select('id, name').in('id', chunk),
        )
        if (active) setData({ sessions, sets, loadedAt, names: new Map(exercises.map((exercise) => [exercise.id, exercise.name])) })
      } catch (loadError) {
        if (active) setError(friendlyError(loadError, 'Não foi possível carregar a evolução'))
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [supabase, studentId, attempt])

  const trends = useMemo(() => {
    if (!data) return []
    const start = new Date(data.loadedAt - period * DAY)
    return sortTrends(buildTrends(data.sessions, data.sets, start)).map((trend) => ({
      ...trend,
      name: data.names.get(trend.exerciseId) ?? 'Exercício',
    }))
  }, [data, period])

  if (error) {
    return (
      <Alert
        variant="error"
        onRetry={() => {
          setError('')
          setAttempt((value) => value + 1)
        }}
      >
        {error}
      </Alert>
    )
  }
  if (!data) {
    return (
      <div className="space-y-2" role="status" aria-label="Carregando a evolução do aluno">
        <Skeleton className="h-11 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    )
  }

  const count = (kind: ReturnType<typeof trendKind>) => trends.filter((trend) => trendKind(trend) === kind).length
  const up = count('up')
  const down = count('down')
  const same = count('same')
  const firstName = studentName.split(' ')[0]

  return (
    <div className="space-y-3">
      <SegmentedControl
        size="sm"
        label="Período do relatório"
        value={period}
        onChange={setPeriod}
        options={[
          { value: 7, label: '7 dias' },
          { value: 30, label: '30 dias' },
          { value: 90, label: '90 dias' },
        ]}
      />

      {trends.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong p-4 text-center text-xs text-zinc-500">
          {firstName} não registrou carga nos últimos {period} dias.
        </p>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-zinc-400">
            Carga máxima de cada exercício comparada com o último treino antes do período (ou o primeiro dele).{' '}
            <span className="font-bold text-brand">{plural(up, 'subiu', 'subiram')}</span> ·{' '}
            <span className="font-bold text-danger">{plural(down, 'caiu', 'caíram')}</span> ·{' '}
            <span className="font-bold text-white">{plural(same, 'manteve', 'mantiveram')}</span>
          </p>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {trends.map((trend) => {
              const kind = trendKind(trend)
              const value = (point: ExercisePoint) => (trend.unit === 'kg' ? point.weight : point.reps)
              const label = (point: ExercisePoint) =>
                trend.unit === 'kg' ? `${formatKg(point.weight)} kg × ${point.reps}` : plural(point.reps, 'rep.', 'reps.')
              const Icon = kind === 'up' ? TrendingUp : kind === 'down' ? TrendingDown : Minus
              return (
                <li key={trend.exerciseId} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{trend.name}</span>
                      <span className="block text-xs text-zinc-400">
                        {kind === 'first'
                          ? `${label(trend.latest)} em ${shortDate(trend.latest.date)}`
                          : `${label(trend.base)} (${shortDate(trend.base.date)}) → ${label(trend.latest)} (${shortDate(trend.latest.date)})`}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black tabular-nums',
                        kind === 'up' && 'bg-brand-soft text-brand',
                        kind === 'down' && 'bg-danger-soft text-danger',
                        (kind === 'same' || kind === 'first') && 'bg-white/[0.06] text-zinc-300',
                      )}
                    >
                      {kind !== 'first' && <Icon className="h-3 w-3" aria-hidden="true" />}
                      {trend.change === null ? '1º registro' : formatChange(trend.change)}
                    </span>
                  </div>
                  {trend.points.length >= 2 && (
                    <div className="mt-2">
                      <LineChart
                        title={`Evolução de ${trend.name}`}
                        format={(point) => (trend.unit === 'kg' ? `${formatKg(point)} kg` : plural(point, 'rep.', 'reps.'))}
                        points={trend.points.map((point) => ({ key: point.sessionId, label: shortDate(point.date), value: value(point) }))}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
