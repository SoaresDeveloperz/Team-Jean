import { AdminNav } from '../../components/layout/AdminNav'
import { Logo } from '../../components/ui/logo'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Top Bar Admin */}
      <header className="sticky top-0 bg-black/80 backdrop-blur-md border-b border-zinc-900 px-6 py-4 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <Logo className="w-8 h-8" />
          <span className="font-black text-lg tracking-wider">TEAM JEAN</span>
        </div>
        <span className="text-[10px] font-extrabold uppercase bg-white text-black px-2.5 py-1 rounded-full">
          PAINEL ADMIN
        </span>
      </header>

      {/* Conteúdo das Páginas */}
      <main className="p-4 max-w-md mx-auto">{children}</main>

      {/* Menu Fixo Embaixo */}
      <AdminNav />
    </div>
  )
}