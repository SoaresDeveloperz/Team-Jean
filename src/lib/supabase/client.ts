import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseEnv } from './env'

// Cliente do navegador. O @supabase/ssr guarda a sessão em cookies (e não no
// localStorage), então o proxy e os Server Components enxergam o mesmo login.
// No navegador ele já é um singleton: chamar createClient() várias vezes
// devolve sempre a mesma instância.
export function createClient() {
  const { url, anonKey } = getSupabaseEnv()
  return createBrowserClient(url, anonKey)
}
