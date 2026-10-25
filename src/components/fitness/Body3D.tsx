'use client'

import dynamic from 'next/dynamic'
import { useCallback, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { Box, Pause, RotateCw } from 'lucide-react'
import { REGION_LABELS, type MuscleRegion } from '@/lib/muscles'
import { cn } from '@/lib/cn'
import { MuscleMap } from './MuscleMap'
import type { BodyView } from './body3d/Body3DScene'

// O three.js só é baixado quando um corpo 3D aparece na tela.
const Body3DScene = dynamic(() => import('./body3d/Body3DScene'), { ssr: false })

type Body3DProps = {
  // Mesmo formato do MuscleMap: cor de cada região destacada.
  fills: Partial<Record<MuscleRegion, string>>
  // Texto ao lado do nome no chip (ex.: "principal", "8 séries").
  details?: Partial<Record<MuscleRegion, string>>
  label?: string
  className?: string
  heightClassName?: string
  autoRotate?: boolean
  showChips?: boolean
}

let webglSupport: boolean | null = null
function detectWebGL() {
  if (webglSupport !== null) return webglSupport
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    webglSupport = Boolean(context)
    // Libera o contexto de teste na hora (o navegador limita quantos existem).
    context?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webglSupport = false
  }
  return webglSupport
}
const subscribeNothing = () => () => {}

// Intensidade (alfa) de "rgba(r, g, b, a)"; cores sólidas valem 1.
function intensityOf(fill: string) {
  const alpha = fill.match(/rgba\([^)]*,\s*([\d.]+)\s*\)/i)?.[1]
  return alpha === undefined ? 1 : Number(alpha)
}

const VIEWS: { view: BodyView; label: string }[] = [
  { view: 'front', label: 'Frente' },
  { view: 'side', label: 'Lado' },
  { view: 'back', label: 'Costas' },
]

export function Body3D({
  fills,
  details,
  label,
  className,
  heightClassName = 'h-[22rem]',
  autoRotate = true,
  showChips = true,
}: Body3DProps) {
  const supported = useSyncExternalStore(subscribeNothing, detectWebGL, () => null)
  const reducedMotion = Boolean(useReducedMotion())
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [spinPreference, setSpinPreference] = useState(autoRotate)
  const [view, setView] = useState<{ name: BodyView; nonce: number }>({ name: 'front', nonce: 0 })
  const [selected, setSelected] = useState<MuscleRegion | null>(null)

  const highlighted = (Object.entries(fills) as [MuscleRegion, string][])
    .map(([region, fill]) => ({ region, fill, intensity: intensityOf(fill) }))
    .sort((a, b) => b.intensity - a.intensity)
  const description =
    label ??
    (highlighted.length > 0
      ? `Corpo 3D com destaque em ${highlighted.map(({ region }) => REGION_LABELS[region]).join(', ')}`
      : 'Corpo 3D sem músculos em destaque')
  const spinning = spinPreference && !reducedMotion
  const use3D = supported === true && !failed
  const selectedDetail = selected ? details?.[selected] : undefined

  const handleSelect = useCallback((region: MuscleRegion | null) => {
    setSelected((current) => (region && current === region ? null : region))
  }, [])
  const handleReady = useCallback(() => setReady(true), [])
  const handleUnavailable = useCallback(() => setFailed(true), [])

  return (
    <figure className={cn('m-0', className)}>
      <div
        className={cn(
          'relative overflow-hidden rounded-3xl border border-line bg-black/50',
          'bg-[radial-gradient(110%_65%_at_50%_100%,rgba(52,211,153,0.18),transparent_62%),radial-gradient(70%_45%_at_50%_0%,rgba(255,255,255,0.05),transparent_70%)]',
          heightClassName,
        )}
      >
        {/* Grade de "laboratório" que some nas bordas. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:26px_26px] [mask-image:radial-gradient(70%_60%_at_50%_55%,black,transparent)]"
        />

        {use3D ? (
          <>
            <AnimatePresence>
              {!ready && (
                <m.div
                  key="placeholder"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="absolute inset-0 grid place-items-center p-10"
                >
                  <MuscleMap fills={fills} animated={false} className="h-full w-full opacity-40" label="Carregando o modelo 3D" />
                  <span className="skeleton absolute inset-0" aria-hidden="true" />
                </m.div>
              )}
            </AnimatePresence>
            <Body3DScene
              fills={fills}
              selected={selected}
              view={view}
              autoRotate={spinning}
              reducedMotion={reducedMotion}
              label={description}
              onSelect={handleSelect}
              onReady={handleReady}
              onUnavailable={handleUnavailable}
            />
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center px-6 pb-14 pt-8">
            <MuscleMap fills={fills} label={description} className="h-full w-full" />
          </div>
        )}

        <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-xs font-black uppercase tracking-[0.1em] text-zinc-200 backdrop-blur">
          <Box className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
          {use3D ? 'Modelo 3D' : 'Mapa muscular'}
        </span>

        {use3D && (
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-2">
            <div className="flex rounded-full border border-white/10 bg-black/65 p-1 backdrop-blur">
              {VIEWS.map((item) => (
                <m.button
                  key={item.view}
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    setSelected(null)
                    setView((current) => ({ name: item.view, nonce: current.nonce + 1 }))
                  }}
                  className="h-8 rounded-full px-3 text-xs font-bold text-zinc-200 transition hover:bg-white/10 hover:text-white"
                >
                  <span className="sr-only">Ver </span>
                  {item.label}
                </m.button>
              ))}
            </div>
            {!reducedMotion && (
              <m.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => setSpinPreference((value) => !value)}
                aria-pressed={spinning}
                aria-label="Girar sozinho"
                className={cn(
                  'grid h-10 w-10 place-items-center rounded-full border backdrop-blur transition',
                  spinning ? 'border-brand/40 bg-brand-soft text-brand' : 'border-white/10 bg-black/65 text-zinc-200',
                )}
              >
                {spinning ? <Pause className="h-4 w-4" aria-hidden="true" /> : <RotateCw className="h-4 w-4" aria-hidden="true" />}
              </m.button>
            )}
          </div>
        )}
      </div>

      {showChips && highlighted.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Músculos em destaque">
          {highlighted.map(({ region, fill }) => {
            const active = selected === region
            return (
              <li key={region}>
                <m.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSelect(region)}
                  aria-pressed={active}
                  className={cn(
                    'flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition',
                    active ? 'border-white bg-white text-black' : 'border-line bg-surface text-zinc-200 hover:border-line-strong',
                  )}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: fill }} aria-hidden="true" />
                  {REGION_LABELS[region]}
                  {details?.[region] && (
                    <span className={cn('font-semibold', active ? 'text-zinc-700' : 'text-zinc-400')}>· {details[region]}</span>
                  )}
                </m.button>
              </li>
            )
          })}
        </ul>
      )}
      {showChips && use3D && (
        <figcaption className="mt-2 text-xs text-zinc-500">Arraste para girar e toque num músculo para focar.</figcaption>
      )}
      <p className="sr-only" aria-live="polite">
        {selected ? `${REGION_LABELS[selected]} em foco${selectedDetail ? `: ${selectedDetail}` : ''}` : ''}
      </p>
    </figure>
  )
}
