'use client'

import { useState } from 'react'
import { m } from 'framer-motion'
import { LoaderCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PAYMENT_METHODS, formatBRL, monthLabel, parseMoney, recordPayment, todaySP, type Payment, type PaymentMethod } from '@/lib/finance'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'

const labelClassName = 'mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400'
const chipClassName =
  'flex h-10 cursor-pointer items-center justify-center rounded-full border border-line px-3.5 text-xs font-bold text-zinc-300 transition hover:text-white has-[:checked]:border-white has-[:checked]:bg-white has-[:checked]:text-black has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand'

type PaymentSheetProps = {
  open: boolean
  studentId: string
  studentName: string
  month: string
  suggested: number | null
  onClose: () => void
  onSaved: (payment: Payment) => void
}

// Registra o pagamento do mês (montado de novo a cada abertura).
export function PaymentSheet({ open, studentId, studentName, month, suggested, onClose, onSaved }: PaymentSheetProps) {
  const [supabase] = useState(() => createClient())
  const [amount, setAmount] = useState(suggested ? String(suggested.toFixed(2)).replace('.', ',') : '')
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [paidOn, setPaidOn] = useState(() => todaySP())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = parseMoney(amount)
    if (Number.isNaN(value) || value <= 0) return setError('Informe o valor recebido (ex.: 150,00).')
    if (!paidOn || paidOn > todaySP()) return setError('Confira a data do pagamento.')
    setSaving(true)
    setError('')
    try {
      onSaved(await recordPayment(supabase, { student_id: studentId, reference_month: month, amount: value, method, paid_on: paidOn }))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível registrar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={saving ? () => undefined : onClose} title="Registrar pagamento" description={`${studentName} · ${monthLabel(month)}`}>
      <form onSubmit={save} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="payment-amount" className={labelClassName}>
              Valor (R$)
            </label>
            <input
              id="payment-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={suggested ? formatBRL(suggested) : '150,00'}
              className="h-14 w-full rounded-2xl border border-line-strong bg-black/40 px-4 text-center font-display text-2xl font-bold text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="payment-date" className={labelClassName}>
              Pago em
            </label>
            <input
              id="payment-date"
              type="date"
              value={paidOn}
              max={todaySP()}
              onChange={(event) => setPaidOn(event.target.value)}
              className="h-14 w-full rounded-2xl border border-line-strong bg-black/40 px-3 text-white focus:border-brand focus:outline-none"
            />
          </div>
        </div>
        <fieldset>
          <legend className={labelClassName}>Forma de pagamento</legend>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((option) => (
              <label key={option.value} className={chipClassName}>
                <input type="radio" name="payment-method" checked={method === option.value} onChange={() => setMethod(option.value)} className="sr-only" />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        {error && <Alert variant="error">{error}</Alert>}
        <m.button
          type="submit"
          disabled={saving}
          whileTap={{ scale: 0.98 }}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-sm font-black uppercase tracking-[0.14em] text-black disabled:opacity-60"
        >
          {saving ? <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Salvando" /> : 'Confirmar recebimento'}
        </m.button>
      </form>
    </Modal>
  )
}
