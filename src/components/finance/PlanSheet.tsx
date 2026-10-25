'use client'

import { useState } from 'react'
import { m } from 'framer-motion'
import { LoaderCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, monthOf, parseMoney, saveBilling, todaySP, type Billing } from '@/lib/finance'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { Switch } from '@/components/ui/switch'
import { friendlyError } from '@/lib/errors'

const labelClassName = 'mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400'
const fieldClassName = 'h-14 w-full rounded-2xl border border-line-strong bg-black/40 px-4 text-white focus:border-brand focus:outline-none'

type PlanSheetProps = {
  open: boolean
  studentId: string
  studentName: string
  current: Billing | undefined
  onClose: () => void
  onSaved: (billing: Billing) => void
}

// Mensalidade, dia de vencimento e se o plano está ativo (montado a cada abertura).
export function PlanSheet({ open, studentId, studentName, current, onClose, onSaved }: PlanSheetProps) {
  const [supabase] = useState(() => createClient())
  const [fee, setFee] = useState(current ? current.monthly_fee.toFixed(2).replace('.', ',') : '')
  const [dueDay, setDueDay] = useState(current?.due_day ?? 10)
  const [active, setActive] = useState(current?.active ?? true)
  const [startsOn, setStartsOn] = useState((current?.starts_on ?? monthOf(todaySP())).slice(0, 7))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = parseMoney(fee)
    if (Number.isNaN(value) || value <= 0) return setError('Informe o valor da mensalidade (ex.: 150,00).')
    if (!/^\d{4}-\d{2}$/.test(startsOn)) return setError('Informe o mês de início da cobrança.')
    setSaving(true)
    setError('')
    try {
      onSaved(await saveBilling(supabase, { student_id: studentId, monthly_fee: value, due_day: dueDay, active, starts_on: `${startsOn}-01` }))
    } catch (saveError) {
      setError(friendlyError(saveError, 'Não foi possível salvar o plano'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={saving ? () => undefined : onClose} title="Plano do aluno" description={studentName}>
      <form onSubmit={save} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="plan-fee" className={labelClassName}>
              Mensalidade (R$)
            </label>
            <input
              id="plan-fee"
              inputMode="decimal"
              value={fee}
              onChange={(event) => setFee(event.target.value)}
              placeholder={formatBRL(150)}
              className={`${fieldClassName} text-center font-display text-2xl font-bold placeholder:text-zinc-600`}
            />
          </div>
          <div>
            <label htmlFor="plan-due" className={labelClassName}>
              Vence todo dia
            </label>
            <select id="plan-due" value={dueDay} onChange={(event) => setDueDay(Number(event.target.value))} className={fieldClassName}>
              {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                <option key={day} value={day}>
                  {day}
                  {day > 28 ? ' (ou último dia)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="plan-start" className={labelClassName}>
            Cobrar a partir de
          </label>
          <input id="plan-start" type="month" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} className={fieldClassName} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
          <div>
            <p className="text-sm font-bold text-white">Plano ativo</p>
            <p className="text-[11px] text-zinc-400">Pausado: o aluno não aparece como pendente.</p>
          </div>
          <Switch label="Plano ativo" checked={active} onChange={setActive} />
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        <m.button
          type="submit"
          disabled={saving}
          whileTap={{ scale: 0.98 }}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-white text-sm font-black uppercase tracking-[0.14em] text-black disabled:opacity-60"
        >
          {saving ? <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Salvando" /> : 'Salvar plano'}
        </m.button>
      </form>
    </Modal>
  )
}
