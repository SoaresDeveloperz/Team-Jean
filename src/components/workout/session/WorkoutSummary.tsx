'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { m } from 'framer-motion'
import { Check, Clock, Download, Gauge, Layers, LoaderCircle, MessageCircleHeart, Share2, Trophy, Weight } from 'lucide-react'
import type { PostDraft } from '@/lib/community'
import type { MuscleRegion } from '@/lib/muscles'
import { formatKg } from '@/lib/workouts'
import { renderShareImage, serializeSvg } from '@/lib/share-image'
import { haptic } from '@/lib/haptics'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { Logo } from '@/components/ui/logo'
import { MuscleMap } from '@/components/fitness/MuscleMap'
import { Composer } from '@/components/community/Composer'

export type WorkoutSummaryData = {
  workoutName: string
  volume: number
  sets: number
  minutes: number | null
  rpe: number
  prs: { name: string; weight: number; reps: number }[]
  fills: Partial<Record<MuscleRegion, string>>
  // Intensidade 0..1 por região (para o post da comunidade redesenhar o mapa).
  regions: Partial<Record<MuscleRegion, number>>
}

// Partículas que "explodem" do troféu na entrada.
const PARTICLES = Array.from({ length: 14 }, (_, index) => {
  const angle = (index / 14) * Math.PI * 2
  return { x: Math.cos(angle) * (70 + (index % 3) * 18), y: Math.sin(angle) * (70 + (index % 3) * 18), gold: index % 2 === 0 }
})

export function WorkoutSummary({ data, onDone }: { data: WorkoutSummaryData; onDone: () => void }) {
  const toast = useToast()
  const mapRef = useRef<SVGSVGElement>(null)
  const [generating, setGenerating] = useState(false)
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [posted, setPosted] = useState(false)

  useEffect(() => {
    haptic([40, 60, 120])
  }, [])

  useEffect(() => () => {
    if (image) URL.revokeObjectURL(image.url)
  }, [image])

  const closePreview = useCallback(() => setImage(null), [])
  const closeComposer = useCallback(() => setComposerOpen(false), [])
  const handlePosted = useCallback(() => {
    setPosted(true)
    haptic([10, 30, 10])
    toast({ tone: 'success', title: 'Publicado na comunidade 🔥', description: 'A equipe já pode dar fogo no seu treino.' })
  }, [toast])

  const workoutDraft: PostDraft = {
    kind: 'workout',
    meta: {
      name: data.workoutName,
      volume: data.volume,
      sets: data.sets,
      minutes: data.minutes,
      rpe: data.rpe,
      prs: data.prs,
      regions: data.regions,
    },
  }

  const generate = async () => {
    setGenerating(true)
    try {
      const blob = await renderShareImage({
        workoutName: data.workoutName,
        date: new Date(),
        minutes: data.minutes,
        volume: data.volume,
        sets: data.sets,
        rpe: data.rpe,
        prs: data.prs,
        muscleSvg: serializeSvg(mapRef.current),
      })
      setImage({ blob, url: URL.createObjectURL(blob) })
    } catch {
      toast({ tone: 'error', title: 'Não foi possível gerar a imagem' })
    } finally {
      setGenerating(false)
    }
  }

  const share = async () => {
    if (!image) return
    const file = new File([image.blob], 'treino-team-jean.png', { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Team Jean', text: `Treino "${data.workoutName}" concluído! 💪 @teamjean` })
        return
      }
      const link = document.createElement('a')
      link.href = image.url
      link.download = file.name
      link.click()
      toast({ tone: 'success', title: 'Imagem salva', description: 'Poste nos stories e marque @teamjean' })
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') toast({ tone: 'error', title: 'Não foi possível compartilhar' })
    }
  }

  const stats = [
    { label: 'Volume', icon: Weight, value: formatKg(data.volume), unit: 'kg' },
    { label: 'Séries', icon: Layers, value: String(data.sets), unit: '' },
    { label: 'Duração', icon: Clock, value: data.minutes ? String(data.minutes) : '—', unit: data.minutes ? 'min' : '' },
    { label: 'Esforço', icon: Gauge, value: String(data.rpe), unit: '/10' },
  ]

  return (
    <div className="space-y-4 pb-10 pt-[calc(1rem+env(safe-area-inset-top))]">
      <div className="relative flex flex-col items-center pt-6 text-center">
        <div className="relative grid h-28 w-28 place-items-center">
          {PARTICLES.map((particle, index) => (
            <m.span
              key={index}
              className="absolute h-2 w-2 rounded-full"
              style={{ backgroundColor: particle.gold ? '#fbbf24' : '#34d399' }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
              animate={{ x: particle.x, y: particle.y, opacity: [0, 1, 0], scale: [0, 1.2, 0.4] }}
              transition={{ duration: 1.1, delay: 0.25, ease: 'easeOut' }}
            />
          ))}
          <m.div
            initial={{ scale: 0, rotate: -25 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
            className="grid h-24 w-24 place-items-center rounded-[2rem] bg-white text-black shadow-[0_0_60px_rgba(52,211,153,0.35)]"
          >
            <Logo className="h-14 w-14 [&_path]:fill-black" />
          </m.div>
        </div>
        <m.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-6 text-xs font-black uppercase tracking-[0.24em] text-brand"
        >
          Treino concluído
        </m.p>
        <m.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mt-2 font-display text-[2.6rem] font-bold uppercase leading-[0.9]"
        >
          {data.workoutName}
        </m.h1>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        {stats.map((stat, index) => (
          <m.div
            key={stat.label}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.55 + index * 0.06 }}
            className="rounded-3xl border border-line bg-surface p-4"
          >
            <dt className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.1em] text-zinc-500">
              <stat.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {stat.label}
            </dt>
            <dd className="mt-2 font-display text-4xl font-bold leading-none">
              {stat.value}
              {stat.unit && <span className="ml-1 text-base text-zinc-500">{stat.unit}</span>}
            </dd>
          </m.div>
        ))}
      </dl>

      {data.prs.length > 0 && (
        <m.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}
          className="rounded-3xl border border-gold/25 bg-gold-soft p-4"
          aria-label="Novos recordes"
        >
          <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.12em] text-gold">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            {data.prs.length === 1 ? 'Novo recorde pessoal' : `${data.prs.length} novos recordes`}
          </p>
          <ul className="mt-2.5 space-y-2">
            {data.prs.map((record) => (
              <li key={record.name} className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-semibold text-white">{record.name}</span>
                <span className="shrink-0 font-display text-xl font-bold text-gold">
                  {formatKg(record.weight)}kg × {record.reps}
                </span>
              </li>
            ))}
          </ul>
        </m.section>
      )}

      <m.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.95 }}
        className="rounded-3xl border border-line bg-surface p-4"
        aria-label="Músculos trabalhados"
      >
        <p className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Músculos trabalhados</p>
        <div className="mx-auto mt-3 max-w-[260px]">
          <MuscleMap ref={mapRef} fills={data.fills} showLabels />
        </div>
      </m.section>

      <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05 }} className="space-y-2.5 pt-1">
        {posted ? (
          <Link
            href="/student/community"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-brand/40 bg-brand-soft text-sm font-black uppercase tracking-[0.16em] text-brand"
          >
            <Check className="h-4 w-4" aria-hidden="true" /> Ver na comunidade
          </Link>
        ) : (
          <m.button
            type="button"
            onClick={() => setComposerOpen(true)}
            whileTap={{ scale: 0.97 }}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-sm font-black uppercase tracking-[0.16em] text-black"
          >
            <MessageCircleHeart className="h-4 w-4" aria-hidden="true" /> Postar na comunidade
          </m.button>
        )}
        <m.button
          type="button"
          onClick={generate}
          disabled={generating}
          whileTap={{ scale: 0.97 }}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black uppercase tracking-[0.16em] text-black disabled:opacity-60"
        >
          {generating ? (
            <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Gerando imagem" />
          ) : (
            <>
              <Share2 className="h-4 w-4" aria-hidden="true" /> Compartilhar nos stories
            </>
          )}
        </m.button>
        <button
          type="button"
          onClick={onDone}
          className="h-12 w-full rounded-2xl border border-line bg-white/[0.04] text-xs font-bold uppercase tracking-wider text-zinc-300"
        >
          Voltar para o app
        </button>
      </m.div>

      <Composer open={composerOpen} onClose={closeComposer} onPosted={handlePosted} draft={workoutDraft} />

      <Modal open={image !== null} onClose={closePreview} title="Seu card" description="Pronto para os stories">
        {image && (
          <div className="space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada localmente (blob:) */}
            <img
              src={image.url}
              alt={`Card do treino ${data.workoutName}`}
              className="mx-auto max-h-[52vh] w-auto rounded-2xl border border-line"
            />
            <m.button
              type="button"
              onClick={share}
              whileTap={{ scale: 0.97 }}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black uppercase tracking-[0.16em] text-black"
            >
              {typeof navigator !== 'undefined' && 'share' in navigator ? (
                <>
                  <Share2 className="h-4 w-4" aria-hidden="true" /> Compartilhar
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" aria-hidden="true" /> Baixar imagem
                </>
              )}
            </m.button>
          </div>
        )}
      </Modal>
    </div>
  )
}
