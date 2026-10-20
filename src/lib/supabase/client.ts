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

// Nas telas basta a sessão local para saber quem está logado (sem ida ao
// servidor de auth): o token é validado pelo Supabase em cada consulta e os
// dados são protegidos pelo RLS. As checagens de acesso ficam no servidor.
export async function getCurrentUser(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.auth.getSession()
  return data.session?.user ?? null
}
