'use client'

import { usePathname } from 'next/navigation'
import { AppHeader } from './AppHeader'

export function StudentHeader() {
  const pathname = usePathname()

  // A tela de execução do treino tem a própria barra fixa no topo.
  if (pathname.startsWith('/student/workout/')) return null

  return <AppHeader />
}
