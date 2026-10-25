// Financeiro: mensalidade e vencimento de cada aluno, pagamentos do mês,
// lembretes e o "PIX copia e cola" (tabelas em supabase/gestao.sql).
import type { createClient } from './supabase/client'
import { notifyStudents } from './coach'
import { reminderMessage, todaySP, type Billing, type CoachSettings, type Payment } from './finance-core'
import { friendlyError } from './errors'

export * from './finance-core'

type Supabase = ReturnType<typeof createClient>
type DbError = { code?: string; message?: string } | null | undefined

export class FinanceError extends Error {
  readonly missing: boolean

  constructor(message: string, missing = false) {
    super(message)
    this.missing = missing
  }
}

export const FINANCE_SETUP_MESSAGE = 'Para usar o financeiro, rode o arquivo supabase/gestao.sql no Supabase.'

function isMissing(error: DbError) {
  if (!error) return false
  if (['PGRST205', 'PGRST204', '42P01'].includes(error.code ?? '')) return true
  return /schema cache|does not exist/i.test(error.message ?? '')
}

function fail(prefix: string, error: NonNullable<DbError>): never {
  const missing = isMissing(error)
  throw new FinanceError(missing ? FINANCE_SETUP_MESSAGE : friendlyError(error, prefix), missing)
}

const toNumber = (value: unknown) => Number(value) || 0

// --------------------------------------------------------------- consultas
export type FinanceData = { billing: Billing[]; payments: Payment[]; settings: CoachSettings | null }

function cleanBilling(row: Billing): Billing {
  return { ...row, monthly_fee: toNumber(row.monthly_fee), due_day: Number(row.due_day) || 10 }
}
function cleanPayment(row: Payment): Payment {
  return { ...row, amount: toNumber(row.amount) }
}

export async function loadFinance(supabase: Supabase, month: string): Promise<FinanceData> {
  const [billingResult, paymentsResult, settingsResult] = await Promise.all([
    supabase.from('student_billing').select('*'),
    supabase.from('payments').select('*').eq('reference_month', month),
    supabase.from('coach_settings').select('*').eq('id', 1).maybeSingle(),
  ])
  const error = billingResult.error ?? paymentsResult.error ?? settingsResult.error
  if (error) fail('Não foi possível carregar o financeiro', error)
  return {
    billing: ((billingResult.data ?? []) as Billing[]).map(cleanBilling),
    payments: ((paymentsResult.data ?? []) as Payment[]).map(cleanPayment),
    settings: (settingsResult.data as CoachSettings | null) ?? null,
  }
}

export async function saveBilling(supabase: Supabase, billing: Billing) {
  const { data, error } = await supabase
    .from('student_billing')
    .upsert(
      {
        student_id: billing.student_id,
        monthly_fee: billing.monthly_fee,
        due_day: billing.due_day,
        active: billing.active,
        starts_on: billing.starts_on,
        note: billing.note?.trim() || null,
      },
      { onConflict: 'student_id' },
    )
    .select('*')
    .single()
  if (error || !data) fail('Não foi possível salvar o plano', error ?? { message: 'sem resposta' })
  return cleanBilling(data as Billing)
}

export async function recordPayment(supabase: Supabase, payment: Omit<Payment, 'id'>) {
  const { data, error } = await supabase.from('payments').insert(payment).select('*').single()
  if (error?.code === '23505') throw new FinanceError('Este mês já está pago para o aluno.')
  if (error || !data) fail('Não foi possível registrar o pagamento', error ?? { message: 'sem resposta' })
  return cleanPayment(data as Payment)
}

export async function deletePayment(supabase: Supabase, paymentId: string) {
  const { data, error } = await supabase.from('payments').delete().eq('id', paymentId).select('id')
  if (error) fail('Não foi possível desfazer o pagamento', error)
  if (!data?.length) throw new FinanceError('O pagamento não foi encontrado.')
}

export async function saveSettings(supabase: Supabase, settings: Omit<CoachSettings, 'id'>) {
  const { data, error } = await supabase
    .from('coach_settings')
    .upsert({ id: 1, ...settings }, { onConflict: 'id' })
    .select('*')
    .single()
  if (error || !data) fail('Não foi possível salvar o PIX', error ?? { message: 'sem resposta' })
  return data as CoachSettings
}

export async function sendReminder(supabase: Supabase, billing: Billing, month: string, settings: CoachSettings | null) {
  const { title, message } = reminderMessage(billing, month, todaySP(), settings)
  await notifyStudents(supabase, [billing.student_id], title, message, 'billing')
}

// O que o aluno vê no Perfil: plano, pagamento do mês e o PIX do treinador.
export async function loadMyBilling(supabase: Supabase, userId: string, month: string) {
  const [billingResult, paymentResult, settingsResult] = await Promise.all([
    supabase.from('student_billing').select('*').eq('student_id', userId).maybeSingle(),
    supabase.from('payments').select('*').eq('student_id', userId).eq('reference_month', month).maybeSingle(),
    supabase.from('coach_settings').select('*').eq('id', 1).maybeSingle(),
  ])
  const error = billingResult.error ?? paymentResult.error ?? settingsResult.error
  if (error) fail('Não foi possível carregar a mensalidade', error)
  return {
    billing: billingResult.data ? cleanBilling(billingResult.data as Billing) : null,
    payment: paymentResult.data ? cleanPayment(paymentResult.data as Payment) : null,
    settings: (settingsResult.data as CoachSettings | null) ?? null,
  }
}
