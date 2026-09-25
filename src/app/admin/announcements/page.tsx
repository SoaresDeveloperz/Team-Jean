'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { Send, Bell, Loader2 } from 'lucide-react'

export default function AdminAnnouncementsPage() {
  const [students, setStudents] = useState<any[]>([])
  const [selectedStudent, setSelectedStudent] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState('')

  const supabase = createClient()

  useEffect(() => {
    loadStudents()
  }, [])

  const loadStudents = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'student')
    if (data) setStudents(data)
  }

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudent) return

    setSending(true)
    setFeedback('')

    const { error } = await supabase.from('notifications').insert([
      {
        recipient_id: selectedStudent,
        type: 'announcement',
        title,
        message,
      },
    ])

    if (!error) {
      setFeedback('Aviso enviado com sucesso!')
      setTitle('')
      setMessage('')
    } else {
      setFeedback('Erro ao enviar aviso.')
    }
    setSending(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black uppercase tracking-wide">Enviar Aviso</h1>
        <p className="text-xs text-zinc-500 font-medium">Envie mensagens individuais aos alunos</p>
      </div>

      <form onSubmit={handleSendAnnouncement} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-zinc-400 uppercase block mb-1">Selecione o Aluno</label>
          <select
            required
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white"
          >
            <option value="">Selecione um aluno...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name || s.email}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-400 uppercase block mb-1">Título do Aviso</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Atualização da carga de treino"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-400 uppercase block mb-1">Mensagem</label>
          <textarea
            required
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escreva a mensagem para o aluno..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white"
          />
        </div>

        {feedback && <p className="text-xs text-emerald-400 font-bold text-center">{feedback}</p>}

        <button
          type="submit"
          disabled={sending}
          className="w-full bg-white text-black font-extrabold p-4 rounded-xl text-xs uppercase flex items-center justify-center gap-2"
        >
          {sending ? <Loader2 className="animate-spin w-4 h-4" /> : <><Send className="w-4 h-4" /> Enviar Aviso</>}
        </button>
      </form>
    </div>
  )
}