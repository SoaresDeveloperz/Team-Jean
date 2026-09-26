'use client'

import { StudentNav } from '../../components/layout/StudentNav'
import { Logo } from '../../components/ui/logo'
import { createClient } from '../../lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Topo Aluno */}
      <header className="sticky top-0 bg-black/80 backdrop-blur-md border-b border-zinc-900 px-6 py-4 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <Logo className="w-7 h-7" />
          <span className="font-black text-base tracking-wider">TEAM JEAN</span>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-zinc-500 hover:text-white transition-colors"
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Conteúdo */}
      <main className="p-4 max-w-md mx-auto">{children}</main>

      {/* Menu Fixo Embaixo */}
      <StudentNav />
    </div>
  )
}