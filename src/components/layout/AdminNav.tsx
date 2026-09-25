'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Dumbbell, ClipboardList, Bell, User } from 'lucide-react'

export function AdminNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/admin/students', label: 'Alunos', icon: Users },
    { href: '/admin/workout', label: 'Treinos', icon: ClipboardList },
    { href: '/admin/exercises', label: 'Exercícios', icon: Dumbbell },
    { href: '/admin/announcements', label: 'Avisos', icon: Bell },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-900 px-4 py-2 flex justify-around items-center z-50">
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
            <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
            <span className="text-[10px] uppercase tracking-wider">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}