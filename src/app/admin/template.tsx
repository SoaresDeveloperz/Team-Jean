import type { ReactNode } from 'react'
import { PageTransition } from '@/components/motion/PageTransition'

export default function AdminTemplate({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}
