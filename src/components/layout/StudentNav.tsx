'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dumbbell, Calendar, History, TrendingUp, User } from 'lucide-react'

export function StudentNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/student/today', label: 'Hoje', icon: Dumbbell },
    { href: '/student/week', label: 'Semana', icon: Calendar },
    { href: '/student/history', label: 'Histórico', icon: History },
    { href: '/student/progress', label: 'Evolução', icon: TrendingUp },
    { href: '/student/profile', label: 'Perfil', icon: User },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-900 px-2 py-2 flex justify-around items-center z-50">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
              isActive ? 'text-white font-bold' : 'text-zinc-600 hover:text-zinc-400'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
            <span className="text-[9px] uppercase tracking-wider">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}