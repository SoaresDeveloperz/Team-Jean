'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Modal } from '@/components/ui/modal'

type PhotoViewerProps = {
  open: boolean
  photos: (string | null)[]
  index: number
  title: string
  onIndexChange: (index: number) => void
  onClose: () => void
}

// Fotos em tela cheia: arrastar para os lados, setas ou teclado (← →).
export function PhotoViewer({ open, photos, index, title, onIndexChange, onClose }: PhotoViewerProps) {
  const [direction, setDirection] = useState(0)
  const count = photos.length
  const url = photos[index] ?? null

  const go = (delta: number) => {
    const target = index + delta
    if (target < 0 || target >= count) return
    setDirection(delta)
    onIndexChange(target)
  }

  useEffect(() => {
    if (!open || count < 2) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && index > 0) {
        setDirection(-1)
        onIndexChange(index - 1)
      }
      if (event.key === 'ArrowRight' && index < count - 1) {
        setDirection(1)
        onIndexChange(index + 1)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, count, index, onIndexChange])

  return (
    <Modal open={open} onClose={onClose} variant="sheet" title={title} description={count > 1 ? `Foto ${index + 1} de ${count}` : undefined}>
      <div className="relative">
        <div className="relative grid min-h-[62vh] place-items-center overflow-hidden rounded-3xl bg-surface">
          <AnimatePresence initial={false} mode="popLayout">
            <m.div
              key={index}
              drag={count > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.5}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80 || info.velocity.x < -500) go(1)
                else if (info.offset.x > 80 || info.velocity.x > 500) go(-1)
              }}
              initial={{ opacity: 0, x: direction * 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -80 }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="grid w-full touch-pan-y place-items-center"
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element -- link temporário de bucket privado
                <img
                  src={url}
                  alt={count > 1 ? `Foto ${index + 1} de ${count}` : 'Foto do post'}
                  draggable={false}
                  className="max-h-[72vh] w-full select-none object-contain"
                />
              ) : (
                <span className="flex flex-col items-center gap-2 py-24 text-sm text-zinc-500">
                  <ImageOff className="h-8 w-8" aria-hidden="true" /> Foto indisponível
                </span>
              )}
            </m.div>
          </AnimatePresence>
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={index === 0}
              aria-label="Foto anterior"
              className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/70 text-white backdrop-blur transition disabled:opacity-0"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={index === count - 1}
              aria-label="Próxima foto"
              className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/70 text-white backdrop-blur transition disabled:opacity-0"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
              {photos.map((_, dot) => (
                <span
                  key={dot}
                  className={cn('h-1.5 rounded-full transition-all', dot === index ? 'w-5 bg-white' : 'w-1.5 bg-white/30')}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
