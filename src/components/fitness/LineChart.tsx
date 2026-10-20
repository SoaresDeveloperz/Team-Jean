'use client'

import { useId, useState } from 'react'
import { m } from 'framer-motion'
import { plural } from '@/lib/text'

export type ChartPoint = { key: string; label: string; value: number }

type LineChartProps = {
  points: ChartPoint[]
  format: (value: number) => string
  title: string
  // O que cada ponto representa, para o leitor de tela.
  noun?: [singular: string, plural: string]
}

const WIDTH = 320
const HEIGHT = 170
const PAD = { top: 30, right: 14, bottom: 24, left: 14 }

// Curva suave (Catmull-Rom convertida em Bézier) passando por todos os pontos.
function smoothPath(coords: [number, number][]) {
  if (coords.length < 2) return ''
  let d = `M${coords[0][0]},${coords[0][1]}`
  for (let index = 0; index < coords.length - 1; index++) {
    const p0 = coords[index - 1] ?? coords[index]
    const p1 = coords[index]
    const p2 = coords[index + 1]
    const p3 = coords[index + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0]},${p2[1]}`
  }
  return d
}

export function LineChart({ points, format, title, noun = ['treino', 'treinos'] }: LineChartProps) {
  const gradientId = useId()
  const [selected, setSelected] = useState<number | null>(null)
  const activeIndex = selected !== null && selected < points.length ? selected : points.length - 1

  if (points.length === 0) return null

  const values = points.map((point) => point.value)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || Math.max(1, max * 0.2)
  const low = Math.max(0, min - range * 0.25)
  const high = max + range * 0.15
  const innerWidth = WIDTH - PAD.left - PAD.right
  const innerHeight = HEIGHT - PAD.top - PAD.bottom

  const coords = points.map((point, index): [number, number] => [
    Number((PAD.left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth)).toFixed(1)),
    Number((PAD.top + innerHeight - ((point.value - low) / (high - low)) * innerHeight).toFixed(1)),
  ])
  const line = smoothPath(coords)
  const area = coords.length > 1 ? `${line} L${coords[coords.length - 1][0]},${HEIGHT - PAD.bottom} L${coords[0][0]},${HEIGHT - PAD.bottom} Z` : ''
  const [activeX, activeY] = coords[activeIndex]
  const tooltip = format(points[activeIndex].value)
  const tooltipWidth = Math.max(44, tooltip.length * 7.2 + 16)
  const tooltipX = Math.min(WIDTH - tooltipWidth - 2, Math.max(2, activeX - tooltipWidth / 2))
  const labelEvery = points.length > 6 ? 2 : 1

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`${title}: de ${format(points[0].value)} a ${format(points[points.length - 1].value)} em ${plural(points.length, ...noun)}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((fraction) => (
          <line
            key={fraction}
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={PAD.top + innerHeight * fraction}
            y2={PAD.top + innerHeight * fraction}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="3 5"
          />
        ))}

        {area && (
          <m.path
            d={area}
            fill={`url(#${gradientId})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          />
        )}
        {line && (
          <m.path
            d={line}
            fill="none"
            stroke="#34d399"
            strokeWidth={2.5}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        )}

        <line x1={activeX} x2={activeX} y1={activeY} y2={HEIGHT - PAD.bottom} stroke="rgba(52,211,153,0.35)" strokeDasharray="2 3" />

        {coords.map(([x, y], index) => (
          <g key={points[index].key}>
            <m.circle
              cx={x}
              cy={y}
              initial={{ r: 0 }}
              animate={{ r: index === activeIndex ? 5.5 : 3 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22, delay: index === activeIndex ? 0 : 0.4 + index * 0.03 }}
              fill={index === activeIndex ? '#34d399' : '#0c0c0d'}
              stroke="#34d399"
              strokeWidth={2}
            />
            {/* Área de toque maior que o ponto visível. */}
            <circle
              cx={x}
              cy={y}
              r={16}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => setSelected(index)}
            />
            {index % labelEvery === (points.length - 1) % labelEvery && (
              <text x={x} y={HEIGHT - 6} textAnchor="middle" fontSize="9" fontWeight="700" fill="#71717a">
                {points[index].label}
              </text>
            )}
          </g>
        ))}

        <g transform={`translate(${tooltipX},${Math.max(0, activeY - 34)})`}>
          <rect width={tooltipWidth} height={22} rx={8} fill="#ffffff" />
          <text x={tooltipWidth / 2} y={15} textAnchor="middle" fontSize="11" fontWeight="800" fill="#000000">
            {tooltip}
          </text>
        </g>
      </svg>

      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.key}>
              <th scope="row">{point.label}</th>
              <td>{format(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
