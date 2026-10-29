'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Check, ChevronDown, Copy, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  dueDate,
  PIX_KEY_TYPES,
  formatBRL,
  guessPixKeyType,
  loadMyBilling,
  methodLabel,
  monthOf,
  monthTitle,
  pixPayload,
  pixTxid,
  shortDay,
  statusFor,
  todaySP,
  type Billing,
  type CoachSettings,
  type Payment,
} from '@/lib/finance'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/cn'
import { useToast } from '@/components/ui/toast'
import { Eyebrow, Tile } from '@/components/ui/tile'

type Data = { billing: Billing; payment: Payment | null; settings: CoachSettings | null }

// Mensalidade do mês no Perfil do aluno, com o PIX copia e cola do treinador.
export function BillingCard({ userId, highlight = false }: { userId: string; highlight?: boolean }) {
  const [supabase] = useState(() => createClient())
  const toast = useToast()
  const ref = useRef<HTMLDivElement>(null)
  const [today] = useState(() => todaySP())
  const month = monthOf(today)
  const [data, setData] = useState<Data | null>(null)
  const [copied, setCopied] = useState(false)
  const [showCode, setShowCode] = useState(false)

  useEffect(() => {
    let active = true
    loadMyBilling(supabase, userId, month)
      .then((result) => {
        if (!active || !result.billing) return
        setData({ billing: result.billing, payment: result.payment, settings: result.settings })
        // Aberto pelo lembrete (?mensalidade=1): leva até o cartão.
        if (highlight) window.requestAnimationFrame(() => ref.current?.scrollIntoView({ block: 'center' }))
      })
      // Sem plano, sem o gestao.sql ou sem conexão: o cartão não aparece.
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [supabase, userId, month, highlight])

  if (!data) return null
  const { billing, payment, settings } = data
  const status = statusFor(billing, payment ?? undefined, month, today)
  if (status === 'paused' || status === 'not_started') return null
  const due = dueDate(billing.due_day, month)
  // Mesmo nome que vai no código do PIX: o aluno confere no banco antes de pagar.
  const pixName = settings?.pix_name?.trim() || 'Team Jean'
  const pixKeyLabel = settings?.pix_key ? PIX_KEY_TYPES.find((item) => item.value === guessPixKeyType(settings.pix_key))?.label : null
  const pix =
    settings?.pix_key && status !== 'paid'
      ? pixPayload({
          key: settings.pix_key,
          name: pixName,
          city: settings.pix_city ?? 'Brasil',
          amount: billing.monthly_fee,
          txid: pixTxid(userId, month),
          description: `Mensalidade ${month.slice(5, 7)}/${month.slice(0, 4)}`,
        })
      : null

  const copy = async () => {
    if (!pix) return
    try {
      await navigator.clipboard.writeText(pix)
      setCopied(true)
      haptic(15)
      toast({ tone: 'success', title: 'PIX copiado', description: 'Abra o app do seu banco, escolha "PIX copia e cola" e cole o código.' })
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setShowCode(true)
      toast({ tone: 'error', title: 'Não foi possível copiar', description: 'Selecione o código abaixo e copie.' })
    }
  }

  const tone =
    status === 'paid' ? 'text-brand' : status === 'overdue' ? 'text-danger' : status === 'due_today' ? 'text-gold' : 'text-zinc-300'
  const statusLabel =
    status === 'paid' && payment
      ? `Pago em ${shortDay(payment.paid_on)} · ${methodLabel(payment.method)}`
      : status === 'overdue'
        ? `Venceu dia ${shortDay(due)}`
        : status === 'due_today'
          ? 'Vence hoje'
          : `Vence dia ${shortDay(due)}`

  return (
    <div ref={ref} className="scroll-mt-24">
      <Tile className={cn(highlight && 'ring-2 ring-brand/60', status === 'overdue' && 'border-danger/30')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2>
              <Eyebrow icon={Wallet}>Mensalidade</Eyebrow>
            </h2>
            <p className="mt-1 text-xs text-zinc-400">{monthTitle(month)}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-bold leading-none text-white">{formatBRL(payment?.amount ?? billing.monthly_fee)}</p>
            <p className={cn('mt-1 flex items-center justify-end gap-1 text-xs font-bold', tone)}>
              {status === 'paid' && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              {statusLabel}
            </p>
          </div>
        </div>

        {status !== 'paid' &&
          (pix ? (
            <div className="mt-4 space-y-2">
              <div className="rounded-2xl border border-line bg-black/20 p-3 text-xs leading-relaxed text-zinc-300">
                <p>
                  Para: <span className="font-bold text-white">{pixName}</span>
                  {pixKeyLabel && <span className="text-zinc-400"> · chave {pixKeyLabel.toLowerCase()}</span>}
                </p>
                <p className="mt-0.5 text-zinc-400">Confira se o banco mostra este nome. Depois de pagar, seu treinador confirma aqui.</p>
              </div>
              <m.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => void copy()}
                className={cn(
                  'flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-xs font-black uppercase tracking-[0.14em] transition-colors',
                  copied ? 'bg-brand text-black' : 'bg-white text-black',
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <m.span key={copied ? 'ok' : 'copy'} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grid">
                    {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                  </m.span>
                </AnimatePresence>
                {copied ? 'PIX copiado' : 'Copiar código PIX'}
              </m.button>
              <button
                type="button"
                onClick={() => setShowCode((value) => !value)}
                aria-expanded={showCode}
                className="flex w-full items-center justify-center gap-1 text-xs font-bold text-zinc-400 hover:text-white"
              >
                {showCode ? 'Esconder código' : 'Ver código'}
                <m.span animate={{ rotate: showCode ? 180 : 0 }}>
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </m.span>
              </button>
              <AnimatePresence initial={false}>
                {showCode && (
                  <m.p
                    key="code"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="select-all overflow-hidden break-all rounded-2xl bg-black/40 p-3 font-mono text-xs leading-relaxed text-zinc-300"
                  >
                    {pix}
                  </m.p>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <p className="mt-3 rounded-2xl border border-line bg-black/20 p-3 text-xs text-zinc-400">Combine a forma de pagamento com seu treinador.</p>
          ))}
      </Tile>
    </div>
  )
}
