'use client'

import { Bell, ClipboardList, Dumbbell, LayoutDashboard, MessageCircleHeart, Users } from 'lucide-react'
import { BottomNav, type NavItem } from './BottomNav'

const items: NavItem[] = [
  { href: '/admin', label: 'Painel', icon: LayoutDashboard, exact: true },
  { href: '/admin/students', label: 'Alunos', icon: Users },
  { href: '/admin/workouts', label: 'Treinos', icon: ClipboardList },
  { href: '/admin/exercises', label: 'Exercícios', icon: Dumbbell },
  { href: '/admin/community', label: 'Equipe', icon: MessageCircleHeart },
  { href: '/admin/announcements', label: 'Avisos', icon: Bell },
]

export function AdminNav() {
  return <BottomNav items={items} label="Menu do treinador" />
}
