'use server'

import { getSession } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { flushPendingPush, isAllowedEndpoint, pushConfig, pushToUser } from './server'

export type PushActionResult = { ok: boolean; message: string; missing?: boolean }

type SubscriptionInput = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/
const MAX_DEVICES = 10

function saveFailure(error: { code?: string; message: string }): PushActionResult {
  const missing = ['PGRST205', '42P01'].includes(error.code ?? '') || /schema cache|does not exist/i.test(error.message)
  return {
    ok: false,
    missing,
    message: missing ? 'Para usar as notificações, rode o arquivo supabase/gestao.sql no Supabase.' : `Não foi possível salvar o aparelho: ${error.message}`,
  }
}

// Chave pública VAPID (o aparelho precisa dela para se inscrever).
export async function getPushPublicKey() {
  const session = await getSession()
  if (!session) return null
  return pushConfig()?.publicKey ?? null
}

// Guarda o aparelho para o usuário logado. Gravado com a service_role: um
// mesmo navegador usado por outra pessoa antes passa a ser deste usuário.
export async function savePushSubscription(input: SubscriptionInput, userAgent?: string): Promise<PushActionResult> {
  const session = await getSession()
  if (!session) return { ok: false, message: 'Entre de novo no app para ativar as notificações.' }
  if (!pushConfig()) return { ok: false, message: 'As notificações push ainda não foram configuradas no servidor.' }

  const endpoint = typeof input.endpoint === 'string' ? input.endpoint : ''
  const p256dh = typeof input.keys?.p256dh === 'string' ? input.keys.p256dh : ''
  const auth = typeof input.keys?.auth === 'string' ? input.keys.auth : ''
  if (!isAllowedEndpoint(endpoint) || endpoint.length > 1000) return { ok: false, message: 'Este navegador usa um serviço de push desconhecido.' }
  if (!BASE64URL.test(p256dh) || p256dh.length < 20 || p256dh.length > 200 || !BASE64URL.test(auth) || auth.length < 8 || auth.length > 100) {
    return { ok: false, message: 'Inscrição de push inválida.' }
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, message: 'Configure a variável SUPABASE_SERVICE_ROLE_KEY no servidor (Vercel).' }
  }
  // No máximo MAX_DEVICES aparelhos por pessoa. Reenviar um aparelho que já
  // é dela (mesmo endpoint) continua valendo.
  const devices = await admin.from('push_subscriptions').select('endpoint').eq('user_id', session.userId)
  if (devices.error) return saveFailure(devices.error)
  const mine = (devices.data ?? []) as { endpoint: string }[]
  if (mine.length >= MAX_DEVICES && !mine.some((row) => row.endpoint === endpoint)) {
    return {
      ok: false,
      message: `Você já tem ${MAX_DEVICES} aparelhos com notificações. Desative em um aparelho que você não usa mais e tente de novo.`,
    }
  }

  const { error } = await admin
    .from('push_subscriptions')
    .upsert(
      { endpoint, p256dh, auth, user_id: session.userId, user_agent: userAgent ? userAgent.slice(0, 300) : null },
      { onConflict: 'endpoint' },
    )
  if (error) return saveFailure(error)
  return { ok: true, message: 'Notificações ativadas neste aparelho.' }
}

export async function removePushSubscription(endpoint: string): Promise<PushActionResult> {
  const session = await getSession()
  if (!session) return { ok: false, message: 'Sessão expirada.' }
  try {
    await createAdminClient().from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', session.userId)
  } catch {
    // Sem service_role não há o que apagar no servidor.
  }
  return { ok: true, message: 'Notificações desativadas neste aparelho.' }
}

export async function sendTestPush(): Promise<PushActionResult> {
  const session = await getSession()
  if (!session) return { ok: false, message: 'Sessão expirada.' }
  const { sent } = await pushToUser(session.userId, {
    title: 'Notificações ativadas ✅',
    body: 'É assim que os recados do Team Jean vão chegar no seu celular.',
    url: session.isAdmin ? '/admin' : '/student/today',
    tag: 'teste',
  })
  return sent > 0
    ? { ok: true, message: 'Notificação de teste enviada.' }
    : { ok: false, message: 'Nenhum aparelho recebeu. Desative e ative de novo as notificações.' }
}

// Entrega por push os avisos que acabaram de ser criados. Qualquer usuário
// logado pode pedir: só sai o que já estava na fila para cada destinatário.
export async function deliverPendingPush() {
  const session = await getSession()
  if (!session) return 0
  const { sent } = await flushPendingPush()
  return sent
}
