'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { CalendarClock, Flame, Plus, Target, Trash2, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  CoachError,
  challengeStatus,
  dayFromIso,
  daysLeft,
  deleteChallenge,
  formatProgress,
  loadChallenges,
  loadStandings,
  type Challenge,
  type Standing,
} from '@/lib/coach'
import { publicImageUrl } from '@/lib/profile'
import { plural } from '@/lib/text'
import { cn } from '@/lib/cn'
import { BarFill } from '@/components/ui/bar-fill'
import { friendlyError } from '@/lib/errors'
import { Avatar } from '@/components/ui/avatar'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { Confetti } from '@/components/motion/Confetti'
import { ChallengeForm } from './ChallengeForm'

type Status = 'loading' | 'ready' | 'missing' | 'error'
type Board = { challenge: Challenge; standings: Standing[] }

const short = (iso: string) => dayFromIso(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const CELEBRATED_KEY = 'tj:desafios-comemorados'

function wasCelebrated(id: string) {
  try {
    return (JSON.parse(window.localStorage.getItem(CELEBRATED_KEY) ?? '[]') as string[]).includes(id)
  } catch {
    return true
  }
}

function markCelebrated(id: string) {
  try {
    const list = JSON.parse(window.localStorage.getItem(CELEBRATED_KEY) ?? '[]') as string[]
    window.localStorage.setItem(CELEBRATED_KEY, JSON.stringify([...list.slice(-30), id]))
  } catch {
    // Sem armazenamento: só comemora de novo na próxima vez.
  }
}

function ChallengeCard({
  board,
  viewerId,
  viewerIsAdmin,
  onDelete,
}: {
  board: Board
  viewerId: string
  viewerIsAdmin: boolean
  onDelete: (challenge: Challenge) => void
}) {
  const { challenge, standings } = board
  const status = challengeStatus(challenge)
  const left = daysLeft(challenge)
  const mine = standings.find((row) => row.user_id === viewerId)
  const myProgress = mine?.progress ?? 0
  const done = myProgress >= challenge.goal
  const finishers = standings.filter((row) => row.progress >= challenge.goal).length
  const [burst, setBurst] = useState(0)

  // Comemora uma vez quando o aluno bate a meta (lembrado no aparelho).
  useEffect(() => {
    if (viewerIsAdmin || !done || wasCelebrated(challenge.id)) return
    markCelebrated(challenge.id)
    const timer = window.setTimeout(() => setBurst(1), 400)
    return () => window.clearTimeout(timer)
  }, [done, viewerIsAdmin, challenge.id])

  const top = standings.slice(0, 5)
  const percent = Math.min(1, myProgress / challenge.goal)

  return (
    <m.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      aria-labelledby={`challenge-${challenge.id}`}
      className="relative overflow-hidden rounded-3xl p-[1.5px]"
    >
      {/* Borda em gradiente girando (some com "reduzir movimento"). */}
      <span aria-hidden="true" className="challenge-border absolute inset-[-60%] opacity-70" />
      <div className="relative rounded-[calc(1.5rem-1.5px)] bg-surface p-4">
        <div className="flex items-start gap-3">
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold-soft text-gold">
            <Flame className="h-5 w-5" aria-hidden="true" />
            <Confetti burst={burst} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.1em] text-gold">
              Desafio da equipe{status === 'upcoming' ? ' · em breve' : ''}
            </p>
            <h3 id={`challenge-${challenge.id}`} className="mt-0.5 truncate font-display text-2xl font-bold uppercase leading-tight text-white">
              {challenge.title}
            </h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <Target className="h-3 w-3" aria-hidden="true" /> {formatProgress(challenge.metric, challenge.goal)}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" aria-hidden="true" />
                {status === 'upcoming'
                  ? `começa ${short(challenge.starts_on)}`
                  : left === 0
                    ? 'último dia!'
                    : `${plural(left, 'dia restante', 'dias restantes')}`}
              </span>
            </p>
          </div>
          {viewerIsAdmin && (
            <button
              type="button"
              onClick={() => onDelete(challenge)}
              aria-label={`Apagar o desafio ${challenge.title}`}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zinc-500 transition hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {challenge.description && <p className="mt-3 text-sm leading-relaxed text-zinc-300">{challenge.description}</p>}

        {viewerIsAdmin ? (
          <p className="mt-3 rounded-2xl bg-white/[0.04] px-3 py-2 text-xs text-zinc-300">
            <span className="font-bold text-white">{finishers}</span> de {plural(standings.length, 'aluno', 'alunos')} já bateram a meta.
          </p>
        ) : (
          <div className="mt-3">
            <div className="flex items-end justify-between gap-2">
              <p className="font-display text-4xl font-bold leading-none">
                {challenge.metric === 'volume' ? formatProgress('volume', myProgress) : Math.round(myProgress)}
                {challenge.metric !== 'volume' && <span className="text-base text-zinc-500">/{challenge.goal}</span>}
              </p>
              <p className={cn('text-xs font-bold', done ? 'text-gold' : 'text-zinc-400')}>
                {done ? 'Meta batida! 🏆' : `faltam ${formatProgress(challenge.metric, challenge.goal - myProgress)}`}
              </p>
            </div>
            <div
              role="progressbar"
              aria-label={`Seu progresso no desafio ${challenge.title}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(percent * 100)}
              className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10"
            >
              <BarFill
                value={Math.max(0.03, percent)}
                delay={200}
                className={done ? 'bg-gold' : 'bg-gradient-to-r from-brand-deep via-brand to-gold'}
              />
            </div>
          </div>
        )}

        {top.length > 0 && (
          <ol className="mt-4 space-y-2" aria-label={`Placar do desafio ${challenge.title}`}>
            {top.map((row, index) => {
              const share = Math.min(1, row.progress / challenge.goal)
              const isViewer = row.user_id === viewerId
              return (
                <li key={row.user_id} className="flex items-center gap-2.5">
                  <span className={cn('w-4 text-center text-xs font-black tabular-nums', index === 0 ? 'text-gold' : 'text-zinc-500')}>
                    {index + 1}
                  </span>
                  <Avatar name={row.full_name} seed={row.user_id} src={publicImageUrl(row.avatar_path, row.user_id)} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2 text-xs">
                      <span className={cn('truncate font-bold', isViewer ? 'text-brand' : 'text-white')}>
                        {row.full_name.split(' ')[0]}
                        {isViewer && ' (você)'}
                      </span>
                      <span className="shrink-0 tabular-nums text-zinc-400">
                        {formatProgress(challenge.metric, row.progress)}
                        {row.progress >= challenge.goal && <Trophy className="ml-1 inline h-3 w-3 text-gold" aria-label="meta batida" />}
                      </span>
                    </span>
                    <span aria-hidden="true" className="mt-1 block h-1 overflow-hidden rounded-full bg-white/[0.07]">
                      <BarFill
                        value={Math.max(0.02, share)}
                        delay={250 + Math.min(index, 8) * 50}
                        className={row.progress >= challenge.goal ? 'bg-gold' : 'bg-brand/80'}
                      />
                    </span>
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </m.article>
  )
}

// Desafios ativos no topo da aba Equipe. O treinador cria e apaga.
export function ChallengesSection({
  viewerId,
  viewerIsAdmin,
  studentIds,
  refreshKey,
}: {
  viewerId: string
  viewerIsAdmin: boolean
  studentIds: string[]
  refreshKey: number
}) {
  const [supabase] = useState(() => createClient())
  const toast = useToast()
  const [status, setStatus] = useState<Status>('loading')
  const [boards, setBoards] = useState<Board[]>([])
  const [reloadKey, setReloadKey] = useState(0)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  // ?desafio=1 (atalho do treinador) já abre o formulário.
  const [formOpen, setFormOpen] = useState(() => viewerIsAdmin && searchParams.get('desafio') === '1')
  const [formKey, setFormKey] = useState(0)
  const [confirm, setConfirm] = useState<Challenge | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const challenges = (await loadChallenges(supabase)).filter((challenge) => challengeStatus(challenge) !== 'ended').slice(0, 3)
        const standings = await Promise.all(challenges.map((challenge) => loadStandings(supabase, challenge.id)))
        if (!active) return
        setBoards(challenges.map((challenge, index) => ({ challenge, standings: standings[index] })))
        setStatus('ready')
      } catch (error) {
        if (!active) return
        setStatus(error instanceof CoachError && error.missing ? 'missing' : 'error')
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [supabase, reloadKey, refreshKey])

  useEffect(() => {
    if (searchParams.get('desafio')) router.replace(pathname, { scroll: false })
  }, [searchParams, router, pathname])

  const closeForm = useCallback(() => setFormOpen(false), [])
  const closeConfirm = useCallback(() => {
    if (!deleting) setConfirm(null)
  }, [deleting])

  const openForm = () => {
    setFormKey((key) => key + 1)
    setFormOpen(true)
  }

  const handleCreated = () => {
    setFormOpen(false)
    setReloadKey((key) => key + 1)
    toast({ tone: 'success', title: 'Desafio criado 🔥', description: 'A equipe já pode ver o placar.' })
  }

  const confirmDelete = async () => {
    if (!confirm) return
    setDeleting(true)
    try {
      await deleteChallenge(supabase, confirm.id)
      setBoards((list) => list.filter((board) => board.challenge.id !== confirm.id))
      toast({ tone: 'success', title: 'Desafio apagado' })
    } catch (error) {
      toast({ tone: 'error', title: 'Não foi possível apagar', description: friendlyError(error) })
    } finally {
      setDeleting(false)
      setConfirm(null)
    }
  }

  if (status === 'loading') return viewerIsAdmin ? <Skeleton className="h-28 rounded-3xl" /> : null
  // Aluno sem desafios (ou sem o coach.sql): a seção some.
  if (!viewerIsAdmin && (status !== 'ready' || boards.length === 0)) return null

  return (
    <section aria-label="Desafios da equipe" className="space-y-3">
      {viewerIsAdmin && status === 'missing' && (
        <p className="rounded-3xl border border-dashed border-line-strong p-4 text-center text-xs leading-relaxed text-zinc-400">
          Para criar <span className="font-bold text-white">desafios da equipe</span>, rode o arquivo{' '}
          <code className="text-brand">supabase/coach.sql</code> no SQL Editor do Supabase.
        </p>
      )}
      {viewerIsAdmin && status === 'error' && <p className="text-xs text-danger">Não foi possível carregar os desafios.</p>}

      <AnimatePresence initial={false}>
        {boards.map((board) => (
          <ChallengeCard key={board.challenge.id} board={board} viewerId={viewerId} viewerIsAdmin={viewerIsAdmin} onDelete={setConfirm} />
        ))}
      </AnimatePresence>

      {viewerIsAdmin && status === 'ready' && (
        <m.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={openForm}
          className="flex w-full items-center gap-3 rounded-3xl border border-dashed border-gold/40 bg-gold-soft/40 p-4 text-left transition hover:border-gold/70"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold text-black">
            <Plus className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-white">{boards.length > 0 ? 'Novo desafio' : 'Crie um desafio para a equipe'}</span>
            <span className="block text-xs text-zinc-400">Meta de treinos, dias ativos ou volume, com placar automático.</span>
          </span>
        </m.button>
      )}

      {viewerIsAdmin && <ChallengeForm key={formKey} open={formOpen} studentIds={studentIds} onClose={closeForm} onCreated={handleCreated} />}
      <ConfirmDialog
        open={confirm !== null}
        title="Apagar desafio?"
        description="O placar some para todos. Os treinos dos alunos continuam salvos."
        confirmLabel="Apagar"
        busy={deleting}
        onConfirm={confirmDelete}
        onClose={closeConfirm}
      />
    </section>
  )
}
