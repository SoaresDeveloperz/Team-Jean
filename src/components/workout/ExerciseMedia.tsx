import { Activity, Dumbbell } from 'lucide-react'

interface ExerciseMediaProps {
  muscleGroup: string
}

export function ExerciseMedia({ muscleGroup }: ExerciseMediaProps) {
  return (
    <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-black">
          <Dumbbell className="h-5 w-5 text-zinc-300" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase text-zinc-500">
            <Activity className="h-3 w-3" aria-hidden="true" />
            Músculo-alvo
          </p>
          <p className="text-sm font-extrabold text-emerald-300">{muscleGroup}</p>
        </div>
      </div>
    </div>
  )
}