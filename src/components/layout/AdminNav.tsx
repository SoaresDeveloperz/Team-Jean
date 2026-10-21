'use client'

import { Bell, ClipboardList, Dumbbell, LayoutDashboard, MessageCircleHeart, Users, Wallet } from 'lucide-react'
import { BottomNav, type NavItem } from './BottomNav'

// Menu completo (barra lateral no computador).
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Painel', icon: LayoutDashboard, exact: true },
  { href: '/admin/students', label: 'Alunos', icon: Users },
  { href: '/admin/workouts', label: 'Treinos', icon: ClipboardList },
  { href: '/admin/exercises', label: 'Exercícios', icon: Dumbbell },
  { href: '/admin/community', label: 'Equipe', icon: MessageCircleHeart },
  { href: '/admin/announcements', label: 'Avisos', icon: Bell },
  { href: '/admin/finance', label: 'Financeiro', icon: Wallet },
]

// No celular cabem 6: o Financeiro fica no painel e nos atalhos (+).
const MOBILE_ITEMS = ADMIN_NAV_ITEMS.filter((item) => item.href !== '/admin/finance')

export function AdminNav() {
  return <BottomNav items={MOBILE_ITEMS} label="Menu do treinador" className="lg:hidden" />
}
