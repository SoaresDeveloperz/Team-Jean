'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import type { AppNotification } from '@/lib/types'

// Avisos do treinador compartilhados entre o sino do topo e a tela Hoje.
// "Lido" fica no aparelho: a tabela notifications não tem coluna para isso.

type Snapshot = {
  loaded: boolean
  userId: string | null
  items: AppNotification[]
  seen: ReadonlySet<string>
}

const SEEN_KEY = 'team-jean:seen-notifications'
const OPEN_EVENT = 'team-jean:open-notifications'
const EMPTY: Snapshot = { loaded: false, userId: null, items: [], seen: new Set() }

let snapshot: Snapshot = EMPTY
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch }
  listeners.forEach((listener) => listener())
}

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export function loadNotifications(force = false) {
  if (inflight) return inflight

  inflight = (async () => {
    const supabase = createClient()
    const user = await getCurrentUser(supabase)
    if (!user) {
      emit({ ...EMPTY, loaded: true })
      return
    }
    if (!force && snapshot.loaded && snapshot.userId === user.id) return

    const { data } = await supabase.from('notifications').select('*').eq('recipient_id', user.id)
    const rows = (data ?? []) as AppNotification[]
    // Mais recentes primeiro; sem coluna de data, a ordem de inserção invertida.
    const items = rows.some((row) => row.created_at)
      ? [...rows].sort((first, second) => String(second.created_at ?? '').localeCompare(String(first.created_at ?? '')))
      : [...rows].reverse()

    emit({ loaded: true, userId: user.id, items, seen: readSeen() })
  })().finally(() => {
    inflight = null
  })

  return inflight
}

export function markNotificationsSeen(ids: string[]) {
  if (ids.length === 0) return
  const seen = new Set([...snapshot.seen, ...ids])
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-300)))
  } catch {
    // Sem armazenamento: o aviso volta a aparecer como novo depois.
  }
  emit({ seen })
}

// Limpa o cache ao sair da conta (outro usuário pode entrar no mesmo aparelho).
export function resetNotifications() {
  snapshot = EMPTY
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useNotifications() {
  const state = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  )

  useEffect(() => {
    void loadNotifications()
  }, [])

  const unseen = state.items.filter((item) => !state.seen.has(item.id))
  return { ...state, unseen }
}

export function openNotifications() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

export function onOpenNotifications(handler: () => void) {
  window.addEventListener(OPEN_EVENT, handler)
  return () => window.removeEventListener(OPEN_EVENT, handler)
}
