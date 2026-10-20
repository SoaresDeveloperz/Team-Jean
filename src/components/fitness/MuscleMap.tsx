'use client'

import type { Ref } from 'react'
import { m } from 'framer-motion'
import { REGION_LABELS, type MuscleRegion } from '@/lib/muscles'
import { cn } from '@/lib/cn'
import { BACK_SHAPES, FRONT_SHAPES, type BodyShape } from './muscle-paths'

const BASE_FILL = '#1a1a1d'
const IDLE_FILL = '#2a2a2f'

type MuscleMapProps = {
  // Cor de cada região destacada (as demais ficam neutras).
  fills: Partial<Record<MuscleRegion, string>>
  ref?: Ref<SVGSVGElement>
  className?: string
  showLabels?: boolean
  // Texto lido por leitores de tela; por padrão lista as regiões destacadas.
  label?: string
}

function Figure({ shapes, offsetX, fills }: { shapes: BodyShape[]; offsetX: number; fills: MuscleMapProps['fills'] }) {
  return (
    <g transform={`translate(${offsetX},0)`}>
      {shapes.map((shape, index) => {
        const fill = shape.region ? (fills[shape.region] ?? IDLE_FILL) : BASE_FILL
        const paths = shape.mirror ? [false, true] : [false]
        return paths.map((mirrored) => (
          <m.path
            key={`${index}-${mirrored ? 'r' : 'l'}`}
            d={shape.d}
            transform={mirrored ? 'translate(100,0) scale(-1,1)' : undefined}
            initial={false}
            animate={{ fill }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ fill }}
          />
        ))
      })}
    </g>
  )
}

// Corpo de frente e de costas com as regiões coloridas. As cores ficam em
// atributos/estilos inline para o SVG poder ser exportado como imagem.
export function MuscleMap({ fills, className, showLabels = false, label, ref }: MuscleMapProps) {
  const highlighted = Object.keys(fills) as MuscleRegion[]
  const description =
    label ??
    (highlighted.length > 0
      ? `Músculos em destaque: ${highlighted.map((region) => REGION_LABELS[region]).join(', ')}`
      : 'Nenhum músculo em destaque')

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 212 ${showLabels ? 224 : 212}`}
      role="img"
      aria-label={description}
      className={cn('h-auto w-full', className)}
    >
      <Figure shapes={FRONT_SHAPES} offsetX={0} fills={fills} />
      <Figure shapes={BACK_SHAPES} offsetX={112} fills={fills} />
      {showLabels && (
        <g fill="#71717a" fontFamily="system-ui, -apple-system, sans-serif" fontSize="7" fontWeight="700" letterSpacing="1.4" textAnchor="middle">
          <text x="50" y="222">
            FRENTE
          </text>
          <text x="162" y="222">
            COSTAS
          </text>
        </g>
      )}
    </svg>
  )
}
