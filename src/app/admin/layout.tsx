'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { AdminNav } from '../../components/layout/AdminNav'
import { Logo } from '../../components/ui/logo'
import { createClient } from '../../lib/supabase/client'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [signingOut, setSigningOut] = useState(false)

  const handleLogout = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.replace('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Top Bar Admin */}
      <header className="sticky top-0 bg-black/80 backdrop-blur-md border-b border-zinc-900 px-6 py-4 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <Logo className="w-8 h-8" />
          <span className="font-black text-lg tracking-wider">TEAM JEAN</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase bg-white text-black px-2.5 py-1 rounded-full">
            PAINEL ADMIN
          </span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            aria-label="Sair"
            title="Sair"
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-white disabled:opacity-50"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Conteúdo das Páginas */}
      <main className="p-4 max-w-md mx-auto">{children}</main>

      {/* Menu Fixo Embaixo */}
      <AdminNav />
    </div>
  )
}