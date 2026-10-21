import type { ReactNode } from 'react'
import { requireAdmin } from '@/lib/auth'
import { AdminNav } from '@/components/layout/AdminNav'
import { AppHeader } from '@/components/layout/AppHeader'
import { LogoutButton } from '@/components/layout/LogoutButton'
import { CoachQuickActions } from '@/components/layout/CoachQuickActions'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { NotificationsButton } from '@/components/layout/NotificationsButton'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Só admins (profiles.role = 'admin') passam daqui. Os dados continuam
  // protegidos pelo RLS do Supabase; isto bloqueia a interface.
  await requireAdmin()

  return (
    <div className="min-h-dvh bg-black pb-32 text-white lg:pb-16 lg:pl-64">
      <AdminSidebar />
      <AppHeader
        badge="Treinador"
        homeHref="/admin"
        className="lg:hidden"
        actions={
          <>
            <NotificationsButton audience="coach" />
            <LogoutButton className="h-11 w-11 justify-center rounded-2xl border border-line bg-surface text-zinc-300" />
          </>
        }
      />
      {/* No computador o conteúdo abre em largura total (bento em várias colunas). */}
      <main className="mx-auto max-w-md p-4 lg:max-w-6xl lg:px-8 lg:pt-10">{children}</main>
      <CoachQuickActions />
      <AdminNav />
    </div>
  )
}
