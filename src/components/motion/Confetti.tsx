'use client'

import { m, useReducedMotion } from 'framer-motion'

const COLORS = ['#34d399', '#fbbf24', '#ffffff', '#059669', '#fde68a']
const PIECES = Array.from({ length: 26 }, (_, index) => {
  // Distribuição fixa (sem aleatório no render): ângulos e distâncias variados.
  const angle = (index / 26) * Math.PI * 2 + (index % 3) * 0.35
  const distance = 70 + ((index * 37) % 60)
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance - 40,
    rotate: ((index * 53) % 360) - 180,
    color: COLORS[index % COLORS.length],
    round: index % 4 === 0,
    delay: (index % 5) * 0.02,
  }
})

// Explosão curta de confete a partir do centro do contêiner (relative).
export function Confetti({ burst }: { burst: number }) {
  const reduced = useReducedMotion()
  if (reduced || burst === 0) return null
  return (
    <span key={burst} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
      {PIECES.map((piece, index) => (
        <m.span
          key={index}
          className={piece.round ? 'absolute left-1/2 top-1/2 h-2 w-2 rounded-full' : 'absolute left-1/2 top-1/2 h-2.5 w-1.5 rounded-[2px]'}
          style={{ backgroundColor: piece.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
          animate={{ x: piece.x, y: [0, piece.y, piece.y + 90], opacity: [1, 1, 0], rotate: piece.rotate, scale: 1 }}
          transition={{ duration: 1.3, delay: piece.delay, ease: [0.16, 1, 0.3, 1], times: [0, 0.45, 1] }}
        />
      ))}
    </span>
  )
}
