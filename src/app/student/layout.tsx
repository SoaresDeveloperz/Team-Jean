import type { ReactNode } from 'react'
import { requireUser } from '@/lib/auth'
import { StudentHeader } from '@/components/layout/StudentHeader'
import { StudentNav } from '@/components/layout/StudentNav'

export default async function StudentLayout({ children }: { children: ReactNode }) {
  await requireUser()

  return (
    <div className="min-h-screen bg-black text-white">
      <StudentHeader />
      <main className="mx-auto max-w-md px-4 pb-32 pt-4">{children}</main>
      <StudentNav />
    </div>
  )
}
