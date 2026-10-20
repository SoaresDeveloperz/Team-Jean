'use client'

import { m } from 'framer-motion'
import { BatteryCharging } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Eyebrow, Tile } from '@/components/ui/tile'

const SEGMENTS = 10

export function readinessLevel(value: number) {
  if (value >= 80) return { label: 'Pronto pra treinar', color: '#34d399', className: 'text-brand' }
  if (value >= 50) return { label: 'Energia moderada', color: '#fbbf24', className: 'text-gold' }
  return { label: 'Fadigado', color: '#fb7185', className: 'text-danger' }
}

type ReadinessCardProps = {
  value: number
  onChange: (value: number) => void
  status: 'idle' | 'saving' | 'saved' | 'error'
}

// Barras crescentes (estilo sinal) com um <input type="range"> nativo e
// transparente por cima: visual próprio sem perder teclado e leitor de tela.
export function ReadinessCard({ value, onChange, status }: ReadinessCardProps) {
  const level = readinessLevel(value)
  const filled = Math.round(value / 10)

  return (
    <Tile>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow icon={BatteryCharging}>Prontidão</Eyebrow>
          <p className="mt-1.5 text-sm text-zinc-300">Como está sua energia hoje?</p>
        </div>
        <div className="text-right">
          <p className={cn('font-display text-4xl font-bold leading-none', level.className)}>{value}%</p>
          <p className="mt-1 text-[11px] font-semibold text-zinc-400">{level.label}</p>
        </div>
      </div>

      <div className="relative mt-5 rounded-xl outline-offset-4 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-brand">
        <div className="flex h-12 items-end gap-1.5" aria-hidden="true">
          {Array.from({ length: SEGMENTS }, (_, index) => {
            const active = index < filled
            return (
              <m.span
                key={index}
                className="flex-1 rounded-md"
                style={{ height: `${34 + index * 7.3}%` }}
                initial={false}
                animate={{
                  backgroundColor: active ? level.color : 'rgba(255,255,255,0.07)',
                  opacity: active ? 1 : 0.9,
                }}
                transition={{ duration: 0.25, delay: active ? index * 0.02 : 0 }}
              />
            )
          })}
        </div>
        <input
          type="range"
          min={10}
          max={100}
          step={10}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label="Prontidão para treinar"
          aria-valuetext={`${value}%, ${level.label}`}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
        />
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-600">
        <span>Fadigado</span>
        <span aria-live="polite" className="normal-case tracking-normal">
          {status === 'saving' && <span className="text-zinc-500">Salvando...</span>}
          {status === 'saved' && <span className="text-brand">Salvo pro seu treinador</span>}
          {status === 'error' && <span className="text-danger">Não foi possível salvar</span>}
        </span>
        <span>Recuperado</span>
      </div>
    </Tile>
  )
}
