'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'

// Tons lisos da paleta (esmeralda, âmbar, grafite) para diferenciar alunos nas
// listas sem degradê e sem sair da identidade visual (preto legível em todos).
const TONES = ['bg-emerald-400', 'bg-amber-300', 'bg-zinc-300', 'bg-zinc-100', 'bg-lime-300', 'bg-amber-200']

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
  // Foto de perfil (URL pública); sem ela, ou se falhar, mostra as iniciais.
  src?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZES = {
  xs: 'h-6 w-6 rounded-lg text-xs',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
}

export function Avatar({ name, seed, src, size = 'md', className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const tone = TONES[hash(seed ?? name ?? '') % TONES.length]
  const showPhoto = Boolean(src) && failedSrc !== src

  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-2xl font-display font-bold text-black',
        tone,
        SIZES[size],
        className,
      )}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto do bucket público do Supabase, já reduzida para 512 px
        <img
          src={src as string}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailedSrc(src ?? null)}
          className="h-full w-full object-cover"
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  )
}
