'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, m } from 'framer-motion'
import { ClipboardList, Dumbbell, Flame, Megaphone, Plus, UserPlus } from 'lucide-react'
import { haptic } from '@/lib/haptics'

const ACTIONS = [
  { href: '/admin/students?novo=1', label: 'Novo aluno', icon: UserPlus },
  { href: '/admin/workouts', label: 'Prescrever treino', icon: ClipboardList },
  { href: '/admin/announcements', label: 'Enviar aviso', icon: Megaphone },
  { href: '/admin/community?desafio=1', label: 'Novo desafio', icon: Flame },
  { href: '/admin/exercises?novo=1', label: 'Novo exercício', icon: Dumbbell },
]

// Botão flutuante com os atalhos do treinador (abre em leque, de baixo para cima).
export function CoachQuickActions() {
  const [open, setOpen] = useState(false)
  // Some ao rolar para baixo (não tapa botões do conteúdo) e volta ao subir.
  const [hidden, setHidden] = useState(false)
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const firstLinkRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    let lastY = window.scrollY
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const y = window.scrollY
        if (Math.abs(y - lastY) < 8) return
        setHidden(y > lastY && y > 120)
        lastY = y
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => firstLinkRef.current?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <>
      <AnimatePresence>
        {open && (
          <m.div
            key="backdrop"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
          />
        )}
      </AnimatePresence>

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md justify-end px-4">
        <m.div
          className="pointer-events-auto relative"
          // Navegando pelo teclado, o botão reaparece ao receber foco.
          onFocus={() => setHidden(false)}
          animate={{ y: hidden && !open ? 110 : 0, opacity: hidden && !open ? 0 : 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        >
          <AnimatePresence>
            {open && (
              <m.nav
                key="menu"
                id={menuId}
                aria-label="Atalhos do treinador"
                className="absolute bottom-[4.25rem] right-0 flex flex-col items-end gap-2"
              >
                {ACTIONS.map((action, index) => {
                  const order = ACTIONS.length - 1 - index
                  return (
                    <m.div
                      key={action.href}
                      initial={{ opacity: 0, y: 18, scale: 0.85 }}
                      animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 28, delay: order * 0.035 } }}
                      exit={{ opacity: 0, y: 12, scale: 0.9, transition: { duration: 0.12, delay: index * 0.02 } }}
                    >
                      <Link
                        ref={index === 0 ? firstLinkRef : undefined}
                        href={action.href}
                        onClick={() => {
                          haptic(10)
                          setOpen(false)
                        }}
                        className="flex h-11 items-center gap-2.5 whitespace-nowrap rounded-full border border-white/10 bg-surface-2/95 pl-4 pr-3 text-xs font-bold text-white shadow-[0_10px_30px_rgba(0,0,0,0.55)] backdrop-blur transition hover:border-brand/40"
                      >
                        {action.label}
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-brand">
                          <action.icon className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                      </Link>
                    </m.div>
                  )
                })}
              </m.nav>
            )}
          </AnimatePresence>

          <m.button
            ref={buttonRef}
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              haptic(12)
              setOpen((value) => !value)
            }}
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            aria-label={open ? 'Fechar atalhos' : 'Atalhos do treinador'}
            className="grid h-14 w-14 place-items-center rounded-full bg-brand text-black shadow-[0_12px_32px_rgba(52,211,153,0.35)]"
          >
            <m.span animate={{ rotate: open ? 135 : 0 }} transition={{ type: 'spring', stiffness: 380, damping: 22 }} className="grid">
              <Plus className="h-6 w-6" strokeWidth={2.6} aria-hidden="true" />
            </m.span>
          </m.button>
        </m.div>
      </div>
    </>
  )
}
