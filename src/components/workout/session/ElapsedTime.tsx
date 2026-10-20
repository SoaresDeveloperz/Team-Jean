'use client'

import { useEffect, useState } from 'react'
import { formatDuration } from '@/lib/stats'

// Relógio do treino. Fica isolado para o "tique" de cada segundo não
// re-renderizar a tela inteira.
export function ElapsedTime({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  return <time className="tabular-nums">{formatDuration(Math.max(0, (now - startedAt) / 1000))}</time>
}
