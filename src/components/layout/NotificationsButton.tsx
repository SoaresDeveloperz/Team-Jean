'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, m } from 'framer-motion'
import { Bell, BellOff, ChevronRight, Dumbbell, HeartPulse, Megaphone, MessageCircle, MessageSquareReply, MessageSquareText, Wallet, type LucideIcon } from 'lucide-react'
import { loadNotifications, markNotificationsSeen, onOpenNotifications, openNotifications, useNotifications } from '@/lib/notifications'
import { plural } from '@/lib/text'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/cn'

const ICONS: Record<string, LucideIcon> = {
  workout_updated: Dumbbell,
  community: MessageCircle,
  feedback: MessageSquareText,
  feedback_reply: MessageSquareReply,
  billing: Wallet,
  health: HeartPulse,
}

// Atalho de cada tipo de aviso (aluno e treinador).
function linkFor(type: string, coach: boolean) {
  if (coach) {
    if (type === 'feedback') return { href: '/admin?radar=recados', label: 'Responder no radar' }
    if (type === 'health') return { href: '/admin/students', label: 'Ver alunos' }
    if (type === 'community') return { href: '/admin/community', label: 'Ver na comunidade' }
    return null
  }
  if (type === 'community') return { href: '/student/community', label: 'Ver na comunidade' }
  if (type === 'billing') return { href: '/student/profile?mensalidade=1', label: 'Pagar com PIX' }
  if (type === 'feedback_reply') return { href: '/student/history', label: 'Ver no histórico' }
  return null
}

export function NotificationsButton({ audience = 'student' }: { audience?: 'student' | 'coach' }) {
  const coach = audience === 'coach'
  const { items, unseen, seen } = useNotifications()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const stop = onOpenNotifications(() => setOpen(true))
    // Aberto pelo toque na notificação push (?avisos=1): mostra a lista.
    const params = new URLSearchParams(window.location.search)
    if (params.get('avisos') === '1') {
      params.delete('avisos')
      const query = params.toString()
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
      void loadNotifications(true).then(openNotifications)
    }
    return stop
  }, [])

  // Marca como lidos ao fechar, para o selo "Novo" aparecer enquanto a lista está aberta.
  const close = useCallback(() => {
    setOpen(false)
    markNotificationsSeen(items.map((item) => item.id))
  }, [items])

  const unseenCount = unseen.length

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          coach
            ? unseenCount > 0
              ? `Notificações: ${plural(unseenCount, 'nova', 'novas')}`
              : 'Notificações'
            : unseenCount > 0
              ? `Avisos do treinador: ${plural(unseenCount, 'novo', 'novos')}`
              : 'Avisos do treinador'
        }
        className="relative grid h-11 w-11 place-items-center rounded-2xl border border-line bg-surface text-zinc-300 transition hover:text-white"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        <AnimatePresence>
          {unseenCount > 0 && (
            <m.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-black text-black ring-2 ring-black"
            >
              {unseenCount > 9 ? '9+' : unseenCount}
            </m.span>
          )}
        </AnimatePresence>
      </button>

      <Modal
        open={open}
        onClose={close}
        title={coach ? 'Notificações' : 'Avisos'}
        description={coach ? 'Recados dos alunos, fichas de saúde e comentários' : 'Recados do seu treinador'}
      >
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-zinc-500">
              <BellOff className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold text-zinc-400">Nenhum aviso por enquanto.</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {items.map((item, index) => {
              const isNew = !seen.has(item.id)
              const Icon = ICONS[item.type] ?? Megaphone
              const link = linkFor(item.type, coach)
              return (
                <m.li
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index, 8) * 0.04 }}
                  className={cn(
                    'flex gap-3 rounded-2xl border p-4',
                    isNew ? 'border-brand/25 bg-brand-soft' : 'border-line bg-surface',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                      isNew ? 'bg-brand text-black' : 'bg-white/5 text-zinc-400',
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-white">{item.title}</h3>
                      {isNew && (
                        <span className="shrink-0 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-black uppercase text-black">
                          Novo
                        </span>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-zinc-300">{item.message}</p>
                    {item.created_at && (
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        {new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </p>
                    )}
                    {link && (
                      <Link href={link.href} onClick={close} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-brand">
                        {link.label} <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </m.li>
              )
            })}
          </ul>
        )}
      </Modal>
    </>
  )
}
