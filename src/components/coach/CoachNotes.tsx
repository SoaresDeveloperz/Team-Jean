'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { LoaderCircle, NotebookPen, Pin, PinOff, Trash2 } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import { CoachError, NOTE_MAX, addNote, deleteNote, loadNotes, setNotePinned, type CoachNote } from '@/lib/coach'
import { relativeDay } from '@/lib/stats'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'

type Status = 'loading' | 'ready' | 'missing' | 'error'

// Fixadas primeiro; depois da mais nova para a mais antiga.
const sortNotes = (notes: CoachNote[]) =>
  [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at))

// Anotações privadas do treinador sobre o aluno (o aluno não vê).
export function CoachNotes({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [supabase] = useState(() => createClient())
  const toast = useToast()
  const [notes, setNotes] = useState<CoachNote[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const list = await loadNotes(supabase, studentId)
        if (!active) return
        setNotes(list)
        setStatus('ready')
      } catch (error) {
        if (!active) return
        if (error instanceof CoachError && error.missing) setStatus('missing')
        else {
          setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar as notas.')
          setStatus('error')
        }
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [supabase, studentId])

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body) return setFormError('Escreva a nota antes de salvar.')
    setFormError('')
    setSaving(true)
    try {
      const user = await getCurrentUser(supabase)
      if (!user) throw new Error('Sessão expirada. Entre de novo.')
      const note = await addNote(supabase, studentId, user.id, body)
      setNotes((list) => sortNotes([note, ...list]))
      setDraft('')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar a nota.')
    } finally {
      setSaving(false)
    }
  }

  const togglePin = async (note: CoachNote) => {
    setNotes((list) => sortNotes(list.map((item) => (item.id === note.id ? { ...item, pinned: !note.pinned } : item))))
    try {
      await setNotePinned(supabase, note.id, !note.pinned)
    } catch (error) {
      setNotes((list) => sortNotes(list.map((item) => (item.id === note.id ? { ...item, pinned: note.pinned } : item))))
      toast({ tone: 'error', title: 'Não foi possível fixar', description: error instanceof Error ? error.message : undefined })
    }
  }

  const remove = async (note: CoachNote) => {
    setNotes((list) => list.filter((item) => item.id !== note.id))
    try {
      await deleteNote(supabase, note.id)
      toast({ tone: 'success', title: 'Nota apagada' })
    } catch (error) {
      setNotes((list) => sortNotes([note, ...list]))
      toast({ tone: 'error', title: 'Não foi possível apagar', description: error instanceof Error ? error.message : undefined })
    }
  }

  if (status === 'loading') {
    return (
      <div className="space-y-2" role="status" aria-label="Carregando notas">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>
    )
  }
  if (status === 'missing') {
    return (
      <p className="rounded-2xl border border-dashed border-line-strong p-4 text-center text-xs leading-relaxed text-zinc-400">
        Para usar as notas, rode o arquivo <code className="text-brand">supabase/coach.sql</code> no SQL Editor do Supabase.
      </p>
    )
  }
  if (status === 'error') return <Alert variant="error">{errorMessage}</Alert>

  return (
    <div className="space-y-3">
      <form onSubmit={save} className="space-y-2">
        <label htmlFor={`note-${studentId}`} className="sr-only">
          Nova nota sobre {studentName}
        </label>
        <textarea
          id={`note-${studentId}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={NOTE_MAX}
          rows={3}
          placeholder={`Lesões, preferências, combinados com ${studentName.split(' ')[0]}...`}
          className="w-full resize-none rounded-2xl border border-line-strong bg-black/40 p-3.5 text-sm text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none"
        />
        {formError && <Alert variant="error">{formError}</Alert>}
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-zinc-500">Só você vê estas notas.</p>
          <m.button
            type="submit"
            whileTap={{ scale: 0.96 }}
            disabled={saving || !draft.trim()}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-xs font-black uppercase tracking-wider text-black disabled:opacity-50"
          >
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <NotebookPen className="h-4 w-4" aria-hidden="true" />}
            Salvar nota
          </m.button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong p-4 text-center text-xs text-zinc-500">Nenhuma nota ainda.</p>
      ) : (
        <ul className="space-y-2" aria-label={`Notas sobre ${studentName}`}>
          <AnimatePresence initial={false}>
            {notes.map((note) => (
              <m.li
                key={note.id}
                layout
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className={cn(
                  'rounded-2xl border p-3.5',
                  note.pinned ? 'border-gold/30 bg-gold-soft/60' : 'border-line bg-surface',
                )}
              >
                <p className="whitespace-pre-line break-words text-sm leading-relaxed text-zinc-100">{note.body}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    {note.pinned && <Pin className="h-3 w-3 text-gold" aria-hidden="true" />}
                    {note.pinned ? 'Fixada · ' : ''}
                    {relativeDay(new Date(note.created_at))}
                  </span>
                  <span className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => togglePin(note)}
                      aria-label={note.pinned ? 'Desafixar nota' : 'Fixar nota no topo'}
                      aria-pressed={note.pinned}
                      className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/5 hover:text-gold"
                    >
                      {note.pinned ? <PinOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Pin className="h-3.5 w-3.5" aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(note)}
                      aria-label="Apagar nota"
                      className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </span>
                </div>
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  )
}
