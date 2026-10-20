import type { ReactNode } from 'react'
import { PageTransition } from '@/components/motion/PageTransition'

export default function StudentTemplate({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}
