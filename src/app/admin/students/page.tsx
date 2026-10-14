'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'
import {
  Plus,
  User,
  Loader2,
  Pencil,
  X,
  CheckCircle2,
  Zap,
  Eye,
  Calendar,
  Dumbbell,
  Award,
  History,
} from 'lucide-react'

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Modal Cadastrar
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  // Modal Editar
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null)
  const [editFullName, setEditFullName] = useState('')
  const [msg, setMsg] = useState('')

  // Modal Visualizar Cargas e Histórico do Aluno (NOVO!)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<any>(null)
  const [studentSessions, setStudentSessions] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

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

  // ABRIR VISUALIZADOR DE CARGAS DO ALUNO
  const handleOpenStudentHistory = async (student: any) => {
    setSelectedStudentForHistory(student)
    setShowHistoryModal(true)
    setLoadingHistory(true)

    // Busca as sessões concluídas do aluno com os exercícios e séries gravadas
    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('*, assigned_workouts(name)')
      .eq('student_id', student.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })

    if (sessions && sessions.length > 0) {
      // Para cada sessão, busca as séries preenchidas pelo aluno
      const detailedSessions = await Promise.all(
        sessions.map(async (sess) => {
          const { data: sets } = await supabase
            .from('session_sets')
            .select('*, exercises(name, muscle_group)')
            .eq('session_id', sess.id)
            .order('set_number', { ascending: true })

          return {
            ...sess,
            sets: sets || [],
          }
        })
      )
      setStudentSessions(detailedSessions)
    } else {
      setStudentSessions([])
    }

    setLoadingHistory(false)
  }

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMsg('')

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
      setShowCreateModal(false)
      loadStudents()
    }
    setSaving(false)
  }

  const handleOpenEditModal = (student: any) => {
    setEditingStudentId(student.id)
    setEditFullName(student.full_name || '')
    setShowEditModal(true)
  }

  const handleSaveStudentName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingStudentId) return
    setSaving(true)

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: editFullName })
      .eq('id', editingStudentId)

    if (error) {
      alert('Erro ao atualizar nome: ' + error.message)
    } else {
      setShowEditModal(false)
      loadStudents()
    }
    setSaving(false)
  }

  const getReadinessBadge = (score: number = 100) => {
    if (score >= 80) return { label: `${score}% - Pronto`, color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40' }
    if (score >= 50) return { label: `${score}% - Moderado`, color: 'text-amber-400 bg-amber-950/60 border-amber-800/40' }
    return { label: `${score}% - Fadigado`, color: 'text-rose-400 bg-rose-950/60 border-rose-800/40' }
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wide">Meus Alunos</h1>
          <p className="text-xs text-zinc-500 font-medium">Acompanhe seus atletas e cargas</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-white text-black font-extrabold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg active:scale-95"
        >
          <Plus className="w-4 h-4" /> Cadastrar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-zinc-500">
          <Loader2 className="animate-spin w-8 h-8" />
        </div>
      ) : students.length === 0 ? (
        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center space-y-3">
          <User className="w-10 h-10 text-zinc-700 mx-auto" />
          <p className="text-sm font-semibold text-zinc-400">Nenhum aluno cadastrado ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {students.map((student) => {
            const readinessBadge = getReadinessBadge(student.readiness_score)

            return (
              <div
                key={student.id}
                className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-zinc-900 rounded-full flex items-center justify-center font-black text-white text-sm border border-zinc-800 shrink-0">
                    {student.full_name ? student.full_name.substring(0, 2).toUpperCase() : 'AL'}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">{student.full_name || 'Aluno Sem Nome'}</h3>
                    <p className="text-[11px] text-zinc-500">{student.email}</p>
                    
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${readinessBadge.color}`}>
                        Recuperação: {readinessBadge.label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* BOTÃO 👁️ VER CARGAS E HISTÓRICO DO ALUNO */}
                  <button
                    onClick={() => handleOpenStudentHistory(student)}
                    className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-emerald-400 hover:bg-zinc-800 transition-all flex items-center gap-1.5 text-[10px] font-black uppercase"
                    title="Ver Cargas"
                  >
                    <Eye className="w-4 h-4" /> Cargas
                  </button>

                  {/* BOTÃO LÁPIS PARA EDITAR NOME */}
                  <button
                    onClick={() => handleOpenEditModal(student)}
                    className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all"
                    title="Editar Nome"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL VISUALIZADOR DE CARGAS E HISTÓRICO DO ALUNO */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col justify-between p-4 overflow-y-auto">
          <div className="max-w-md mx-auto w-full space-y-6 pb-20">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">
                  FICHA DE CARGAS
                </span>
                <h2 className="text-lg font-black uppercase text-white">
                  {selectedStudentForHistory?.full_name || 'Atleta'}
                </h2>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-2 text-zinc-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-500">
                <Loader2 className="animate-spin w-8 h-8 text-white" />
                <p className="text-xs uppercase font-bold tracking-widest">Buscando histórico de cargas...</p>
              </div>
            ) : studentSessions.length === 0 ? (
              <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center space-y-3">
                <History className="w-10 h-10 text-zinc-700 mx-auto" />
                <p className="text-sm font-semibold text-zinc-400">Nenhum treino concluído ainda.</p>
                <p className="text-xs text-zinc-600">Assim que o aluno concluir o treino na academia, as cargas aparecerão aqui!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {studentSessions.map((session) => (
                  <div
                    key={session.id}
                    className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-xl"
                  >
                    {/* Topo do Treino Concluído */}
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                      <div>
                        <h3 className="font-extrabold text-base text-white">
                          {session.assigned_workouts?.name || 'Treino Concluído'}
                        </h3>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {new Date(session.completed_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>

                      <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl text-right">
                        <span className="text-[8px] font-bold text-zinc-500 uppercase block">Esforço</span>
                        <span className="text-xs font-black text-amber-400">
                          RPE {session.session_rpe || '-'}/10
                        </span>
                      </div>
                    </div>

                    {/* TABELA DE CARGAS PREENCHIDAS PELO ALUNO */}
                    <div className="space-y-4">
                      {session.sets && session.sets.length > 0 ? (
                        session.sets.reduce((acc: any[], setItem: any) => {
                          // Agrupa séries por exercício
                          const exName = setItem.exercises?.name || 'Exercício'
                          const existing = acc.find((e) => e.name === exName)
                          if (existing) {
                            existing.sets.push(setItem)
                          } else {
                            acc.push({ name: exName, sets: [setItem] })
                          }
                          return acc
                        }, []).map((group: any, gIdx: number) => (
                          <div key={gIdx} className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-3.5 space-y-2">
                            <h4 className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                              <Dumbbell className="w-3.5 h-3.5" /> {group.name}
                            </h4>

                            <div className="space-y-1.5 pt-1">
                              {group.sets.map((s: any, sIdx: number) => (
                                <div
                                  key={sIdx}
                                  className="flex items-center justify-between bg-black/60 px-3 py-2 rounded-xl text-xs"
                                >
                                  <span className="font-bold text-zinc-400 text-[11px]">
                                    Série #{s.set_number}
                                  </span>

                                  <div className="flex items-center gap-3 font-extrabold text-white">
                                    <span className="text-emerald-400">
                                      {s.weight_kg} kg
                                    </span>
                                    <span className="text-zinc-500">×</span>
                                    <span>{s.reps} reps</span>
                                    {s.rir !== null && (
                                      <span className="text-[10px] font-medium text-zinc-500 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
                                        RIR {s.rir}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-zinc-600 text-center py-2">Nenhuma série registrada.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALS DE CADASTRAR E EDITAR ALUNO (Mantidos intactos) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm space-y-4">
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
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white"
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
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white"
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
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white"
                />
              </div>

              {msg && <p className="text-xs font-medium text-emerald-400 text-center">{msg}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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

      {showEditModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black uppercase">Editar Aluno</h2>
              <button onClick={() => setShowEditModal(false)} className="text-zinc-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudentName} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase block mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-sm text-white font-bold"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="w-1/2 bg-zinc-900 text-zinc-400 font-bold p-3.5 rounded-xl text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-1/2 bg-white text-black font-extrabold p-3.5 rounded-xl text-xs uppercase flex items-center justify-center gap-1"
                >
                  {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <><CheckCircle2 className="w-4 h-4" /> Salvar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
