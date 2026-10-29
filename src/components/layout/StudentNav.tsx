'use client'

import { usePathname } from 'next/navigation'
import { Dumbbell, History, MessageCircleHeart, TrendingUp, User } from 'lucide-react'
import { BottomNav, type NavItem } from './BottomNav'

// 5 abas (cada uma com um trabalho só). A Semana abre pelo "Ver minha semana" da tela Hoje.
const items: NavItem[] = [
  { href: '/student/today', label: 'Hoje', icon: Dumbbell },
  { href: '/student/community', label: 'Equipe', icon: MessageCircleHeart },
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
