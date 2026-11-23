'use client'

import { usePathname } from 'next/navigation'
import { Dumbbell, History, MessageCircleHeart, TrendingUp } from 'lucide-react'
import { BottomNav, type NavItem } from './BottomNav'

// 4 abas (cada uma com um trabalho só). A Semana abre pelo "Ver minha semana" da tela Hoje e o
// Perfil fica no topo, junto das notificações. A Evolução fica ao lado do treino (pedido do Jean).
const items: NavItem[] = [
  { href: '/student/today', label: 'Hoje', icon: Dumbbell, alsoActive: ['/student/week'] },
  { href: '/student/progress', label: 'Evolução', icon: TrendingUp },
  { href: '/student/history', label: 'Histórico', icon: History },
  { href: '/student/community', label: 'Equipe', icon: MessageCircleHeart },
]

export function StudentNav() {
  const pathname = usePathname()

  // Durante a execução do treino o menu some para dar espaço ao cronômetro.
  if (pathname.startsWith('/student/workout/')) return null

  return <BottomNav items={items} label="Menu do aluno" />
}
