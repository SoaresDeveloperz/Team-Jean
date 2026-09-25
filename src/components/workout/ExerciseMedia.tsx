'use client'

/* eslint-disable @next/next/no-img-element */
import { useState } from 'react'
import { Activity, Dumbbell } from 'lucide-react'

interface ExerciseMediaProps {
  videoUrl?: string | null
  muscleGroup: string
  exerciseName: string
}

export function ExerciseMedia({
  videoUrl,
  muscleGroup,
  exerciseName,
}: ExerciseMediaProps) {
  const [imageError, setImageError] = useState(false)

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90">
      {videoUrl && !imageError ? (
        <div className="relative flex h-40 items-center justify-center overflow-hidden bg-black">
          <img
            src={videoUrl}
            alt={`Execução de ${exerciseName}`}
            onError={() => setImageError(true)}
            className="h-full w-full object-cover opacity-90 transition-transform duration-300 hover:scale-105"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
        </div>
      ) : (
        <div className="relative flex h-32 flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-zinc-900 to-zinc-950 p-4">
          <div className="absolute h-28 w-28 rounded-full bg-emerald-400/10 blur-2xl" />
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-800 bg-black">
              <Dumbbell className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-800/40 bg-emerald-950/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-400">
              <Activity className="h-3 w-3" aria-hidden="true" />
              Foco: {muscleGroup}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}