'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Bell, BellOff, Dumbbell, Megaphone } from 'lucide-react'
import { markNotificationsSeen, onOpenNotifications, useNotifications } from '@/lib/notifications'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/cn'

export function NotificationsButton() {
  const { items, unseen, seen } = useNotifications()
  const [open, setOpen] = useState(false)

  useEffect(() => onOpenNotifications(() => setOpen(true)), [])

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
        aria-label={unseenCount > 0 ? `Avisos do treinador: ${unseenCount} novo(s)` : 'Avisos do treinador'}
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

      <Modal open={open} onClose={close} title="Avisos" description="Recados do seu treinador">
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
              const Icon = item.type === 'workout_updated' ? Dumbbell : Megaphone
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
