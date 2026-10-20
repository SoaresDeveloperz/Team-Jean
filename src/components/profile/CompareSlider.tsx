'use client'

import { useRef, useState } from 'react'
import { ChevronsLeftRight, ImageOff } from 'lucide-react'
import { dateFromISO, type Measurement } from '@/lib/measurements'
import { cn } from '@/lib/cn'
import { Modal } from '@/components/ui/modal'

type CompareSliderProps = {
  open: boolean
  // Só registros com foto, do mais recente para o mais antigo.
  entries: Measurement[]
  onClose: () => void
}

const shortDate = (value: string) =>
  dateFromISO(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })

// Antes e depois: a foto "depois" é revelada até a posição da alça, que se
// arrasta com o dedo ou com as setas do teclado.
export function CompareSlider({ open, entries, onClose }: CompareSliderProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [beforeId, setBeforeId] = useState<string | null>(null)
  const [afterId, setAfterId] = useState<string | null>(null)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [position, setPosition] = useState(50)
  const [dragging, setDragging] = useState(false)

  const oldest = entries[entries.length - 1]
  const newest = entries[0]
  const before = entries.find((entry) => entry.id === beforeId) ?? oldest
  const after = entries.find((entry) => entry.id === afterId) ?? newest
  const maxPhotos = before && after ? Math.min(before.photos.length, after.photos.length) : 0
  const index = Math.min(photoIndex, Math.max(0, maxPhotos - 1))
  const beforeUrl = before?.photoUrls[index] ?? null
  const afterUrl = after?.photoUrls[index] ?? null

  const updateFromPointer = (clientX: number) => {
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosition(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)))
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 2
    if (event.key === 'ArrowLeft') setPosition((value) => Math.max(0, value - step))
    else if (event.key === 'ArrowRight') setPosition((value) => Math.min(100, value + step))
    else if (event.key === 'Home') setPosition(0)
    else if (event.key === 'End') setPosition(100)
    else return
    event.preventDefault()
  }

  const selectClassName =
    'h-11 w-full rounded-xl border border-line-strong bg-black/40 px-3 text-sm text-white focus:border-brand focus:outline-none'

  return (
    <Modal open={open} onClose={onClose} variant="sheet" title="Antes e depois" description="Arraste a alça para comparar.">
      {before && after ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="compare-before" className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                Antes
              </label>
              <select id="compare-before" value={before.id} onChange={(event) => setBeforeId(event.target.value)} className={selectClassName}>
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {shortDate(entry.measured_on)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="compare-after" className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                Depois
              </label>
              <select id="compare-after" value={after.id} onChange={(event) => setAfterId(event.target.value)} className={selectClassName}>
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {shortDate(entry.measured_on)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {maxPhotos > 1 && (
            <div role="radiogroup" aria-label="Foto comparada" className="flex gap-2">
              {Array.from({ length: maxPhotos }, (_, item) => (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={index === item}
                  onClick={() => setPhotoIndex(item)}
                  className={cn(
                    'h-9 flex-1 rounded-full border text-xs font-bold transition',
                    index === item ? 'border-white bg-white text-black' : 'border-line text-zinc-400 hover:text-white',
                  )}
                >
                  {['Frente', 'Lado', 'Costas'][item] ?? `Foto ${item + 1}`}
                </button>
              ))}
            </div>
          )}

          <div
            ref={frameRef}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              setDragging(true)
              updateFromPointer(event.clientX)
            }}
            onPointerMove={(event) => {
              if (dragging) updateFromPointer(event.clientX)
            }}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
            className="relative aspect-[3/4] w-full touch-none select-none overflow-hidden rounded-3xl bg-surface-3"
          >
            {beforeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- link temporário de bucket privado
              <img src={beforeUrl} alt={`Antes: ${shortDate(before.measured_on)}`} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <ImageOff className="absolute left-1/4 top-1/2 h-8 w-8 -translate-y-1/2 text-zinc-600" aria-hidden="true" />
            )}
            <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${position}%)` }}>
              {afterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- link temporário de bucket privado
                <img src={afterUrl} alt={`Depois: ${shortDate(after.measured_on)}`} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <ImageOff className="absolute right-1/4 top-1/2 h-8 w-8 -translate-y-1/2 text-zinc-600" aria-hidden="true" />
              )}
            </div>

            <span className="absolute left-3 top-3 rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
              Antes · {shortDate(before.measured_on)}
            </span>
            <span className="absolute right-3 top-3 rounded-full bg-brand px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-black">
              Depois · {shortDate(after.measured_on)}
            </span>

            <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_12px_rgba(0,0,0,0.6)]" style={{ left: `${position}%` }}>
              <span
                role="slider"
                tabIndex={0}
                aria-label="Posição da comparação"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(position)}
                aria-valuetext={`${Math.round(position)}% da foto de antes visível`}
                onKeyDown={handleKeyDown}
                className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full bg-white text-black shadow-xl"
              >
                <ChevronsLeftRight className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
          </div>
          <p className="text-center text-[11px] text-zinc-500">As fotos ficam visíveis só para você e seu treinador.</p>
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-zinc-400">Registre fotos em duas datas para comparar.</p>
      )}
    </Modal>
  )
}
