'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { Plus, User, Search, Loader2, CheckCircle2 } from 'lucide-react'

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  
  // Formulário do novo aluno
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setLoadingSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const supabase = createClient()

  useEffect(() => {
    loadStudents()
  }, [])

  const loadStudents = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('created_at', { ascending: false })

    if (data) setStudents(data)
    setLoading(false)
  }

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingSaving(true)
    setMsg('')

    // Criar conta de usuário do aluno no Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'student',
        },
      },
    })

    if (error) {
      setMsg('Erro ao cadastrar: ' + error.message)
    } else {
      setMsg('Aluno cadastrado com sucesso!')
      setFullName('')
      setEmail('')
      setPassword('')
      setShowModal(false)
      loadStudents()
    }
    setLoadingSaving(false)
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
          onClick={() => setShowModal(true)}
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
ext-sm    <p className="text-xs text-zinc-600">Clique em "Cadastrar" para adicionar seu primeiro aluno.</p>
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
              <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-2 py-1 rounded-lg">
                Ativo
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Modal Novo Aluno */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-black uppercase">Cadastrar Aluno</h2>
            
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
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="joao@email.com"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-white"
                />
              </div>

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

              {msg && <p className="text-xs font-medium text-emerald-400 text-center">{msg}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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