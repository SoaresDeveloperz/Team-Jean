'use client'

import { usePathname } from 'next/navigation'
import { Calendar, Dumbbell, History, TrendingUp, User } from 'lucide-react'
import { BottomNav, type NavItem } from './BottomNav'

const items: NavItem[] = [
  { href: '/student/today', label: 'Hoje', icon: Dumbbell },
  { href: '/student/week', label: 'Semana', icon: Calendar },
  { href: '/student/history', label: 'Histórico', icon: History },
  { href: '/student/progress', label: 'Evolução', icon: TrendingUp },
  { href: '/student/profile', label: 'Perfil', icon: User },
]

export function StudentNav() {
  const pathname = usePathname()

  // Durante a execução do treino o menu some para dar espaço ao cronômetro.
  if (pathname.startsWith('/student/workout/')) return null

  return <BottomNav items={items} label="Menu do aluno" />
}
