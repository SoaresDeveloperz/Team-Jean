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
    <div className="min-h-screen bg-black text-white pb-28">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-zinc-900 px-5 py-4 flex items-center gap-3">
        <svg viewBox="0 0 400 400" className="w-8 h-8" fill="none">
          <path d="M60 120 L340 120 L300 150 L225 150 L225 280 L200 310 L150 250 L175 220 L200 250 L200 150 L100 150 Z" fill="white"/>
          <path d="M245 170 L290 170 L290 280 L200 350 L160 300 L180 275 L200 295 L265 245 L265 170 Z" fill="white"/>
        </svg>
        <span className="font-black text-lg tracking-widest uppercase">TEAM JEAN</span>
      </header>

      {/* Conteúdo */}
      <main className="px-4 pt-4 max-w-md mx-auto">
        {children}
      </main>

      {/* MENU INFERIOR ESTILO LYFTA / HEVY */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-t border-zinc-900 px-2 pt-2 pb-5">
        <div className="flex justify-around items-end max-w-md mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1 min-w-[64px]"
              >
                <div className={`p-2 rounded-2xl transition-all ${active ? 'bg-zinc-900 border border-zinc-700' : ''}`}>
                  <Icon className={`w-5 h-5 ${active ? 'text-emerald-400 stroke-[2.5]' : 'text-zinc-500'}`} />
                </div>
                <span className={`text-[10px] uppercase tracking-wide ${active ? 'text-white font-black' : 'text-zinc-500 font-semibold'}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
