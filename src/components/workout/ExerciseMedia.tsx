import Image from 'next/image'
import { useState } from 'react'
import { Activity, Dumbbell } from 'lucide-react'
import { getExerciseIllustration } from '../../lib/exercises/illustrations'

interface ExerciseMediaProps {
  imageUrl?: string | null
  exerciseName: string
  muscleGroup: string
}

export function ExerciseMedia({ imageUrl, exerciseName, muscleGroup }: ExerciseMediaProps) {
  const [imageError, setImageError] = useState(false)
  const illustration = getExerciseIllustration(exerciseName)
  const mediaUrl = imageUrl || illustration?.imageUrl

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      {mediaUrl && !imageError ? (
        <>
          <div className="relative flex aspect-square w-full items-center justify-center bg-white sm:aspect-[4/3]">
            <Image
              src={mediaUrl}
              alt={`Ilustração de ${exerciseName} com músculos trabalhados destacados`}
              fill
              sizes="(max-width: 640px) 100vw, 640px"
              onError={() => setImageError(true)}
              className="h-full w-full object-contain"
            />
          </div>
          {illustration && !imageUrl && (
            <div className="flex items-center justify-between gap-2 border-t border-zinc-800 px-3 py-2 text-[9px] text-zinc-500">
              <a href={illustration.sourceUrl} target="_blank" rel="noreferrer" className="truncate hover:text-zinc-300">
                wger · {illustration.author}
              </a>
              <a href={illustration.licenseUrl} target="_blank" rel="noreferrer" className="shrink-0 underline underline-offset-2 hover:text-zinc-300">
                {illustration.license}
              </a>
            </div>
          )}
        </>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-zinc-950 sm:aspect-[4/3]">
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
      )}
    </div>
  )
}