import type { ReactNode } from 'react'

// Entrada suave de cada tela (usada nos template.tsx, que remontam a cada navegação).
// Em CSS (.page-in, globals.css): sem JavaScript e desligada com "reduzir movimento".
export function PageTransition({ children }: { children: ReactNode }) {
  return <div className="page-in">{children}</div>
}
