import { cn } from '@/lib/cn'

// Gradientes discretos dentro da paleta (esmeralda, âmbar, grafite) para
// diferenciar alunos nas listas sem fugir da identidade visual.
const GRADIENTS = [
  'from-emerald-400 to-emerald-700',
  'from-amber-300 to-amber-600',
  'from-zinc-200 to-zinc-500',
  'from-teal-300 to-emerald-600',
  'from-lime-300 to-emerald-600',
  'from-orange-300 to-amber-600',
]

function hash(text: string) {
  let value = 0
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0
  return value
}

export function initialsOf(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'TJ'
  return (parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[parts.length - 1][0]}`).toUpperCase()
}

type AvatarProps = {
  name: string | null | undefined
  seed?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZES = {
  xs: 'h-6 w-6 rounded-lg text-[9px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
}

export function Avatar({ name, seed, size = 'md', className }: AvatarProps) {
  const gradient = GRADIENTS[hash(seed ?? name ?? '') % GRADIENTS.length]
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br font-display font-bold text-black',
        gradient,
        SIZES[size],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  )
}
