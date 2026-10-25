'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { BellRing, ChevronLeft, ChevronRight, CircleDollarSign, HandCoins, LoaderCircle, Settings2, Undo2, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import {
  FinanceError,
  OPEN_STATUSES,
  addMonths,
  daysBetween,
  deletePayment,
  dueDate,
  formatBRL,
  loadFinance,
  methodLabel,
  monthLabel,
  monthOf,
  monthTitle,
  sendReminder,
  shortDay,
  statusFor,
  todaySP,
  type Billing,
  type BillingStatus,
  type FinanceData,
  type Payment,
} from '@/lib/finance'
import { avatarUrlOf } from '@/lib/profile'
import { plural } from '@/lib/text'
import { cn } from '@/lib/cn'
import { friendlyError } from '@/lib/errors'
import { Alert } from '@/components/ui/alert'
import { Avatar } from '@/components/ui/avatar'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ProgressRing } from '@/components/ui/progress-ring'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { Eyebrow, Stagger, Tile, tileVariants } from '@/components/ui/tile'
import { PaymentSheet } from '@/components/finance/PaymentSheet'
import { PlanSheet } from '@/components/finance/PlanSheet'
import { PixSettingsCard } from '@/components/finance/PixSettingsCard'

type Filter = 'all' | 'overdue' | 'open' | 'paid' | 'no_plan'
type Row = { student: Profile; billing: Billing | undefined; payment: Payment | undefined; status: BillingStatus; due: string | null }

const STATUS_STYLE: Record<BillingStatus, string> = {
  paid: 'bg-brand-soft text-brand',
  pending: 'bg-white/[0.06] text-zinc-300',
  due_today: 'bg-gold-soft text-gold',
  overdue: 'bg-danger-soft text-danger',
  not_started: 'bg-white/[0.06] text-zinc-400',
  paused: 'bg-white/[0.06] text-zinc-400',
  no_plan: 'bg-white/[0.06] text-zinc-400',
}

function statusText(row: Row, today: string) {
  if (row.status === 'paid' && row.payment) return `Pago ${shortDay(row.payment.paid_on)} · ${methodLabel(row.payment.method)}`
  if (row.status === 'pending' && row.due) return `Vence ${shortDay(row.due)}`
  if (row.status === 'due_today') return 'Vence hoje'
  if (row.status === 'overdue' && row.due) {
    const late = daysBetween(row.due, today)
    return `Atrasado ${plural(late, 'dia', 'dias')}`
  }
  if (row.status === 'not_started') return 'Começa depois'
  if (row.status === 'paused') return 'Plano pausado'
  return 'Sem plano'
}

export default function AdminFinancePage() {
  const [supabase] = useState(() => createClient())
  const toast = useToast()
  const [today] = useState(() => todaySP())
  const [month, setMonth] = useState(() => monthOf(todaySP()))
  const [students, setStudents] = useState<Profile[] | null>(null)
  const [finance, setFinance] = useState<FinanceData | null>(null)
  const [missing, setMissing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [paying, setPaying] = useState<Row | null>(null)
  const [planning, setPlanning] = useState<Row | null>(null)
  const [sheetKey, setSheetKey] = useState(0)
  const [undoing, setUndoing] = useState<Row | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    const load = async () => {
      const [studentsResult, financeResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'student').order('full_name'),
        loadFinance(supabase, month).then(
          (data) => ({ data, error: null }),
          (error: unknown) => ({ data: null, error }),
        ),
      ])
      if (!active) return
      if (studentsResult.error) {
        setLoadError(friendlyError(studentsResult.error, 'Não foi possível carregar os alunos'))
        return
      }
      setStudents((studentsResult.data ?? []) as Profile[])
      if (financeResult.error) {
        const error = financeResult.error
        if (error instanceof FinanceError && error.missing) setMissing(true)
        else setLoadError(friendlyError(error, 'Não foi possível carregar o financeiro'))
        return
      }
      setMissing(false)
      setLoadError('')
      setFinance(financeResult.data)
    }
    void load()
    return () => {
      active = false
    }
  }, [supabase, month, attempt])

  const retry = () => {
    setLoadError('')
    setAttempt((value) => value + 1)
  }
  // Ao trocar de mês, os números do mês anterior saem da tela (não ficam com o nome do mês novo).
  const changeMonth = (delta: number) => {
    setFinance(null)
    setLoadError('')
    setMonth((value) => addMonths(value, delta))
  }

  const rows = useMemo<Row[]>(() => {
    if (!students || !finance) return []
    const billingById = new Map(finance.billing.map((billing) => [billing.student_id, billing]))
    const paymentById = new Map(finance.payments.map((payment) => [payment.student_id, payment]))
    const order: BillingStatus[] = ['overdue', 'due_today', 'pending', 'paid', 'not_started', 'paused', 'no_plan']
    return students
      .map((student) => {
        const billing = billingById.get(student.id)
        const payment = paymentById.get(student.id)
        return {
          student,
          billing,
          payment,
          status: statusFor(billing, payment, month, today),
          due: billing ? dueDate(billing.due_day, month) : null,
        }
      })
      .sort((first, second) => order.indexOf(first.status) - order.indexOf(second.status) || (first.due ?? '').localeCompare(second.due ?? ''))
  }, [students, finance, month, today])

  const totals = useMemo(() => {
    const received = rows.reduce((total, row) => total + (row.payment?.amount ?? 0), 0)
    const open = rows.filter((row) => OPEN_STATUSES.includes(row.status))
    const overdue = rows.filter((row) => row.status === 'overdue')
    const expected = received + open.reduce((total, row) => total + (row.billing?.monthly_fee ?? 0), 0)
    return {
      received,
      expected,
      open: open.reduce((total, row) => total + (row.billing?.monthly_fee ?? 0), 0),
      openCount: open.length,
      overdue: overdue.reduce((total, row) => total + (row.billing?.monthly_fee ?? 0), 0),
      overdueCount: overdue.length,
      paidCount: rows.filter((row) => row.status === 'paid').length,
      noPlan: rows.filter((row) => row.status === 'no_plan').length,
    }
  }, [rows])

  const filtered = rows.filter((row) => {
    if (filter === 'overdue') return row.status === 'overdue'
    if (filter === 'open') return row.status === 'pending' || row.status === 'due_today'
    if (filter === 'paid') return row.status === 'paid'
    if (filter === 'no_plan') return row.status === 'no_plan'
    return true
  })

  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: `Todos · ${rows.length}` },
    { value: 'overdue', label: `Atrasados · ${totals.overdueCount}` },
    { value: 'open', label: `A vencer · ${totals.openCount - totals.overdueCount}` },
    { value: 'paid', label: `Pagos · ${totals.paidCount}` },
    { value: 'no_plan', label: `Sem plano · ${totals.noPlan}` },
  ]

  const openPayment = (row: Row) => {
    setSheetKey((key) => key + 1)
    setPaying(row)
  }
  const openPlan = (row: Row) => {
    setSheetKey((key) => key + 1)
    setPlanning(row)
  }
  const closePayment = useCallback(() => setPaying(null), [])
  const closePlan = useCallback(() => setPlanning(null), [])

  const remind = async (row: Row) => {
    if (!row.billing || !finance) return
    setBusy(`remind-${row.student.id}`)
    try {
      await sendReminder(supabase, row.billing, month, finance.settings)
      toast({ tone: 'success', title: 'Lembrete enviado', description: `${row.student.full_name || 'O aluno'} vai ver no sino (e no celular, se ativou o push).` })
    } catch (error) {
      toast({ tone: 'error', title: 'Não foi possível lembrar', description: friendlyError(error) })
    } finally {
      setBusy(null)
    }
  }

  const undo = async () => {
    if (!undoing?.payment) return
    setBusy('undo')
    try {
      await deletePayment(supabase, undoing.payment.id)
      const id = undoing.payment.id
      setFinance((current) => (current ? { ...current, payments: current.payments.filter((payment) => payment.id !== id) } : current))
      toast({ tone: 'success', title: 'Pagamento desfeito' })
      setUndoing(null)
    } catch (error) {
      toast({ tone: 'error', title: 'Não foi possível desfazer', description: friendlyError(error) })
    } finally {
      setBusy(null)
    }
  }

  const label = monthTitle(month)
  const progress = totals.expected > 0 ? totals.received / totals.expected : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <Eyebrow>Gestão</Eyebrow>
          <h1 className="mt-1 font-display text-[2.75rem] font-bold uppercase leading-[0.9]">Financeiro</h1>
        </div>
        <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface p-1" role="group" aria-label="Mês">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            aria-label="Mês anterior"
            className="grid h-9 w-9 place-items-center rounded-xl text-zinc-300 hover:bg-white/5 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <AnimatePresence mode="wait" initial={false}>
            <m.span
              key={month}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="min-w-[8.5rem] text-center text-xs font-bold text-white"
              aria-live="polite"
            >
              {label}
            </m.span>
          </AnimatePresence>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            aria-label="Próximo mês"
            className="grid h-9 w-9 place-items-center rounded-xl text-zinc-300 hover:bg-white/5 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {loadError && (
        <Alert variant="error" onRetry={retry}>
          {loadError}
        </Alert>
      )}

      {missing ? (
        <Tile className="space-y-2 text-center">
          <Wallet className="mx-auto h-8 w-8 text-brand" aria-hidden="true" />
          <p className="text-sm font-bold text-white">Ative o financeiro</p>
          <p className="text-xs leading-relaxed text-zinc-400">
            Rode o arquivo <code className="rounded bg-white/10 px-1">supabase/gestao.sql</code> no SQL Editor do Supabase para controlar
            mensalidades, pagamentos e o PIX dos alunos.
          </p>
        </Tile>
      ) : !finance || !students ? (
        loadError ? null : (
          <div className="space-y-3" role="status" aria-label="Carregando financeiro">
            <Skeleton className="h-36 rounded-3xl" />
            <Skeleton className="h-24 rounded-3xl" />
            <Skeleton className="h-24 rounded-3xl" />
          </div>
        )
      ) : (
        <Stagger className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-4 lg:space-y-0">
          <div className="space-y-4">
            {/* Resumo do mês */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Tile className="col-span-2 flex items-center gap-4 p-4 lg:col-span-1">
                <ProgressRing value={progress} size={72} stroke={7} label={`${Math.round(progress * 100)}% do previsto recebido`}>
                  <span className="font-display text-lg font-bold">{Math.round(progress * 100)}%</span>
                </ProgressRing>
                <div className="min-w-0">
                  <Eyebrow icon={HandCoins}>Recebido</Eyebrow>
                  <p className={cn('mt-1 font-display text-3xl font-bold leading-none', totals.received > 0 ? 'text-brand' : 'text-white')}>
                    {formatBRL(totals.received)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">de {formatBRL(totals.expected)} previstos</p>
                </div>
              </Tile>
              <Tile className="p-4">
                <Eyebrow icon={CircleDollarSign}>A receber</Eyebrow>
                <p className="mt-2 font-display text-3xl font-bold leading-none">{formatBRL(totals.open)}</p>
                <p className="mt-1 text-xs text-zinc-400">{plural(totals.openCount, 'mensalidade', 'mensalidades')}</p>
              </Tile>
              <Tile className={cn('p-4', totals.overdueCount > 0 && 'border-danger/30')}>
                <Eyebrow className={totals.overdueCount > 0 ? 'text-danger' : undefined}>Em atraso</Eyebrow>
                <p className={cn('mt-2 font-display text-3xl font-bold leading-none', totals.overdueCount > 0 ? 'text-danger' : 'text-white')}>
                  {formatBRL(totals.overdue)}
                </p>
                <p className="mt-1 text-xs text-zinc-400">{plural(totals.overdueCount, 'aluno', 'alunos')}</p>
              </Tile>
            </div>

            <m.div variants={tileVariants} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Filtrar mensalidades">
              {filters.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={filter === option.value}
                  onClick={() => setFilter(option.value)}
                  className={cn(
                    'h-9 shrink-0 rounded-full border px-3.5 text-xs font-bold transition',
                    filter === option.value ? 'border-white bg-white text-black' : 'border-line bg-surface text-zinc-400 hover:text-white',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </m.div>

            {filtered.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-line-strong p-8 text-center text-sm text-zinc-400">
                {rows.length === 0 ? 'Nenhum aluno cadastrado ainda.' : 'Ninguém neste filtro.'}
              </p>
            ) : (
              <ul className="grid gap-2.5 xl:grid-cols-2" aria-label={`Mensalidades de ${label}`}>
                <AnimatePresence initial={false}>
                  {filtered.map((row) => {
                    const name = row.student.full_name || row.student.email || 'Aluno'
                    const open = OPEN_STATUSES.includes(row.status)
                    return (
                      <m.li key={row.student.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <article
                          aria-label={name}
                          className={cn('rounded-3xl border bg-surface p-4', row.status === 'overdue' ? 'border-danger/30' : 'border-line')}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar name={name} seed={row.student.id} src={avatarUrlOf(row.student)} size="md" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-white">{name}</p>
                              <p className="mt-1">
                                <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', STATUS_STYLE[row.status])}>{statusText(row, today)}</span>
                              </p>
                            </div>
                            <p className="shrink-0 text-right font-display text-xl font-bold tabular-nums text-white">
                              {row.payment ? formatBRL(row.payment.amount) : row.billing ? formatBRL(row.billing.monthly_fee) : '—'}
                            </p>
                          </div>
                          <div className="mt-3 flex gap-2">
                            {open && (
                              <m.button
                                type="button"
                                whileTap={{ scale: 0.96 }}
                                onClick={() => openPayment(row)}
                                className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand text-xs font-black uppercase tracking-wider text-black"
                              >
                                <HandCoins className="h-4 w-4" aria-hidden="true" /> Receber
                                <span className="sr-only"> de {name}</span>
                              </m.button>
                            )}
                            {open && (
                              <button
                                type="button"
                                onClick={() => void remind(row)}
                                disabled={busy !== null}
                                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line px-3 text-xs font-bold text-zinc-200 transition hover:text-white disabled:opacity-60"
                              >
                                {busy === `remind-${row.student.id}` ? (
                                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                                ) : (
                                  <BellRing className="h-4 w-4" aria-hidden="true" />
                                )}
                                Lembrar
                                <span className="sr-only"> {name}</span>
                              </button>
                            )}
                            {row.status === 'paid' && (
                              <button
                                type="button"
                                onClick={() => setUndoing(row)}
                                className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line text-xs font-bold text-zinc-300 transition hover:text-white"
                              >
                                <Undo2 className="h-4 w-4" aria-hidden="true" /> Desfazer
                                <span className="sr-only"> pagamento de {name}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openPlan(row)}
                              className={cn(
                                'flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition',
                                row.billing ? 'border border-line px-3 text-zinc-300 hover:text-white' : 'flex-1 bg-white text-black',
                              )}
                            >
                              <Settings2 className="h-4 w-4" aria-hidden="true" />
                              {row.billing ? 'Plano' : 'Definir plano'}
                              <span className="sr-only"> de {name}</span>
                            </button>
                          </div>
                        </article>
                      </m.li>
                    )
                  })}
                </AnimatePresence>
              </ul>
            )}
          </div>

          <div className="lg:sticky lg:top-24">
            <PixSettingsCard
              key={finance.settings?.pix_key ?? 'novo'}
              settings={finance.settings}
              onSaved={(settings) => setFinance((current) => (current ? { ...current, settings } : current))}
            />
          </div>
        </Stagger>
      )}

      {paying && (
        <PaymentSheet
          key={`pay-${sheetKey}`}
          open
          studentId={paying.student.id}
          studentName={paying.student.full_name || paying.student.email || 'Aluno'}
          month={month}
          suggested={paying.billing?.monthly_fee ?? null}
          onClose={closePayment}
          onSaved={(payment) => {
            setFinance((current) => (current ? { ...current, payments: [...current.payments, payment] } : current))
            setPaying(null)
            toast({ tone: 'success', title: 'Pagamento registrado', description: `${formatBRL(payment.amount)} · ${monthLabel(month)}` })
          }}
        />
      )}
      {planning && (
        <PlanSheet
          key={`plan-${sheetKey}`}
          open
          studentId={planning.student.id}
          studentName={planning.student.full_name || planning.student.email || 'Aluno'}
          current={planning.billing}
          onClose={closePlan}
          onSaved={(billing) => {
            setFinance((current) =>
              current ? { ...current, billing: [...current.billing.filter((item) => item.student_id !== billing.student_id), billing] } : current,
            )
            setPlanning(null)
            toast({ tone: 'success', title: 'Plano salvo', description: `${formatBRL(billing.monthly_fee)} todo dia ${billing.due_day}` })
          }}
        />
      )}
      <ConfirmDialog
        open={undoing !== null}
        title="Desfazer pagamento?"
        description={`O pagamento de ${monthLabel(month)} de ${undoing?.student.full_name ?? 'aluno'} volta a ficar em aberto.`}
        confirmLabel="Desfazer"
        busy={busy === 'undo'}
        onConfirm={() => void undo()}
        onClose={() => setUndoing(null)}
      />
    </div>
  )
}
