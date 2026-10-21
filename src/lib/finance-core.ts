// Regras do financeiro sem Supabase (datas de vencimento, status, valores e o
// PIX copia e cola). Usado pelas telas e pelo cron de lembretes.

export type Billing = {
  student_id: string
  monthly_fee: number
  due_day: number
  active: boolean
  starts_on: string
  last_reminder_on?: string | null
  note?: string | null
}

export type PaymentMethod = 'pix' | 'dinheiro' | 'cartao' | 'transferencia' | 'outro'

export type Payment = {
  id: string
  student_id: string
  reference_month: string
  amount: number
  paid_on: string
  method: PaymentMethod
  note?: string | null
}

export type CoachSettings = {
  id: number
  pix_key: string | null
  pix_name: string | null
  pix_city: string | null
  billing_reminders: boolean
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'outro', label: 'Outro' },
]

export const methodLabel = (method: string) => PAYMENT_METHODS.find((item) => item.value === method)?.label ?? 'Outro'

// ------------------------------------------------------------------ datas
// "2026-10-21" no fuso de Brasília (vencimentos são em dias de Brasília).
export function todaySP(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export const monthOf = (day: string) => `${day.slice(0, 7)}-01`

export function addMonths(month: string, count: number) {
  const [year, value] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, value - 1 + count, 1))
  return date.toISOString().slice(0, 10)
}

export function monthLabel(month: string) {
  const [year, value] = month.split('-').map(Number)
  return new Date(Date.UTC(year, value - 1, 15)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

// "Outubro de 2026" (para títulos; no meio da frase vale o monthLabel).
export function monthTitle(month: string) {
  const label = monthLabel(month)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// Vencimento no mês (dia 31 em fevereiro vira o último dia do mês).
export function dueDate(dueDay: number, month: string) {
  const [year, value] = month.split('-').map(Number)
  const last = new Date(Date.UTC(year, value, 0)).getUTCDate()
  return `${month.slice(0, 8)}${String(Math.min(dueDay, last)).padStart(2, '0')}`
}

const DAY = 86_400_000
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY)
}

export const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`

export type BillingStatus = 'paid' | 'pending' | 'due_today' | 'overdue' | 'not_started' | 'paused' | 'no_plan'

export function statusFor(billing: Billing | undefined, payment: Payment | undefined, month: string, today: string): BillingStatus {
  if (payment) return 'paid'
  if (!billing) return 'no_plan'
  if (!billing.active) return 'paused'
  if (monthOf(billing.starts_on) > month) return 'not_started'
  const due = dueDate(billing.due_day, month)
  if (today < due) return 'pending'
  if (today === due) return 'due_today'
  return 'overdue'
}

export const OPEN_STATUSES: BillingStatus[] = ['pending', 'due_today', 'overdue']

export function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

// "150", "150,50" ou "R$ 1.200,00" → número (NaN se inválido).
export function parseMoney(text: string) {
  const clean = text.replace(/[R$\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  if (!clean) return Number.NaN
  const value = Number(clean)
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : Number.NaN
}

// ------------------------------------------------------------------- PIX
// BR Code estático do PIX (padrão EMV do Banco Central) com o CRC16-CCITT.
export type PixKeyType = 'cpf' | 'cnpj' | 'phone' | 'email' | 'random'

export const PIX_KEY_TYPES: { value: PixKeyType; label: string; placeholder: string }[] = [
  { value: 'cpf', label: 'CPF', placeholder: '000.000.000-00' },
  { value: 'cnpj', label: 'CNPJ', placeholder: '00.000.000/0000-00' },
  { value: 'phone', label: 'Celular', placeholder: '(11) 91234-5678' },
  { value: 'email', label: 'E-mail', placeholder: 'voce@email.com' },
  { value: 'random', label: 'Aleatória', placeholder: '123e4567-e89b-12d3-a456-426614174000' },
]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Formato que o PIX espera para cada tipo de chave (null = inválida).
export function normalizePixKey(type: PixKeyType, raw: string) {
  const text = raw.trim()
  const digits = text.replace(/\D/g, '')
  if (type === 'cpf') return digits.length === 11 ? digits : null
  if (type === 'cnpj') return digits.length === 14 ? digits : null
  if (type === 'phone') {
    const national = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits
    return national.length === 10 || national.length === 11 ? `+55${national}` : null
  }
  if (type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) && text.length <= 77 ? text.toLowerCase() : null
  return UUID.test(text) ? text.toLowerCase() : null
}

// Adivinha o tipo de uma chave já salva (para preencher o formulário).
export function guessPixKeyType(key: string | null | undefined): PixKeyType {
  if (!key) return 'cpf'
  if (key.includes('@')) return 'email'
  if (key.startsWith('+')) return 'phone'
  if (UUID.test(key)) return 'random'
  return key.replace(/\D/g, '').length === 14 ? 'cnpj' : 'cpf'
}

// Nome e cidade no PIX: sem acentos e só letras, números e espaços.
export function pixText(text: string, max: number) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function tlv(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`
}

export function crc16(text: string) {
  let crc = 0xffff
  for (let index = 0; index < text.length; index += 1) {
    crc ^= text.charCodeAt(index) << 8
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export type PixInput = { key: string; name: string; city: string; amount?: number | null; txid?: string; description?: string }

export function pixPayload({ key, name, city, amount, txid, description }: PixInput) {
  const merchant = [tlv('00', 'br.gov.bcb.pix'), tlv('01', key)]
  const info = description ? pixText(description, 40) : ''
  // O campo 26 tem no máximo 99 caracteres: a descrição sai se não couber.
  if (info && merchant.join('').length + info.length + 4 <= 99) merchant.push(tlv('02', info))
  const reference = (txid ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'
  const body = [
    tlv('00', '01'),
    tlv('26', merchant.join('')),
    tlv('52', '0000'),
    tlv('53', '986'),
    amount && amount > 0 ? tlv('54', amount.toFixed(2)) : '',
    tlv('58', 'BR'),
    tlv('59', pixText(name, 25) || 'Team Jean'),
    tlv('60', pixText(city, 15) || 'Brasil'),
    tlv('62', tlv('05', reference)),
    '6304',
  ].join('')
  return body + crc16(body)
}

// Identificador do pagamento no extrato: TJ + mês + começo do id do aluno.
export const pixTxid = (studentId: string, month: string) => `TJ${month.slice(0, 7).replace('-', '')}${studentId.replace(/[^A-Za-z0-9]/g, '').slice(0, 10)}`

export function reminderMessage(billing: Billing, month: string, today: string, settings: CoachSettings | null) {
  const due = dueDate(billing.due_day, month)
  const late = daysBetween(due, today)
  const when = late > 0 ? `venceu dia ${shortDay(due)}` : late === 0 ? 'vence hoje' : `vence dia ${shortDay(due)}`
  const pix = settings?.pix_key ? ' Toque para copiar o PIX no seu Perfil.' : ''
  return {
    title: late > 0 ? 'Mensalidade em aberto 💳' : 'Lembrete da mensalidade 💳',
    message: `Sua mensalidade de ${monthLabel(month)} (${formatBRL(billing.monthly_fee)}) ${when}.${pix}`,
  }
}
