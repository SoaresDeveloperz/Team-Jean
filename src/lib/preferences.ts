'use client'

import { useSyncExternalStore } from 'react'

// Preferências guardadas só no aparelho (não existem colunas para elas no banco).
export type Preferences = {
  weeklyGoal: number
  restSeconds: number
  haptics: boolean
}

export const DEFAULT_PREFERENCES: Preferences = { weeklyGoal: 3, restSeconds: 90, haptics: true }

const STORAGE_KEY = 'team-jean:preferences'
const listeners = new Set<() => void>()
let cachedRaw: string | null | undefined
let cachedValue: Preferences = DEFAULT_PREFERENCES

function readRaw() {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function getPreferences(): Preferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES
  const raw = readRaw()
  if (raw !== cachedRaw) {
    cachedRaw = raw
    try {
      cachedValue = { ...DEFAULT_PREFERENCES, ...(raw ? (JSON.parse(raw) as Partial<Preferences>) : {}) }
    } catch {
      cachedValue = DEFAULT_PREFERENCES
    }
  }
  return cachedValue
}

export function setPreferences(patch: Partial<Preferences>) {
  const next = { ...getPreferences(), ...patch }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Sem armazenamento local: a mudança vale só até recarregar.
    cachedRaw = JSON.stringify(next)
    cachedValue = next
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function usePreferences() {
  return useSyncExternalStore(subscribe, getPreferences, () => DEFAULT_PREFERENCES)
}
