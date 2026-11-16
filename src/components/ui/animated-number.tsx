'use client'

import { useEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

type AnimatedNumberProps = {
  value: number
  format?: (value: number) => string
  className?: string
  // Conta a partir de zero na primeira renderização.
  fromZero?: boolean
  // Duração da contagem em segundos (padrão 0,8).
  duration?: number
}

const defaultFormat = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value)

export function AnimatedNumber({ value, format = defaultFormat, className, fromZero = true, duration = 0.8 }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const previous = useRef(fromZero ? 0 : value)
  const reduceMotion = useReducedMotion()
  const formatRef = useRef(format)

  useEffect(() => {
    formatRef.current = format
  }, [format])

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (reduceMotion) {
      node.textContent = formatRef.current(value)
      previous.current = value
      return
    }
    const controls = animate(previous.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        node.textContent = formatRef.current(latest)
      },
    })
    previous.current = value
    return () => controls.stop()
  }, [value, reduceMotion, duration])

  return (
    <span ref={ref} className={className}>
      {format(fromZero ? 0 : value)}
    </span>
  )
}
