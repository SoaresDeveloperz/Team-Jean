'use client'

import { useEffect, useRef, useState } from 'react'
import { m } from 'framer-motion'
import { Flame, ImageOff } from 'lucide-react'
import { cn } from '@/lib/cn'

type PhotoGridProps = {
  urls: (string | null)[]
  onOpen: (index: number) => void
  // Toque duplo numa foto dá fogo (como o coração do Instagram).
  onDoubleTap: () => void
}

const DOUBLE_TAP_MS = 280

// Brilho de carregamento até a foto chegar; depois ela entra com fade.
function GridImage({ src }: { src: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  if (state === 'error') {
    return (
      <span className="absolute inset-0 grid place-items-center text-zinc-600">
        <ImageOff className="h-6 w-6" aria-hidden="true" />
      </span>
    )
  }
  return (
    <>
      {state === 'loading' && <span className="skeleton absolute inset-0" aria-hidden="true" />}
      {/* eslint-disable-next-line @next/next/no-img-element -- link temporário de bucket privado; o otimizador do Next guardaria a foto em cache público */}
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => setState('ready')}
        onError={() => setState('error')}
        className={cn(
          'absolute inset-0 h-full w-full select-none object-cover transition-opacity duration-500',
          state === 'ready' ? 'opacity-100' : 'opacity-0',
        )}
      />
    </>
  )
}

function cellClass(count: number, index: number) {
  if (count === 1) return 'aspect-[4/5]'
  if (count === 2) return 'aspect-[4/5]'
  if (count === 3 && index === 0) return 'row-span-2'
  return 'aspect-square'
}

export function PhotoGrid({ urls, onOpen, onDoubleTap }: PhotoGridProps) {
  const lastTap = useRef<{ index: number; at: number } | null>(null)
  const openTimer = useRef<number | null>(null)
  const [burst, setBurst] = useState(0)
  const count = urls.length

  useEffect(
    () => () => {
      if (openTimer.current) window.clearTimeout(openTimer.current)
    },
    [],
  )

  // Um toque abre a foto (depois de esperar um possível segundo toque).
  // timeStamp vem do próprio evento de clique (ms desde o carregamento da página).
  const handleTap = (index: number, now: number) => {
    const previous = lastTap.current
    if (previous && previous.index === index && now - previous.at < DOUBLE_TAP_MS) {
      if (openTimer.current) window.clearTimeout(openTimer.current)
      openTimer.current = null
      lastTap.current = null
      setBurst((value) => value + 1)
      onDoubleTap()
      return
    }
    lastTap.current = { index, at: now }
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null
      lastTap.current = null
      onOpen(index)
    }, DOUBLE_TAP_MS)
  }

  return (
    <div className={cn('relative grid gap-0.5 bg-black', count === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
      {urls.map((url, index) => (
        <button
          key={index}
          type="button"
          onClick={(event) => handleTap(index, event.timeStamp)}
          aria-label={`Abrir foto ${index + 1} de ${count}`}
          className={cn('relative block w-full overflow-hidden bg-surface-3 outline-offset-[-3px]', cellClass(count, index))}
        >
          {url ? (
            <GridImage src={url} />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-zinc-600">
              <ImageOff className="h-6 w-6" aria-hidden="true" />
            </span>
          )}
        </button>
      ))}

      {burst > 0 && (
        <m.span
          key={burst}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid place-items-center text-gold"
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.2, 1, 1.05] }}
          transition={{ duration: 0.9, times: [0, 0.25, 0.7, 1] }}
        >
          <Flame className="h-24 w-24 fill-current drop-shadow-[0_8px_28px_rgba(251,191,36,0.6)]" />
        </m.span>
      )}
    </div>
  )
}
