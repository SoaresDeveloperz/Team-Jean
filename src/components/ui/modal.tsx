'use client'

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m, useDragControls } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  // "dialog": folha que sobe de baixo (cartão central no desktop);
  // "sheet": tela cheia, para formulários longos.
  variant?: 'dialog' | 'sheet'
  // "wide": cartão mais largo no computador (ex.: ficha do aluno).
  size?: 'default' | 'wide'
}

// Rodapé das folhas (variant "sheet"): fica colado na base enquanto o conteúdo
// rola. Compensa o padding inferior da folha para nada aparecer por baixo.
export function SheetFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky -bottom-[calc(2rem+env(safe-area-inset-bottom))] z-10 -mx-4 -mb-[calc(2rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-black from-60% to-transparent px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-8">
      {children}
    </div>
  )
}

const subscribeNothing = () => () => {}

// Pilha de modais abertos: Esc e o foco preso valem só para o de cima.
const openModalStack: string[] = []

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ open, onClose, title, description, children, variant = 'dialog', size = 'default' }: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const dragControls = useDragControls()
  const isSheet = variant === 'sheet'

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    openModalStack.push(titleId)
    const previouslyFocused = document.activeElement as HTMLElement | null
    const isTop = () => openModalStack[openModalStack.length - 1] === titleId

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTop()) return
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      // Mantém o Tab dentro do modal (WCAG 2.4.3).
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus({ preventScroll: true }), 30)

    return () => {
      window.clearTimeout(focusTimer)
      openModalStack.splice(openModalStack.lastIndexOf(titleId), 1)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus?.({ preventScroll: true })
    }
  }, [open, titleId])

  // Só no navegador: o portal precisa do document.body.
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  )
  if (!mounted) return null

  // Portal no <body>: um ancestral com backdrop-filter/transform (ex.: o
  // cabeçalho de vidro) prenderia o "fixed" do modal dentro dele.
  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'fixed inset-0 z-[60] flex bg-black/80 backdrop-blur-sm',
            isSheet ? 'items-stretch' : 'items-end justify-center sm:items-center sm:p-4',
          )}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <m.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            // Mede a rolagem do modal para animações de layout (ex.: reordenar exercícios).
            layoutScroll
            initial={isSheet ? { y: '100%' } : { y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={isSheet ? { y: '100%' } : { y: 64, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag={isSheet ? false : 'y'}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose()
            }}
            className={cn(
              'w-full overflow-y-auto outline-none',
              isSheet
                ? 'bg-black px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]'
                : cn(
                    'max-h-[92vh] max-w-md rounded-t-[2rem] border border-line-strong bg-surface-2 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl shadow-black sm:rounded-[2rem] sm:pb-6',
                    size === 'wide' && 'lg:max-w-3xl',
                  ),
            )}
          >
            {!isSheet && (
              <div
                className="-mx-6 mb-2 flex cursor-grab touch-none justify-center py-2 active:cursor-grabbing sm:hidden"
                onPointerDown={(event) => dragControls.start(event)}
                aria-hidden="true"
              >
                <span className="h-1.5 w-10 rounded-full bg-white/20" />
              </div>
            )}
            <div className={cn(isSheet && 'mx-auto max-w-md', isSheet && size === 'wide' && 'lg:max-w-3xl')}>
              <div className="mb-5 flex items-start justify-between gap-3 border-b border-line pb-4">
                <div className="min-w-0">
                  <h2 id={titleId} className="font-display text-2xl font-bold uppercase leading-none tracking-wide">
                    {title}
                  </h2>
                  {description && <div className="mt-1.5 text-[13px] leading-snug text-zinc-300">{description}</div>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="-mr-2 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-zinc-300 transition hover:bg-white/5 hover:text-white"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              {children}
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
