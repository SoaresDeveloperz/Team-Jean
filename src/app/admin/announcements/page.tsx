'use client'

import { useEffect, useState } from 'react'
import { LoaderCircle, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { Alert, FeedbackAlert, type Feedback } from '@/components/ui/alert'

const ALL_STUDENTS = 'all'
const inputClassName =
  'w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:outline-none'

export default function AdminAnnouncementsPage() {
  const [supabase] = useState(() => createClient())
  const [students, setStudents] = useState<Profile[]>([])
  const [loadError, setLoadError] = useState('')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  useEffect(() => {
    let active = true

    const load = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, full_name, email')
        .eq('role', 'student')
        .order('full_name')
      if (!active) return
      if (error) setLoadError(`Não foi possível carregar os alunos: ${error.message}`)
      else setStudents((data ?? []) as Profile[])
    }

    void load()
    return () => {
      active = false
    }
  }, [supabase])

  const handleSendAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedStudent) return

    const recipients = selectedStudent === ALL_STUDENTS ? students.map((student) => student.id) : [selectedStudent]
    if (recipients.length === 0) {
      setFeedback({ type: 'error', message: 'Nenhum aluno para receber o aviso.' })
      return
    }

    setSending(true)
    setFeedback(null)

    const { error } = await supabase.from('notifications').insert(
      recipients.map((recipientId) => ({
        recipient_id: recipientId,
        type: 'announcement',
        title: title.trim(),
        message: message.trim(),
      })),
    )

    if (error) {
      setFeedback({ type: 'error', message: `Erro ao enviar aviso: ${error.message}` })
    } else {
      setFeedback({
        type: 'success',
        message: recipients.length > 1 ? `Aviso enviado para ${recipients.length} alunos!` : 'Aviso enviado com sucesso!',
      })
      setTitle('')
      setMessage('')
    }
    setSending(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black uppercase tracking-wide">Enviar aviso</h1>
        <p className="text-xs font-medium text-zinc-500">O aviso aparece no perfil do aluno</p>
      </div>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      <form onSubmit={handleSendAnnouncement} className="space-y-4 rounded-2xl border border-zinc-900 bg-zinc-950 p-5">
        <div>
          <label htmlFor="announcement-student" className="mb-1 block text-xs font-semibold uppercase text-zinc-400">
            Para
          </label>
          <select
            id="announcement-student"
            required
            value={selectedStudent}
            onChange={(event) => setSelectedStudent(event.target.value)}
            className={inputClassName}
          >
            <option value="">Selecione um aluno...</option>
            {students.length > 1 && <option value={ALL_STUDENTS}>Todos os alunos ({students.length})</option>}
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.full_name || student.email}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="announcement-title" className="mb-1 block text-xs font-semibold uppercase text-zinc-400">
            Título do aviso
          </label>
          <input
            id="announcement-title"
            type="text"
            required
            maxLength={120}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex: Atualização da carga de treino"
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="announcement-message" className="mb-1 block text-xs font-semibold uppercase text-zinc-400">
            Mensagem
          </label>
          <textarea
            id="announcement-message"
            required
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Escreva a mensagem para o aluno..."
            className={inputClassName}
          />
        </div>

        <FeedbackAlert feedback={feedback} />

        <button
          type="submit"
          disabled={sending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white p-4 text-xs font-extrabold uppercase text-black disabled:opacity-60"
        >
          {sending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-label="Enviando" />
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" /> Enviar aviso
            </>
          )}
        </button>
      </form>
    </div>
  )
}
