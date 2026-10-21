import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { flushPendingPush } from '@/lib/push/server'
import { OPEN_STATUSES, daysBetween, dueDate, monthOf, reminderMessage, statusFor, todaySP, type Billing, type CoachSettings, type Payment } from '@/lib/finance-core'

// Cron diário da Vercel (vercel.json): com o lembrete automático ligado,
// avisa a mensalidade 3 dias antes, no dia e 3 dias depois do vencimento; e
// entrega por push o que tiver ficado pendente. Protegido pelo CRON_SECRET (a
// Vercel manda "Authorization: Bearer <CRON_SECRET>").
const REMINDER_OFFSETS = [-3, 0, 3]

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada' }, { status: 500 })
  }

  const today = todaySP()
  const month = monthOf(today)
  let reminders = 0
  const { data: settings } = await admin.from('coach_settings').select('*').eq('id', 1).maybeSingle()

  if ((settings as CoachSettings | null)?.billing_reminders) {
    const [billingResult, paymentsResult] = await Promise.all([
      admin.from('student_billing').select('*').eq('active', true),
      admin.from('payments').select('*').eq('reference_month', month),
    ])
    const paid = new Map(((paymentsResult.data ?? []) as Payment[]).map((payment) => [payment.student_id, payment]))
    for (const row of (billingResult.data ?? []) as Billing[]) {
      const billing = { ...row, monthly_fee: Number(row.monthly_fee) || 0, due_day: Number(row.due_day) || 10 }
      if (billing.last_reminder_on === today) continue
      if (!OPEN_STATUSES.includes(statusFor(billing, paid.get(billing.student_id), month, today))) continue
      if (!REMINDER_OFFSETS.includes(daysBetween(dueDate(billing.due_day, month), today))) continue

      const { title, message } = reminderMessage(billing, month, today, settings as CoachSettings)
      let { error } = await admin.from('notifications').insert({ recipient_id: billing.student_id, type: 'billing', title, message })
      // Restrição antiga em notifications.type: vai como aviso comum.
      if (error?.code === '23514') ({ error } = await admin.from('notifications').insert({ recipient_id: billing.student_id, type: 'announcement', title, message }))
      if (error) continue
      await admin.from('student_billing').update({ last_reminder_on: today }).eq('student_id', billing.student_id)
      reminders += 1
    }
  }

  const { sent } = await flushPendingPush()
  return NextResponse.json({ ok: true, today, reminders, pushed: sent })
}
