import 'server-only'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

// Envio das notificações push (Web Push com chaves VAPID). Os aparelhos ficam
// em push_subscriptions e os avisos em notifications (supabase/gestao.sql):
// cada aviso novo é "reservado" uma única vez (pushed_at) e entregue em todos
// os aparelhos do destinatário.

export type PushMessage = { title: string; body: string; url: string; tag?: string }
type Subscription = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }

// Avisos mais velhos que isso não viram push (ex.: push ativado depois).
const MAX_AGE_MS = 2 * 86_400_000

export function pushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT || 'mailto:contato@teamjean.app' }
}

// Só os serviços de push dos navegadores (evita o servidor fazer requisições
// para endereços quaisquer cadastrados por alguém).
const PUSH_HOSTS = [/(^|\.)googleapis\.com$/, /(^|\.)mozilla\.com$/, /(^|\.)mozaws\.net$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/]

export function isAllowedEndpoint(endpoint: string) {
  const testPrefix = process.env.PUSH_TEST_ENDPOINT_PREFIX
  if (testPrefix && endpoint.startsWith(testPrefix)) return true
  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:' && PUSH_HOSTS.some((pattern) => pattern.test(url.hostname))
  } catch {
    return false
  }
}

type Delivery = 'ok' | 'gone' | 'failed'

async function deliver(subscription: Subscription, message: PushMessage, config: NonNullable<ReturnType<typeof pushConfig>>): Promise<Delivery> {
  if (!isAllowedEndpoint(subscription.endpoint)) return 'gone'
  let details: ReturnType<typeof webpush.generateRequestDetails>
  try {
    details = webpush.generateRequestDetails(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(message),
      { vapidDetails: config, TTL: 86_400, urgency: 'normal' },
    )
  } catch {
    // Chaves do aparelho inválidas: não adianta tentar de novo.
    return 'gone'
  }
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(details.headers)) {
    if (key.toLowerCase() !== 'content-length') headers[key] = String(value)
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetch(details.endpoint, {
      method: 'POST',
      headers,
      body: details.body ? new Uint8Array(details.body) : undefined,
      signal: controller.signal,
    })
    // 404/410: o aparelho cancelou a inscrição.
    if (response.status === 404 || response.status === 410) return 'gone'
    return response.ok ? 'ok' : 'failed'
  } catch {
    return 'failed'
  } finally {
    clearTimeout(timer)
  }
}

function admin() {
  try {
    return createAdminClient()
  } catch {
    return null
  }
}

type Job = { subscription: Subscription; message: PushMessage }

// Envia em paralelo (no máximo 8 de cada vez) e apaga os aparelhos que saíram.
async function sendJobs(jobs: Job[]) {
  const config = pushConfig()
  const client = admin()
  if (!config || !client || jobs.length === 0) return { sent: 0, failed: 0 }
  const results: { job: Job; result: Delivery }[] = []
  let next = 0
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++]
      results.push({ job, result: await deliver(job.subscription, job.message, config) })
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, jobs.length) }, worker))
  const gone = [...new Set(results.filter((item) => item.result === 'gone').map((item) => item.job.subscription.id))]
  if (gone.length > 0) await client.from('push_subscriptions').delete().in('id', gone)
  return {
    sent: results.filter((item) => item.result === 'ok').length,
    failed: results.filter((item) => item.result !== 'ok').length,
  }
}

function urlFor(type: string, isCoach: boolean) {
  if (isCoach) return type === 'feedback' ? '/admin?radar=recados' : '/admin'
  if (type === 'community') return '/student/community'
  if (type === 'billing') return '/student/profile?mensalidade=1'
  return '/student/today?avisos=1'
}

const shorten = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

// O push aparece na tela bloqueada, onde outra pessoa pode ler: o que vai
// para o treinador (recados e saúde dos alunos, inclusive em bancos antigos
// que gravavam esses avisos como 'announcement'), os avisos de saúde, de
// recado e de mensalidade (valor e vencimento) saem com texto genérico (LGPD).
// O texto completo fica no sino do app.
const PRIVATE_TYPES = new Set(['health', 'feedback', 'billing'])
const GENERIC_PUSH = {
  title: 'Team Jean',
  feedback: 'Você tem um recado novo de um aluno. Abra o app para ver.',
  health: 'Você tem um aviso novo sobre um aluno. Abra o app para ver.',
  // Aviso de outro tipo (do treinador, cobrança, comunidade) quando não dá para
  // mostrar o texto completo: não afirma que é recado de aluno.
  other: 'Você tem um aviso novo no Team Jean. Abra o app para ver.',
}

function pushText(notification: { type: string; title: string; message: string }, generic: boolean) {
  if (generic || PRIVATE_TYPES.has(notification.type)) {
    const body =
      notification.type === 'health' ? GENERIC_PUSH.health : notification.type === 'feedback' ? GENERIC_PUSH.feedback : GENERIC_PUSH.other
    return { title: GENERIC_PUSH.title, body }
  }
  return { title: shorten(notification.title || 'Team Jean', 80), body: shorten(notification.message || '', 240) }
}

// Entrega por push os avisos novos (chamado depois de criar avisos e pelo cron).
export async function flushPendingPush() {
  const config = pushConfig()
  const client = admin()
  if (!config || !client) return { sent: 0, failed: 0 }

  const since = new Date(Date.now() - MAX_AGE_MS).toISOString()
  // Reserva os avisos pendentes (o update só pega quem ainda não foi enviado,
  // então duas chamadas ao mesmo tempo não mandam o mesmo aviso duas vezes).
  const claimed = await client
    .from('notifications')
    .update({ pushed_at: new Date().toISOString() })
    .is('pushed_at', null)
    .gte('created_at', since)
    .select('id, recipient_id, type, title, message')
  if (claimed.error || !claimed.data || claimed.data.length === 0) return { sent: 0, failed: 0 }

  const notifications = claimed.data as { id: string; recipient_id: string; type: string; title: string; message: string }[]
  const recipients = [...new Set(notifications.map((item) => item.recipient_id))]
  const [subscriptionsResult, rolesResult] = await Promise.all([
    client.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').in('user_id', recipients),
    client.from('profiles').select('id, role').in('id', recipients),
  ])
  const subscriptions = (subscriptionsResult.data ?? []) as Subscription[]
  if (subscriptions.length === 0) return { sent: 0, failed: 0 }
  const coaches = new Set(
    ((rolesResult.data ?? []) as { id: string; role: string | null }[])
      .filter((row) => String(row.role ?? '').trim().toLowerCase() === 'admin')
      .map((row) => row.id),
  )
  // Sem saber quem é o treinador, ninguém recebe o texto completo no push.
  const rolesUnknown = Boolean(rolesResult.error)

  return sendJobs(
    notifications.flatMap((notification) =>
      subscriptions
        .filter((subscription) => subscription.user_id === notification.recipient_id)
        .map((subscription) => ({
          subscription,
          message: {
            ...pushText(notification, rolesUnknown || coaches.has(notification.recipient_id)),
            url: urlFor(notification.type, coaches.has(notification.recipient_id)),
            tag: notification.id,
          },
        })),
    ),
  )
}

// Push direto para um usuário (teste do aparelho).
export async function pushToUser(userId: string, message: PushMessage) {
  const client = admin()
  if (!client) return { sent: 0, failed: 0 }
  const { data } = await client.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').eq('user_id', userId)
  return sendJobs(((data ?? []) as Subscription[]).map((subscription) => ({ subscription, message })))
}
