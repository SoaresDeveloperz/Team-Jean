'use client'

/* eslint-disable @next/next/no-img-element */
import { useState } from 'react'
import { Activity, Dumbbell, ExternalLink, Play } from 'lucide-react'

interface ExerciseMediaProps {
  imageUrl?: string | null
  videoUrl?: string | null
  muscleGroup: string
  exerciseName: string
}

function getHttpUrl(value?: string | null) {
  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

function getVideoEmbedUrl(value?: string | null) {
  const url = getHttpUrl(value)
  if (!url) return null

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (host === 'youtu.be' || host.endsWith('youtube.com') || host === 'youtube-nocookie.com') {
    const videoId = host === 'youtu.be'
      ? url.pathname.split('/').filter(Boolean)[0]
      : url.searchParams.get('v') ?? url.pathname.match(/\/(?:embed|shorts|live)\/([^/]+)/)?.[1]

    return videoId ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` : null
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const videoId = url.pathname.match(/\/(?:video\/)?(\d+)/)?.[1]
    return videoId ? `https://player.vimeo.com/video/${videoId}` : null
  }

  return null
}

function getPathname(value?: string | null) {
  if (!value) return ''

  try {
    return new URL(value, 'https://team-jean.invalid').pathname.toLowerCase()
  } catch {
    return ''
  }
}

export function ExerciseMedia({
  imageUrl,
  videoUrl,
  muscleGroup,
  exerciseName,
}: ExerciseMediaProps) {
  const [imageError, setImageError] = useState(false)
  const videoEmbedUrl = getVideoEmbedUrl(videoUrl)
  const videoPath = getPathname(videoUrl)
  const directVideo = getHttpUrl(videoUrl)
  const isVideoFile = /\.(mp4|webm|ogg|m4v|mov)$/.test(videoPath)
  const isLegacyImage = /\.(avif|gif|jpe?g|png|webp)$/.test(videoPath)
  const displayImageUrl = imageUrl || (isLegacyImage ? videoUrl : null)

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90">
      {videoEmbedUrl ? (
        <div className="aspect-video w-full bg-black">
          <iframe
            src={videoEmbedUrl}
            title={`Vídeo de execução: ${exerciseName}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="h-full w-full border-0"
          />
        </div>
      ) : isVideoFile && directVideo ? (
        <div className="aspect-video w-full bg-black">
          <video
            controls
            playsInline
            preload="metadata"
            poster={imageUrl || undefined}
            className="h-full w-full"
          >
            <source src={directVideo.href} />
            Seu navegador não conseguiu reproduzir este vídeo.
          </video>
        </div>
      ) : videoUrl && !isLegacyImage && getHttpUrl(videoUrl) ? (
        <a
          href={getHttpUrl(videoUrl)?.href}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-32 items-center justify-center gap-2 bg-black px-4 text-sm font-semibold text-emerald-300 transition hover:bg-zinc-950"
        >
          <Play className="h-4 w-4 fill-current" aria-hidden="true" />
          Abrir vídeo de {exerciseName}
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      ) : displayImageUrl && !imageError ? (
        <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-black">
          <img
            src={displayImageUrl}
            alt={`Demonstração de ${exerciseName}`}
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