'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { Plus, User, Loader2, Pencil } from 'lucide-react'

type Student = {
  id: string
  full_name: string | null
  email: string | null
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null)
  
  // Formulário do novo aluno
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const [supabase] = useState(() => createClient())

  const loadStudents = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('created_at', { ascending: false })

    if (data) setStudents(data as Student[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStudents()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadStudents])

  const openCreateModal = () => {
    setEditingStudentId(null)
    setFullName('')
    setEmail('')
    setPassword('')
    setMsg('')
    setShowModal(true)
  }

  const openEditModal = (student: Student) => {
    setEditingStudentId(student.id)
    setFullName(student.full_name ?? '')
    setEmail(student.email ?? '')
    setPassword('')
    setMsg('')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingStudentId(null)
    setFullName('')
    setEmail('')
    setPassword('')
    setMsg('')
  }

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMsg('')

    try {
      if (editingStudentId) {
        const { error } = await supabase
          .from('profiles')
          .update({ full_name: fullName.trim() })
          .eq('id', editingStudentId)
          .eq('role', 'student')

        if (error) {
          setMsg(`Não foi possível atualizar o aluno: ${error.message}`)
          return
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              role: 'student',
            },
          },
        })

        if (error) {
          setMsg('Erro ao cadastrar: ' + error.message)
          return
        }
      }

      closeModal()
      await loadStudents()
    } catch {
      setMsg('Não foi possível salvar agora. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Topo com Título e Botão */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wide">Meus Alunos</h1>
          <p className="text-xs text-zinc-500 font-medium">Gerencie sua consultoria</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-white text-black font-extrabold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" /> Cadastrar
        </button>
      </div>

      {/* Lista de Alunos */}
      {loading ? (
        <div className="flex justify-center py-12 text-zinc-500">
          <Loader2 className="animate-spin w-8 h-8" />
        </div>
      ) : students.length === 0 ? (
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-8 text-center space-y-3">
          <User className="w-10 h-10 text-zinc-700 mx-auto" />
          <p className="text-xs text-zinc-600">Clique em &quot;Cadastrar&quot; para adicionar seu primeiro aluno.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {students.map((student) => (
            <div
              key={student.id}
              className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 flex items-center justify-between hover:border-zinc-800 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center font-black text-white text-sm border border-zinc-800">
                  {student.full_name ? student.full_name.substring(0, 2).toUpperCase() : 'AL'}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{student.full_name || 'Aluno Sem Nome'}</h3>
                  <p className="text-xs text-zinc-500">{student.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-2 py-1 rounded-lg">
                  Ativo
                </span>
                <button
                  type="button"
                  onClick={() => openEditModal(student)}
                  aria-label={`Editar aluno ${student.full_name || student.email || ''}`}
                  title="Editar aluno"
                  className="rounded-lg border border-zinc-800 p-2 text-zinc-400 transition hover:border-emerald-500/50 hover:text-emerald-300"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Novo Aluno */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-black uppercase">
              {editingStudentId ? 'Editar Aluno' : 'Cadastrar Aluno'}
            </h2>
            
            <form onSubmit={handleCreateStudent} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase block mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase block mb-1">E-mail do Aluno</label>
                <input
                  type="email"
                  required={!editingStudentId}
                  readOnly={Boolean(editingStudentId)}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="joao@email.com"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-white read-only:cursor-not-allowed read-only:text-zinc-500 focus:outline-none focus:border-white"
                />
              </div>

              {!editingStudentId && (
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase block mb-1">Senha Provisória</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-white"
                  />
                </div>
              )}

              {msg && <p className="text-xs font-medium text-emerald-400 text-center">{msg}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-1/2 bg-zinc-900 text-zinc-400 font-bold p-3 rounded-xl text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-1/2 bg-white text-black font-extrabold p-3 rounded-xl text-xs uppercase flex items-center justify-center"
                >
                  {saving ? <Loader2 className="animate-spin w-4 h-4" /> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}