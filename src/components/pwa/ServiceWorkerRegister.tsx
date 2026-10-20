'use client'

import { useEffect } from 'react'
import { captureInstallPrompt } from '@/lib/install-prompt'

export function ServiceWorkerRegister() {
  // O pedido de instalação do PWA chega uma vez só, no carregamento.
  useEffect(() => captureInstallPrompt(), [])

  useEffect(() => {
    // Em desenvolvimento o cache do service worker serviria código antigo.
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sem service worker o app continua funcionando, só não tem tela offline.
    })
  }, [])

  return null
}
