'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { FinanceError, OPEN_STATUSES, dueDate, formatBRL, loadFinance, monthOf, monthTitle, shortDay, statusFor, todaySP, type FinanceData } from '@/lib/finance'
import { plural } from '@/lib/text'
import { cn } from '@/lib/cn'
import { BarFill } from '@/components/ui/bar-fill'
import { Skeleton } from '@/components/ui/skeleton'
import { Eyebrow, Tile } from '@/components/ui/tile'

// Resumo do mês no painel: recebido x previsto e quem está atrasado.
export function FinanceSummaryTile({ students }: { students: Profile[] }) {
  const [supabase] = useState(() => createClient())
  const [today] = useState(() => todaySP())
  const month = monthOf(today)
  const [data, setData] = useState<FinanceData | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let active = true
    loadFinance(supabase, month)
      .then((value) => {
        if (active) setData(value)
      })
      .catch((error) => {
        if (active) setMissing(error instanceof FinanceError && error.missing)
      })
    return () => {
      active = false
    }
  }, [supabase, month])

  const summary = useMemo(() => {
    if (!data) return null
    const billing = new Map(data.billing.map((item) => [item.student_id, item]))
    const payments = new Map(data.payments.map((item) => [item.student_id, item]))
    let received = 0
    let expected = 0
    let nextDue: string | null = null
    const overdue: Profile[] = []
    for (const student of students) {
      const plan = billing.get(student.id)
      const payment = payments.get(student.id)
      const status = statusFor(plan, payment, month, today)
      if (payment) {
        received += payment.amount
        expected += payment.amount
      } else if (plan && OPEN_STATUSES.includes(status)) {
        expected += plan.monthly_fee
        const due = dueDate(plan.due_day, month)
        if (due >= today && (!nextDue || due < nextDue)) nextDue = due
      }
      if (status === 'overdue') overdue.push(student)
    }
    return { received, expected, overdue, nextDue, plans: data.billing.length }
  }, [data, students, month, today])

  return (
    <Tile className="p-0">
      <Link href="/admin/finance" className="block p-5">
        <div className="flex items-center justify-between gap-2">
          <h2>
            <Eyebrow icon={Wallet}>Financeiro</Eyebrow>
          </h2>
          <span className="flex items-center gap-1 text-xs font-bold text-zinc-400">
            {monthTitle(month)} <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
        {missing ? (
          <p className="mt-3 text-xs leading-relaxed text-zinc-400">Ative mensalidades e PIX rodando o supabase/gestao.sql.</p>
        ) : !summary ? (
          <Skeleton className="mt-3 h-14 rounded-2xl" />
        ) : summary.plans === 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-zinc-400">Cadastre a mensalidade dos alunos para acompanhar quem pagou.</p>
        ) : (
          <>
            {/* Verde só quando entrou dinheiro: R$ 0,00 fica neutro. */}
            <p className={cn('mt-3 font-display text-4xl font-bold leading-none', summary.received > 0 ? 'text-brand' : 'text-white')}>
              {formatBRL(summary.received)}
            </p>
            <p className="mt-1 text-xs text-zinc-400">recebidos de {formatBRL(summary.expected)} previstos</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
              <BarFill value={summary.expected > 0 ? summary.received / summary.expected : 0} delay={200} className="bg-brand" />
            </div>
            <p className={summary.overdue.length > 0 ? 'mt-3 text-xs font-bold text-danger' : 'mt-3 text-xs text-zinc-400'}>
              {summary.overdue.length > 0
                ? `${plural(summary.overdue.length, 'aluno', 'alunos')} em atraso: ${summary.overdue
                    .slice(0, 3)
                    .map((student) => student.full_name?.split(' ')[0] || 'Aluno')
                    .join(', ')}${summary.overdue.length > 3 ? '…' : ''}`
                : 'Ninguém em atraso.'}
            </p>
            {summary.overdue.length === 0 && summary.nextDue && (
              <p className="mt-1 text-xs text-zinc-500">Próximo vencimento: {shortDay(summary.nextDue)}</p>
            )}
          </>
        )}
      </Link>
    </Tile>
  )
}
