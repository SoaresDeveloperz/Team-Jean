'use client'

import { useEffect, useRef, useState } from 'react'
import { m } from 'framer-motion'
import { LoaderCircle, Minus, Plus } from 'lucide-react'
import { cropImage, loadImage } from '@/lib/images'
import { cn } from '@/lib/cn'
import { friendlyError } from '@/lib/errors'
import { Alert } from '@/components/ui/alert'
import { Modal, SheetFooter } from '@/components/ui/modal'

type ImageCropperProps = {
  open: boolean
  file: File | null
  title: string
  // Largura ÷ altura da área de recorte (1 = foto de perfil; 3 = capa).
  aspect: number
  shape: 'circle' | 'rect'
  output: { width: number; height: number }
  onCancel: () => void
  onConfirm: (image: Blob) => Promise<void>
}

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

type Loaded = { file: File; image: HTMLImageElement; url: string }

export function ImageCropper({ open, file, title, aspect, shape, output, onCancel, onConfirm }: ImageCropperProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchDistance = useRef<number | null>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  // Guarda o arquivo junto: o erro de uma foto não aparece na seguinte.
  const [loadError, setLoadError] = useState<{ file: File; message: string } | null>(null)
  const [frame, setFrame] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Decodifica a foto escolhida (e libera a anterior).
  useEffect(() => {
    if (!file) return
    let active = true
    const url = URL.createObjectURL(file)
    const load = async () => {
      try {
        const image = await loadImage(file)
        if (!active) return
        setLoaded({ file, image, url })
        setZoom(MIN_ZOOM)
        setOffset({ x: 0, y: 0 })
        setSaveError('')
      } catch {
        if (active) setLoadError({ file, message: 'Não consegui abrir esta foto. Tente uma imagem JPG ou PNG.' })
      }
    }
    void load()
    return () => {
      active = false
      URL.revokeObjectURL(url)
    }
  }, [file])

  // Tamanho real da área de recorte (muda com a largura da tela).
  useEffect(() => {
    const element = frameRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setFrame({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [loaded])

  // Roda do mouse dá zoom (listener nativo para poder cancelar a rolagem).
  useEffect(() => {
    const element = frameRef.current
    if (!element) return
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      setZoom((value) => clamp(value * (event.deltaY < 0 ? 1.08 : 1 / 1.08), MIN_ZOOM, MAX_ZOOM))
    }
    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [loaded])

  const current = loaded && loaded.file === file ? loaded : null
  const errorMessage = loadError && loadError.file === file ? loadError.message : ''
  const natural = current ? { width: current.image.naturalWidth, height: current.image.naturalHeight } : null
  const baseScale = natural && frame.width ? Math.max(frame.width / natural.width, frame.height / natural.height) : 0
  const scale = baseScale * zoom
  const displayWidth = natural ? natural.width * scale : 0
  const displayHeight = natural ? natural.height * scale : 0
  const maxX = Math.max(0, (displayWidth - frame.width) / 2)
  const maxY = Math.max(0, (displayHeight - frame.height) / 2)
  // A foto sempre cobre a área inteira: o deslocamento é limitado ao que sobra.
  const x = clamp(offset.x, -maxX, maxX)
  const y = clamp(offset.y, -maxY, maxY)

  const moveBy = (dx: number, dy: number) => setOffset({ x: clamp(x + dx, -maxX, maxX), y: clamp(y + dy, -maxY, maxY) })

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    setDragging(true)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size >= 2) {
      // Pinça: a distância entre os dois dedos controla o zoom.
      const [first, second] = [...pointers.current.values()]
      const distance = Math.hypot(first.x - second.x, first.y - second.y)
      if (pinchDistance.current) {
        const ratio = distance / pinchDistance.current
        setZoom((value) => clamp(value * ratio, MIN_ZOOM, MAX_ZOOM))
      }
      pinchDistance.current = distance
      return
    }
    moveBy(event.clientX - previous.x, event.clientY - previous.y)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinchDistance.current = null
    if (pointers.current.size === 0) setDragging(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 12
    const actions: Record<string, () => void> = {
      ArrowLeft: () => moveBy(step, 0),
      ArrowRight: () => moveBy(-step, 0),
      ArrowUp: () => moveBy(0, step),
      ArrowDown: () => moveBy(0, -step),
      '+': () => setZoom((value) => clamp(value + 0.1, MIN_ZOOM, MAX_ZOOM)),
      '=': () => setZoom((value) => clamp(value + 0.1, MIN_ZOOM, MAX_ZOOM)),
      '-': () => setZoom((value) => clamp(value - 0.1, MIN_ZOOM, MAX_ZOOM)),
    }
    const action = actions[event.key]
    if (!action) return
    event.preventDefault()
    action()
  }

  const confirm = async () => {
    if (!current || !natural || !scale || saving) return
    setSaving(true)
    setSaveError('')
    try {
      const region = {
        x: ((displayWidth - frame.width) / 2 - x) / scale,
        y: ((displayHeight - frame.height) / 2 - y) / scale,
        width: frame.width / scale,
        height: frame.height / scale,
      }
      const blob = await cropImage(current.image, region, output.width, output.height)
      await onConfirm(blob)
    } catch (error) {
      setSaveError(friendlyError(error, 'Não foi possível salvar a foto'))
    } finally {
      setSaving(false)
    }
  }

  const close = () => {
    if (!saving) onCancel()
  }

  return (
    <Modal open={open} onClose={close} variant="sheet" title={title} description="Arraste para enquadrar e use a pinça ou o controle para dar zoom.">
      <div className="space-y-5">
        {errorMessage ? (
          <Alert variant="error">{errorMessage}</Alert>
        ) : (
          <div className={cn('mx-auto w-full', shape === 'circle' ? 'max-w-[20rem]' : 'max-w-md')}>
            <div
              ref={frameRef}
              role="group"
              tabIndex={0}
              aria-label="Área de recorte. Use as setas para mover e as teclas + e − para o zoom."
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onKeyDown={handleKeyDown}
              style={{ aspectRatio: String(aspect) }}
              className={cn(
                'relative w-full touch-none select-none overflow-hidden bg-surface-3 outline-offset-4',
                shape === 'circle' ? 'rounded-3xl' : 'rounded-2xl',
                dragging ? 'cursor-grabbing' : 'cursor-grab',
              )}
            >
              {current ? (
                // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:)
                <img
                  src={current.url}
                  alt="Foto sendo recortada"
                  draggable={false}
                  className="absolute left-0 top-0 max-w-none select-none"
                  style={{
                    width: displayWidth,
                    height: displayHeight,
                    transform: `translate(${(frame.width - displayWidth) / 2 + x}px, ${(frame.height - displayHeight) / 2 + y}px)`,
                  }}
                />
              ) : (
                <span className="skeleton absolute inset-0" aria-hidden="true" />
              )}

              {/* Grade de terços enquanto arrasta. */}
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute inset-0 transition-opacity duration-200',
                  dragging ? 'opacity-100' : 'opacity-0',
                )}
              >
                <span className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
                <span className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
                <span className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
                <span className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
              </span>

              {shape === 'circle' ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgba(0,0,0,0.6)] ring-2 ring-white/80"
                />
              ) : (
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-inset ring-white/70" />
              )}
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setZoom((value) => clamp(value - 0.25, MIN_ZOOM, MAX_ZOOM))}
                aria-label="Diminuir zoom"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-zinc-300 hover:text-white"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                aria-label="Zoom"
                aria-valuetext={`${Math.round(zoom * 100)}%`}
                className="h-2 w-full cursor-pointer accent-brand"
              />
              <button
                type="button"
                onClick={() => setZoom((value) => clamp(value + 0.25, MIN_ZOOM, MAX_ZOOM))}
                aria-label="Aumentar zoom"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-zinc-300 hover:text-white"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {saveError && <Alert variant="error">{saveError}</Alert>}

        <SheetFooter>
          <div className="grid grid-cols-[2fr_3fr] gap-2">
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="h-14 rounded-2xl border border-line-strong text-xs font-black uppercase tracking-wider text-zinc-200"
            >
              Cancelar
            </button>
            <m.button
              type="button"
              onClick={confirm}
              disabled={!current || saving}
              whileTap={{ scale: 0.98 }}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black uppercase tracking-[0.14em] text-black disabled:opacity-60"
            >
              {saving ? <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Salvando" /> : 'Usar foto'}
            </m.button>
          </div>
        </SheetFooter>
      </div>
    </Modal>
  )
}
