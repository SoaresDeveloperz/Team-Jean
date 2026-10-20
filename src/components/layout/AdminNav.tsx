'use client'

import { Bell, ClipboardList, Dumbbell, Users } from 'lucide-react'
import { BottomNav, type NavItem } from './BottomNav'

const items: NavItem[] = [
  { href: '/admin/students', label: 'Alunos', icon: Users },
  { href: '/admin/workouts', label: 'Treinos', icon: ClipboardList },
  { href: '/admin/exercises', label: 'Exercícios', icon: Dumbbell },
  { href: '/admin/announcements', label: 'Avisos', icon: Bell },
]

export function AdminNav() {
  return <BottomNav items={items} label="Menu do treinador" />
}
