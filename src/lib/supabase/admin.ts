import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseEnv } from './env'

// Cliente com a chave service_role: ignora o RLS. Use somente no servidor e
// sempre depois de verificar que quem chamou é admin (requireAdmin()).
export function createAdminClient() {
  const { url } = getSupabaseEnv()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.')
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
