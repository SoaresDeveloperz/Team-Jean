'use client'

import { useCallback, useEffect, useState } from 'react'
import { CircleCheck, LoaderCircle, Pencil, Search, User, UserPlus, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { cn } from '@/lib/cn'
import { Alert, FeedbackAlert, type Feedback } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { PageLoader } from '@/components/ui/page-loader'
import { createStudent } from './actions'

const inputClassName =
  'w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:outline-none'
const labelClassName = 'mb-1 block text-xs font-semibold uppercase text-zinc-400'

function getReadinessBadge(score: number | null | undefined) {
  if (score === null || score === undefined) {
    return { label: 'Sem registro', className: 'border-zinc-800 bg-zinc-900 text-zinc-400' }
  }
  if (score >= 80) return { label: `${score}% · Pronto`, className: 'border-emerald-800/40 bg-emerald-950/60 text-emerald-400' }
  if (score >= 50) return { label: `${score}% · Moderado`, className: 'border-amber-800/40 bg-amber-950/60 text-amber-400' }
  return { label: `${score}% · Fadigado`, className: 'border-rose-800/40 bg-rose-950/60 text-rose-400' }
}

function getInitials(name: string | null) {
  return name ? name.trim().substring(0, 2).toUpperCase() : 'AL'
}

export default function AdminStudentsPage() {
  const [supabase] = useState(() => createClient())
  const [students, setStudents] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [pageFeedback, setPageFeedback] = useState<Feedback>(null)
  const [search, setSearch] = useState('')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  const [editingStudent, setEditingStudent] = useState<Profile | null>(null)
  const [editFullName, setEditFullName] = useState('')
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Incrementar a chave recarrega a lista (após cadastrar ou editar).
  const [reloadKey, setReloadKey] = useState(0)
  const reloadStudents = () => setReloadKey((key) => key + 1)

  useEffect(() => {
    let active = true

    const loadStudents = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false })

      if (!active) return
      if (error) {
        setLoadError(`Não foi possível carregar os alunos: ${error.message}`)
      } else {
        setLoadError('')
        setStudents((data ?? []) as Profile[])
      }
      setLoading(false)
    }

    void loadStudents()
    return () => {
      active = false
    }
  }, [supabase, reloadKey])

  const closeCreateModal = useCallback(() => setShowCreateModal(false), [])
  const closeEditModal = useCallback(() => setEditingStudent(null), [])

  const openCreateModal = () => {
    setFullName('')
    setEmail('')
    setPassword('')
    setCreateError('')
    setShowCreateModal(true)
  }

  const handleCreateStudent = async (event: React.FormEvent) => {
    event.preventDefault()
    setCreating(true)
    setCreateError('')

    try {
      const result = await createStudent({ fullName, email, password })
      if (!result.ok) {
        setCreateError(result.message)
        return
      }
      setShowCreateModal(false)
      setPageFeedback({ type: 'success', message: result.message })
      reloadStudents()
    } catch {
      setCreateError('Falha de conexão ao cadastrar. Tente novamente.')
    } finally {
      setCreating(false)
    }
  }

  const openEditModal = (student: Profile) => {
    setEditingStudent(student)
    setEditFullName(student.full_name ?? '')
    setEditError('')
  }

  const handleSaveStudentName = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingStudent) return

    const name = editFullName.trim()
    if (!name) {
      setEditError('Informe o nome do aluno.')
      return
    }

    setSavingEdit(true)
    const { error } = await supabase.from('profiles').update({ full_name: name }).eq('id', editingStudent.id)
    setSavingEdit(false)

    if (error) {
      setEditError(`Erro ao atualizar nome: ${error.message}`)
      return
    }
    setEditingStudent(null)
    setPageFeedback({ type: 'success', message: 'Nome atualizado.' })
    reloadStudents()
  }

  const term = search.trim().toLowerCase()
  const filteredStudents = term
    ? students.filter(
        (student) =>
          (student.full_name ?? '').toLowerCase().includes(term) || (student.email ?? '').toLowerCase().includes(term),
      )
    : students

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wide">Meus Alunos</h1>
          <p className="text-xs font-medium text-zinc-500">
            {students.length} {students.length === 1 ? 'aluno ativo' : 'alunos ativos'}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-black shadow-lg active:scale-95"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" /> Cadastrar
        </button>
      </div>

      <FeedbackAlert feedback={pageFeedback} />

      {students.length > 4 && (
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            aria-label="Buscar aluno"
            className={cn(inputClassName, 'py-3 pl-10')}
          />
        </div>
      )}

      {loading ? (
        <PageLoader label="Carregando alunos" />
      ) : loadError ? (
        <Alert variant="error">{loadError}</Alert>
      ) : filteredStudents.length === 0 ? (
        <div className="space-y-3 rounded-3xl border border-zinc-900 bg-zinc-950 p-8 text-center">
          <User className="mx-auto h-10 w-10 text-zinc-700" aria-hidden="true" />
          <p className="text-sm font-semibold text-zinc-400">
            {students.length === 0 ? 'Nenhum aluno cadastrado ainda.' : 'Nenhum aluno encontrado.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredStudents.map((student) => {
            const readiness = getReadinessBadge(student.readiness_score)

            return (
              <li
                key={student.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-900 bg-zinc-950 p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-sm font-black text-white">
                    {getInitials(student.full_name)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-white">{student.full_name || 'Aluno sem nome'}</h3>
                    <p className="truncate text-[11px] text-zinc-500">{student.email}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Zap className="h-3 w-3 text-amber-400" aria-hidden="true" />
                      <span
                        className={cn('rounded-md border px-2 py-0.5 text-[9px] font-black uppercase', readiness.className)}
                      >
                        Recuperação: {readiness.label}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openEditModal(student)}
                  aria-label={`Editar nome de ${student.full_name || 'aluno'}`}
                  className="shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 p-2.5 text-emerald-400 transition-all hover:text-white"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        open={showCreateModal}
        onClose={closeCreateModal}
        title="Cadastrar Aluno"
        description="O aluno entra com este e-mail e a senha provisória."
      >
        <form onSubmit={handleCreateStudent} className="space-y-3">
          <div>
            <label htmlFor="student-name" className={labelClassName}>
              Nome completo
            </label>
            <input
              id="student-name"
              type="text"
              required
              autoComplete="off"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Ex: João Silva"
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="student-email" className={labelClassName}>
              E-mail do aluno
            </label>
            <input
              id="student-email"
              type="email"
              required
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="joao@email.com"
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="student-password" className={labelClassName}>
              Senha provisória
            </label>
            <input
              id="student-password"
              type="text"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo de 6 caracteres"
              className={inputClassName}
            />
          </div>

          {createError && <Alert variant="error">{createError}</Alert>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={closeCreateModal}
              className="w-1/2 rounded-xl bg-zinc-900 p-3 text-xs font-bold uppercase text-zinc-400"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creating}
              className="flex w-1/2 items-center justify-center rounded-xl bg-white p-3 text-xs font-extrabold uppercase text-black disabled:opacity-60"
            >
              {creating ? <LoaderCircle className="h-4 w-4 animate-spin" aria-label="Salvando" /> : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={editingStudent !== null} onClose={closeEditModal} title="Editar Aluno">
        <form onSubmit={handleSaveStudentName} className="space-y-4">
          <div>
            <label htmlFor="edit-student-name" className={labelClassName}>
              Nome completo
            </label>
            <input
              id="edit-student-name"
              type="text"
              required
              value={editFullName}
              onChange={(event) => setEditFullName(event.target.value)}
              className={cn(inputClassName, 'font-bold')}
            />
          </div>

          {editError && <Alert variant="error">{editError}</Alert>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={closeEditModal}
              className="w-1/2 rounded-xl bg-zinc-900 p-3.5 text-xs font-bold uppercase text-zinc-400"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="flex w-1/2 items-center justify-center gap-1 rounded-xl bg-white p-3.5 text-xs font-extrabold uppercase text-black disabled:opacity-60"
            >
              {savingEdit ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-label="Salvando" />
              ) : (
                <>
                  <CircleCheck className="h-4 w-4" aria-hidden="true" /> Salvar
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
