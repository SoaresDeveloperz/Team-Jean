import type { ReactNode } from 'react'
import { requireAdmin } from '@/lib/auth'
import { AdminNav } from '@/components/layout/AdminNav'
import { AppHeader } from '@/components/layout/AppHeader'
import { LogoutButton } from '@/components/layout/LogoutButton'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Só admins (profiles.role = 'admin') passam daqui. Os dados continuam
  // protegidos pelo RLS do Supabase; isto bloqueia a interface.
  await requireAdmin()

  return (
    <div className="min-h-dvh bg-black pb-32 text-white">
      <AppHeader
        badge="Treinador"
        homeHref="/admin"
        actions={<LogoutButton className="h-10 w-10 justify-center rounded-2xl border border-line bg-surface text-zinc-300" />}
      />
      <main className="mx-auto max-w-md p-4">{children}</main>
      <AdminNav />
    </div>
  )
}
