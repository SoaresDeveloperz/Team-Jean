'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dumbbell, Calendar, History, TrendingUp, User } from 'lucide-react'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const navItems = [
    { href: '/student/today', label: 'Hoje', icon: Dumbbell },
    { href: '/student/week', label: 'Semana', icon: Calendar },
    { href: '/student/history', label: 'Histórico', icon: History },
    { href: '/student/progress', label: 'Evolução', icon: TrendingUp },
    { href: '/student/profile', label: 'Perfil', icon: User },
  ]

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Topo Limpo do Aluno */}
      <header className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-zinc-900 px-6 py-4 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <svg 
            viewBox="0 0 400 400" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg" 
            className="w-8 h-8"
          >
            <path 
              d="M60 120 L340 120 L300 150 L225 150 L225 280 L200 310 L150 250 L175 220 L200 250 L200 150 L100 150 Z" 
              fill="white" 
            />
            <path 
              d="M245 170 L290 170 L290 280 L200 350 L160 300 L180 275 L200 295 L265 245 L265 170 Z" 
              fill="white" 
            />
          </svg>
          <span className="font-black text-lg tracking-widest uppercase">TEAM JEAN</span>
        </div>
      </header>

      {/* Conteúdo da Tela */}
      <main className="p-4 max-w-md mx-auto">{children}</main>

      {/* Barra de Navegação Inferior (Fixa no rodapé) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-zinc-900 px-2 py-2 flex justify-around items-center z-50">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${
                isActive ? 'text-white scale-105' : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              <div className={`p-1.5 rounded-xl ${isActive ? 'bg-zinc-900 border border-zinc-800' : ''}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5] text-emerald-400' : 'stroke-2'}`} />
              </div>
              <span className={`text-[9px] uppercase tracking-wider ${isActive ? 'font-black' : 'font-semibold'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
