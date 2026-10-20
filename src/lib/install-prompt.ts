'use client'

import { useSyncExternalStore } from 'react'

// Evento do Chrome/Android para instalar o PWA. Ele dispara uma vez, logo no
// carregamento, então é capturado na raiz do app e guardado aqui.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

export function captureInstallPrompt() {
  const onPrompt = (event: Event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    notify()
  }
  const onInstalled = () => {
    deferredPrompt = null
    notify()
  }
  window.addEventListener('beforeinstallprompt', onPrompt)
  window.addEventListener('appinstalled', onInstalled)
  return () => {
    window.removeEventListener('beforeinstallprompt', onPrompt)
    window.removeEventListener('appinstalled', onInstalled)
  }
}

export async function promptInstall() {
  if (!deferredPrompt) return false
  await deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  notify()
  return outcome === 'accepted'
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export type InstallState = 'installed' | 'available' | 'ios' | 'unsupported'

function getState(): InstallState {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (standalone) return 'installed'
  if (deferredPrompt) return 'available'
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return 'ios'
  return 'unsupported'
}

export function useInstallState() {
  return useSyncExternalStore(subscribe, getState, () => 'unsupported' as InstallState)
}
