'use client'

import { deliverPendingPush, getPushPublicKey, removePushSubscription, savePushSubscription, sendTestPush } from './actions'

// Notificações push no aparelho: inscrição (Push API + service worker) e o
// pedido de entrega dos avisos recém-criados.

export type PushStatus = 'loading' | 'dev' | 'unsupported' | 'ios-install' | 'unconfigured' | 'denied' | 'off' | 'on'

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(padded)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

function sameKey(current: ArrayBuffer | null | undefined, key: string) {
  if (!current) return false
  const expected = urlBase64ToUint8Array(key)
  const actual = new Uint8Array(current)
  return actual.length === expected.length && actual.every((byte, index) => byte === expected[index])
}

async function getRegistration() {
  return (await navigator.serviceWorker.getRegistration()) ?? navigator.serviceWorker.register('/sw.js')
}

export async function readPushStatus(): Promise<PushStatus> {
  // Em desenvolvimento o service worker não é registrado (serviria código antigo).
  if (process.env.NODE_ENV !== 'production') return 'dev'
  if (isIos() && !isStandalone()) return 'ios-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  const key = await getPushPublicKey().catch(() => null)
  if (!key) return 'unconfigured'
  if (Notification.permission === 'denied') return 'denied'
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  return subscription && Notification.permission === 'granted' ? 'on' : 'off'
}

export async function enablePush(): Promise<{ status: PushStatus; message: string }> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return permission === 'denied'
      ? { status: 'denied', message: 'As notificações foram bloqueadas neste navegador.' }
      : { status: 'off', message: 'Permissão não concedida.' }
  }
  const key = await getPushPublicKey()
  if (!key) return { status: 'unconfigured', message: 'As notificações push ainda não foram configuradas.' }

  const registration = await getRegistration()
  await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  // A chave do servidor mudou: refaz a inscrição.
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe().catch(() => false)
    subscription = null
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) })

  const result = await savePushSubscription(subscription.toJSON(), navigator.userAgent)
  if (!result.ok) {
    await subscription.unsubscribe().catch(() => false)
    return { status: 'off', message: result.message }
  }
  return { status: 'on', message: result.message }
}

// Tira este aparelho do servidor (só funciona com a sessão valendo) e cancela
// a inscrição no navegador, mesmo se o servidor falhar: o aparelho cancelado
// responde 410 no próximo envio e o servidor o apaga.
async function removeThisDevice() {
  const registration = await navigator.serviceWorker?.getRegistration()
  const subscription = await registration?.pushManager?.getSubscription()
  if (!subscription) return
  try {
    await removePushSubscription(subscription.endpoint)
  } finally {
    await subscription.unsubscribe().catch(() => false)
  }
}

export async function disablePush(): Promise<PushStatus> {
  await removeThisDevice()
  return 'off'
}

// Ao sair da conta: cancela o push deste aparelho ANTES do signOut, enquanto
// a sessão ainda vale. Nunca trava a saída: sem push, erro ou demora, segue.
export async function cancelPushOnLogout(timeoutMs = 3000) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs)
  })
  try {
    await Promise.race([removeThisDevice().catch(() => undefined), timeout])
  } finally {
    clearTimeout(timer)
  }
}

export { sendTestPush }

// Pede ao servidor para entregar por push os avisos que acabaram de ser
// criados. Não bloqueia a tela; chamadas seguidas viram uma só.
let inflight = false
let again = false
export function requestPushDelivery() {
  if (inflight) {
    again = true
    return
  }
  inflight = true
  void deliverPendingPush()
    .catch(() => 0)
    .finally(() => {
      inflight = false
      if (again) {
        again = false
        requestPushDelivery()
      }
    })
}
