'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    // Em desenvolvimento o cache do service worker serviria código antigo.
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sem service worker o app continua funcionando, só não tem tela offline.
    })
  }, [])

  return null
}
