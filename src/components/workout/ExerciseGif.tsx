'use client'

import { useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Pause, Play, PersonStanding } from 'lucide-react'
import { cn } from '@/lib/cn'
import { EXERCISE_MEDIA_CREDIT, EXERCISE_MEDIA_CREDIT_URL, exerciseGifUrl } from '@/lib/exercises/media'

type ExerciseGifProps = {
  mediaId: string | null | undefined
  name?: string | null
  className?: string
  // Avisa quem mostra o GIF que ele não carregou (sem internet, arquivo fora do ar).
  onUnavailable?: () => void
}

const SIZE = 180

// GIF do movimento (biblioteca de exercícios), 180 × 180, com o crédito da
// Gym visual sempre visível. Toca sozinho, com botão para pausar (WCAG 2.2.2);
// para quem pede menos movimento, só toca depois de "Ver movimento". Se não
// carregar, some sem deixar buraco. Nunca bloqueia a marcação das séries.
export function ExerciseGif({ mediaId, name, className, onUnavailable }: ExerciseGifProps) {
  const src = exerciseGifUrl(mediaId)
  const reduceMotion = useReducedMotion()
  // null = segue a preferência do aparelho; depois, a escolha da pessoa.
  const [choice, setChoice] = useState<'play' | 'pause' | null>(null)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  // Quadro congelado ao pausar (desenhado num canvas, sem baixar nada de novo).
  const [frozenSrc, setFrozenSrc] = useState<string | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  if (!src || failedSrc === src) return null

  const label = `Movimento do exercício ${name?.trim() || 'selecionado'}`
  const playing = choice ? choice === 'play' : !reduceMotion
  const hasFrame = frozenSrc === src

  const toggle = () => {
    if (!playing) return setChoice('play')
    const image = imageRef.current
    const canvas = canvasRef.current
    let frozen = false
    if (image && canvas && image.complete && image.naturalWidth > 0) {
      try {
        const context = canvas.getContext('2d')
        context?.clearRect(0, 0, SIZE, SIZE)
        context?.drawImage(image, 0, 0, SIZE, SIZE)
        frozen = Boolean(context)
      } catch {
        frozen = false
      }
    }
    setFrozenSrc(frozen ? src : null)
    setChoice('pause')
  }

  return (
    <figure className={cn('flex flex-col items-center gap-2', className)}>
      <div className="relative aspect-square w-full max-w-[180px] overflow-hidden rounded-2xl border border-line bg-white">
        {playing && (
          // eslint-disable-next-line @next/next/no-img-element -- GIF animado de outro domínio, sem otimização do Next
          <img
            ref={imageRef}
            src={src}
            alt={label}
            width={SIZE}
            height={SIZE}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-full w-full object-contain"
            onError={() => {
              setFailedSrc(src)
              onUnavailable?.()
            }}
          />
        )}
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          role="img"
          aria-label={`${label} (pausado)`}
          hidden={playing || !hasFrame}
          className="h-full w-full object-contain"
        />
        {!playing && !hasFrame && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950 p-3 text-center">
            <PersonStanding className="h-8 w-8 text-brand" aria-hidden="true" />
            <p className="text-xs font-semibold leading-snug text-zinc-300">
              Toque em <span className="font-black text-white">Ver movimento</span> para ver a execução
            </p>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={toggle}
        className="flex h-11 w-full max-w-[180px] items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-xs font-bold text-zinc-200 transition hover:text-white"
      >
        {playing ? <Pause className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Play className="h-4 w-4 shrink-0" aria-hidden="true" />}
        {playing ? 'Pausar movimento' : 'Ver movimento'}
      </button>
      <figcaption className="-mt-1 text-xs text-zinc-400">
        GIF:{' '}
        <a
          href={EXERCISE_MEDIA_CREDIT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center font-semibold text-zinc-200 underline underline-offset-2 hover:text-white"
        >
          {EXERCISE_MEDIA_CREDIT}
        </a>
      </figcaption>
    </figure>
  )
}
