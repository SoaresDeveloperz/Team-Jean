import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type SessionInfo = {
  userId: string
  email: string | null
  fullName: string | null
  isAdmin: boolean
}

// O papel vem SEMPRE da tabela profiles. user_metadata pode ser alterado pelo
// próprio usuário (supabase.auth.updateUser), então nunca serve para autorização.
function isAdminRole(role: unknown) {
  return String(role ?? '').trim().toLowerCase() === 'admin'
}

export const getSession = cache(async (): Promise<SessionInfo | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? null,
    isAdmin: isAdminRole(profile?.role),
  }
})

export async function requireUser() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

export async function requireAdmin() {
  const session = await requireUser()
  if (!session.isAdmin) redirect('/student/today')
  return session
}
