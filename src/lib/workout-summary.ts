import { REGION_LABELS, loadFill, muscleLoad, splitSecondary, type MuscleRegion, type MuscleWork } from './muscles'
import { plural } from './text'
import type { PrescribedExercise } from './types'
import { getSetsCount } from './workouts'

export type WorkoutSummary = {
  exercises: number
  sets: number
  minutes: number
  fills: Partial<Record<MuscleRegion, string>>
  // Rótulos das regiões mais trabalhadas, da maior para a menor carga.
  focus: string[]
}

type SummaryItem = { name?: string | null; muscle: string | null | undefined; secondary?: unknown; sets: number }

// Estimativa de duração: ~40 s de execução e 90 s de descanso por série, mais
// 1 min de troca por exercício, arredondada para 5 min.
export function estimateMinutes(sets: number, exercises: number) {
  if (sets === 0) return 0
  return Math.max(5, Math.round((sets * 130 + exercises * 60) / 300) * 5)
}

export function summarizeWork(items: SummaryItem[]): WorkoutSummary {
  let sets = 0
  const work: MuscleWork[] = []
  for (const item of items) {
    sets += item.sets
    work.push({ muscle: item.muscle, amount: item.sets, exercise: item.name })
    for (const muscle of splitSecondary(item.secondary)) work.push({ muscle, amount: item.sets / 2 })
  }

  const ranked = (Object.entries(muscleLoad(work)) as [MuscleRegion, number][]).sort((a, b) => b[1] - a[1])
  const fills: Partial<Record<MuscleRegion, string>> = {}
  for (const [region, intensity] of ranked) fills[region] = loadFill(intensity)

  return {
    exercises: items.length,
    sets,
    minutes: estimateMinutes(sets, items.length),
    fills,
    focus: ranked.slice(0, 3).map(([region]) => REGION_LABELS[region]),
  }
}

type PrescriptionRow = Pick<PrescribedExercise, 'planned_sets' | 'sets_count' | 'target_reps' | 'exercises'>

export function summarizePrescription(rows: PrescriptionRow[]) {
  return summarizeWork(
    rows.map((row) => ({
      name: row.exercises?.name,
      muscle: row.exercises?.muscle_group,
      secondary: row.exercises?.secondary_muscle,
      sets: getSetsCount(row),
    })),
  )
}

export function summaryLine(summary: WorkoutSummary) {
  const parts = [plural(summary.exercises, 'exercício', 'exercícios'), plural(summary.sets, 'série', 'séries')]
  if (summary.minutes > 0) parts.push(`≈ ${summary.minutes} min`)
  return parts.join(' · ')
}
