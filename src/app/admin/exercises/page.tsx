'use client'

import { useCallback, useEffect, useState } from 'react'
import { Dumbbell, LibraryBig, LoaderCircle, Pencil, Plus, Search, Video } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Exercise } from '@/lib/types'
import { MUSCLE_GROUPS } from '@/lib/workouts'
import { baseExerciseCatalog } from '@/lib/exercises/catalog'
import { cn } from '@/lib/cn'
import { Alert, FeedbackAlert, type Feedback } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { PageLoader } from '@/components/ui/page-loader'
import { ExerciseMedia, getExerciseMedia } from '@/components/workout/ExerciseMedia'

const ALL = 'Todos'
const inputClassName =
  'w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:outline-none'

function normalizeName(name: string | null | undefined) {
  return String(name ?? '').trim().toLowerCase()
}

export default function AdminExercisesPage() {
  const [supabase] = useState(() => createClient())
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [search, setSearch] = useState('')
  const [muscleFilter, setMuscleFilter] = useState(ALL)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)

  const [editor, setEditor] = useState<{ id: string | null } | null>(null)
  const [name, setName] = useState('')
  const [muscleGroup, setMuscleGroup] = useState(MUSCLE_GROUPS[0])
  const [videoUrl, setVideoUrl] = useState('')
  const [editorError, setEditorError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true

    const load = async () => {
      const { data, error } = await supabase.from('exercises').select('*').order('name', { ascending: true })
      if (!active) return
      if (error) {
        setLoadError(`Não foi possível carregar a biblioteca: ${error.message}`)
      } else {
        setLoadError('')
        setExercises((data ?? []) as Exercise[])
      }
      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [supabase, reloadKey])

  const reload = () => setReloadKey((key) => key + 1)
  const closeEditor = useCallback(() => setEditor(null), [])

  const openEditor = (exercise?: Exercise) => {
    setEditor({ id: exercise?.id ?? null })
    setName(exercise?.name ?? '')
    setMuscleGroup(exercise?.muscle_group || MUSCLE_GROUPS[0])
    setVideoUrl(exercise?.video_url ?? '')
    setEditorError('')
  }

  const handleAddCatalog = async () => {
    setCatalogLoading(true)
    setFeedback(null)

    const existingNames = new Set(exercises.map((exercise) => normalizeName(exercise.name)))
    const missingExercises = baseExerciseCatalog.filter((exercise) => !existingNames.has(normalizeName(exercise.name)))

    if (missingExercises.length === 0) {
      setFeedback({ type: 'success', message: 'O catálogo base já está completo.' })
    } else {
      const { error } = await supabase.from('exercises').insert(missingExercises)
      if (error) {
        setFeedback({ type: 'error', message: `Não foi possível adicionar o catálogo: ${error.message}` })
      } else {
        setFeedback({ type: 'success', message: `${missingExercises.length} exercícios adicionados sem apagar os atuais.` })
        reload()
      }
    }
    setCatalogLoading(false)
  }

  const handleSaveExercise = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editor) return
    setEditorError('')

    const trimmedName = name.trim()
    const trimmedVideo = videoUrl.trim()
    if (!trimmedName) return setEditorError('Informe o nome do exercício.')
    if (trimmedVideo && !getExerciseMedia(trimmedVideo)) {
      return setEditorError('O link do vídeo precisa começar com https://')
    }
    const duplicate = exercises.find(
      (exercise) => exercise.id !== editor.id && normalizeName(exercise.name) === normalizeName(trimmedName),
    )
    if (duplicate) return setEditorError('Já existe um exercício com esse nome.')

    setSaving(true)
    const values = { name: trimmedName, muscle_group: muscleGroup, video_url: trimmedVideo || null }
    const { error } = editor.id
      ? await supabase.from('exercises').update(values).eq('id', editor.id)
      : await supabase.from('exercises').insert(values)
    setSaving(false)

    if (error) {
      setEditorError(`Não foi possível salvar: ${error.message}`)
      return
    }
    setEditor(null)
    setFeedback({ type: 'success', message: editor.id ? 'Exercício atualizado.' : 'Exercício criado.' })
    reload()
  }

  const term = search.trim().toLowerCase()
  const muscleOptions = [ALL, ...new Set([...MUSCLE_GROUPS, ...exercises.map((exercise) => exercise.muscle_group || 'Geral')])]
  const filteredExercises = exercises.filter((exercise) => {
    const muscle = exercise.muscle_group || 'Geral'
    const matchesMuscle = muscleFilter === ALL || muscle === muscleFilter
    const matchesSearch =
      !term || exercise.name.toLowerCase().includes(term) || muscle.toLowerCase().includes(term)
    return matchesMuscle && matchesSearch
  })

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wide">Biblioteca</h1>
          <p className="text-xs font-medium text-zinc-500">{exercises.length} exercícios disponíveis</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            onClick={handleAddCatalog}
            disabled={catalogLoading}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2.5 text-[10px] font-extrabold uppercase text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-50"
          >
            {catalogLoading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <LibraryBig className="h-4 w-4" aria-hidden="true" />
            )}
            Catálogo base
          </button>
          <button
            type="button"
            onClick={() => openEditor()}
            className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-extrabold uppercase text-black"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Novo
          </button>
        </div>
      </div>

      <FeedbackAlert feedback={feedback} />

      <div className="relative">
        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar exercício ou músculo..."
          aria-label="Buscar exercício"
          className={cn(inputClassName, 'py-3 pl-10 text-xs')}
        />
      </div>

      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" role="group" aria-label="Filtrar por músculo">
        {muscleOptions.map((muscle) => (
          <button
            key={muscle}
            type="button"
            aria-pressed={muscleFilter === muscle}
            onClick={() => setMuscleFilter(muscle)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase transition',
              muscleFilter === muscle
                ? 'border-white bg-white text-black'
                : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white',
            )}
          >
            {muscle}
          </button>
        ))}
      </div>

      {loading ? (
        <PageLoader label="Carregando biblioteca" />
      ) : loadError ? (
        <Alert variant="error">{loadError}</Alert>
      ) : filteredExercises.length === 0 ? (
        <div className="rounded-3xl border border-zinc-900 bg-zinc-950 p-8 text-center text-sm font-semibold text-zinc-400">
          {exercises.length === 0 ? 'Nenhum exercício cadastrado. Use o "Catálogo base".' : 'Nenhum exercício encontrado.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {filteredExercises.map((exercise) => (
            <li
              key={exercise.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-900 bg-zinc-950 p-3.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900">
                  <Dumbbell className="h-5 w-5 text-zinc-400" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-white">{exercise.name}</h3>
                  <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase text-zinc-500">
                    {exercise.muscle_group || 'Geral'}
                    {exercise.video_url && (
                      <span className="flex items-center gap-0.5 text-emerald-400">
                        <Video className="h-3 w-3" aria-hidden="true" /> vídeo
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openEditor(exercise)}
                aria-label={`Editar ${exercise.name}`}
                className="shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 p-2.5 text-emerald-400 hover:text-white"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editor !== null} onClose={closeEditor} title={editor?.id ? 'Editar exercício' : 'Criar exercício'}>
        <form onSubmit={handleSaveExercise} className="space-y-3">
          <div>
            <label htmlFor="exercise-name" className="mb-1 block text-xs font-semibold uppercase text-zinc-400">
              Nome do exercício
            </label>
            <input
              id="exercise-name"
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex: Supino inclinado com halteres"
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="exercise-muscle" className="mb-1 block text-xs font-semibold uppercase text-zinc-400">
              Grupo muscular
            </label>
            <select
              id="exercise-muscle"
              value={muscleGroup}
              onChange={(event) => setMuscleGroup(event.target.value)}
              className={inputClassName}
            >
              {[...new Set([...MUSCLE_GROUPS, muscleGroup])].map((muscle) => (
                <option key={muscle} value={muscle}>
                  {muscle}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="exercise-video" className="mb-1 block text-xs font-semibold uppercase text-zinc-400">
              Vídeo ou GIF (opcional)
            </label>
            <input
              id="exercise-video"
              type="url"
              inputMode="url"
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              placeholder="https://youtube.com/... ou link .mp4/.gif"
              className={inputClassName}
            />
          </div>

          {videoUrl.trim() && getExerciseMedia(videoUrl) && (
            <ExerciseMedia muscleGroup={muscleGroup} videoUrl={videoUrl} name={name} />
          )}

          {editorError && <Alert variant="error">{editorError}</Alert>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={closeEditor}
              className="w-1/2 rounded-xl bg-zinc-900 p-3 text-xs font-bold uppercase text-zinc-400"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex w-1/2 items-center justify-center rounded-xl bg-white p-3 text-xs font-extrabold uppercase text-black disabled:opacity-60"
            >
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-label="Salvando" /> : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
