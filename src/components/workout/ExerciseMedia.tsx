'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Activity, Dumbbell, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/cn'

type Media =
  | { kind: 'youtube'; src: string }
  | { kind: 'video'; src: string }
  | { kind: 'image'; src: string }

// Descobre como exibir a URL cadastrada no exercício. Aceita só http(s), o que
// também bloqueia URLs do tipo "javascript:".
export function getExerciseMedia(url: string | null | undefined): Media | null {
  if (!url) return null

  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null

  const host = parsed.hostname.replace(/^(www|m)\./, '')
  let youtubeId: string | null = null
  if (host === 'youtu.be') {
    youtubeId = parsed.pathname.slice(1)
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    youtubeId =
      parsed.pathname === '/watch'
        ? parsed.searchParams.get('v')
        : (parsed.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ?? null)
  }
  if (youtubeId && /^[\w-]{6,20}$/.test(youtubeId)) {
    return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0` }
  }

  if (/\.(mp4|webm|mov|m4v|ogv)$/i.test(parsed.pathname)) return { kind: 'video', src: parsed.toString() }

  // GIFs e imagens (inclusive URLs sem extensão: se não carregar, vira link).
  return { kind: 'image', src: parsed.toString() }
}

type ExerciseMediaProps = {
  muscleGroup?: string | null
  videoUrl?: string | null
  imageUrl?: string | null
  name?: string | null
  className?: string
}

export function ExerciseMedia({ muscleGroup, videoUrl, imageUrl, name, className }: ExerciseMediaProps) {
  const media = getExerciseMedia(videoUrl) ?? getExerciseMedia(imageUrl)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const label = name ? `Demonstração: ${name}` : 'Demonstração do exercício'

  const frameClassName = cn(
    'relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950',
    className,
  )

  if (media?.kind === 'youtube') {
    return (
      <div className={frameClassName}>
        <iframe
          src={media.src}
          title={label}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    )
  }

  if (media?.kind === 'video') {
    return (
      <div className={frameClassName}>
        <video
          src={media.src}
          aria-label={label}
          controls
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    )
  }

  if (media?.kind === 'image' && failedSrc !== media.src) {
    return (
      <div className={frameClassName}>
        <Image
          src={media.src}
          alt={label}
          fill
          unoptimized
          sizes="(max-width: 448px) 100vw, 448px"
          className="object-cover opacity-90"
          onError={() => setFailedSrc(media.src)}
        />
      </div>
    )
  }

  return (
    <div className={frameClassName}>
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-black">
          <Dumbbell className="h-5 w-5 text-zinc-300" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase text-zinc-500">
            <Activity className="h-3 w-3" aria-hidden="true" />
            Músculo-alvo
          </p>
          <p className="text-sm font-extrabold text-emerald-300">{muscleGroup || 'Treino'}</p>
        </div>
        {media && (
          <a
            href={media.src}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-bold uppercase text-zinc-400 underline-offset-2 hover:text-white hover:underline"
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" /> Abrir demonstração
          </a>
        )}
      </div>
    </div>
  )
}
