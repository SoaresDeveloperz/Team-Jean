import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseEnv } from './env'

// Cliente para Server Components, Server Actions e Route Handlers.
// Usa a sessão do usuário logado (cookies), então continua sujeito ao RLS.
export async function createClient() {
  const { url, anonKey } = getSupabaseEnv()
  const cookieStore = await cookies()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Components não podem gravar cookies. Sem problema: o proxy
          // já renova a sessão a cada requisição.
        }
      },
    },
  })
}
