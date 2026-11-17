'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import type { Profile } from '@/lib/types'
import { Avatar } from '@/components/ui/avatar'
import { avatarUrlOf } from '@/lib/profile'

const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

// Busca de aluno no painel: digita o nome e abre a ficha, sem passar pela lista.
export function StudentQuickSearch({ students }: { students: Profile[] }) {
  const [term, setTerm] = useState('')
  const words = plain(term).split(/\s+/).filter(Boolean)
  const found =
    words.length === 0
      ? []
      : students.filter((student) => {
          const text = plain(`${student.full_name ?? ''} ${student.email ?? ''}`)
          return words.every((word) => text.includes(word))
        })

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Buscar aluno pelo nome</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar aluno e abrir a ficha"
          autoComplete="off"
          className="h-12 w-full rounded-2xl border border-line bg-surface pl-11 pr-4 text-base text-white placeholder:text-zinc-500 focus:border-brand/60 focus:outline-none"
        />
      </label>
      {words.length > 0 && (
        <div className="mt-2">
          <p className="sr-only" role="status">
            {found.length === 0 ? 'Nenhum aluno encontrado' : `${found.length} alunos encontrados`}
          </p>
          {found.length === 0 ? (
            <p className="px-2 py-2 text-sm text-zinc-500">Nenhum aluno com esse nome.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {found.slice(0, 5).map((student) => (
                <li key={student.id}>
                  <Link href={`/admin/students?aluno=${student.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-white/[0.03]">
                    <Avatar name={student.full_name ?? student.email} seed={student.id} src={avatarUrlOf(student)} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{student.full_name || student.email}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
