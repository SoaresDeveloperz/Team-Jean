'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { Plus, Dumbbell, Search, Loader2, LibraryBig } from 'lucide-react'
import { ExerciseMedia } from '../../../components/workout/ExerciseMedia'
import { baseExerciseCatalog } from '../../../lib/exercises/catalog'

type Exercise = {
  id: string
  name: string
  muscle_group: string
  image_url?: string | null
  video_url?: string | null
}

export default function AdminExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)

  const [name, setName] = useState('')
  const [muscleGroup, setMuscleGroup] = useState('Peito')
  const [saving, setSaving] = useState(false)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [feedback, setFeedback] = useState('')

  const [supabase] = useState(() => createClient())

  const loadExercises = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .order('name', { ascending: true })

    if (data) setExercises(data)
    setLoading(false)
  }

  useEffect(() => {
    let active = true

    void supabase
      .from('exercises')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (!active) return
        if (data) setExercises(data as Exercise[])
        setLoading(false)
      }, () => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [supabase])

  const handleAddCatalog = async () => {
    setCatalogLoading(true)
    setFeedback('')

    const existingNames = new Set(
      exercises.map((exercise) => String(exercise.name).trim().toLowerCase()),
    )
    const missingExercises = baseExerciseCatalog.filter(
      (exercise) => !existingNames.has(exercise.name.toLowerCase()),
    )

    if (missingExercises.length === 0) {
      setFeedback('O catálogo base já está completo.')
      setCatalogLoading(false)
      return
    }

    const { error } = await supabase.from('exercises').insert(missingExercises)

    if (error) {
      setFeedback(`Não foi possível adicionar o catálogo: ${error.message}`)
    } else {
      setFeedback(`${missingExercises.length} exercícios adicionados sem apagar os atuais.`)
      await loadExercises()
    }

    setCatalogLoading(false)
  }

  const handleCreateExercise = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFeedback('')

    const { error } = await supabase.from('exercises').insert([
      { name: name.trim(), muscle_group: muscleGroup },
    ])

    if (!error) {
      setName('')
      setShowModal(false)
      await loadExercises()
    } else {
      setFeedback(`Não foi possível criar o exercício: ${error.message}`)
    }
    setSaving(false)
  }

  const filteredExercises = exercises.filter((ex) =>
    ex.name.toLowerCase().includes(search.toLowerCase()) ||
    ex.muscle_group.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wide">Biblioteca</h1>
          <p className="text-xs text-zinc-500 font-medium">Exercícios disponíveis</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            onClick={handleAddCatalog}
            disabled={catalogLoading}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2.5 text-[10px] font-extrabold uppercase text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-50"
          >
            {catalogLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LibraryBig className="h-4 w-4" />}
            Catálogo base
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-extrabold uppercase text-black"
          >
            <Plus className="h-4 w-4" /> Novo
          </button>
        </div>
      </div>

      {feedback && <p className="text-center text-xs font-semibold text-emerald-400">{feedback}</p>}

      {/* Busca */}
      <div className="relative">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar exercício ou músculo..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs text-white focus:outline-none focus:border-white"
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12 text-zinc-500">
          <Loader2 className="animate-spin w-8 h-8" />
        </div>
      ) : (
        <div className="space-y-2">
          {filteredExercises.map((ex) => (
            <div
              key={ex.id}
              className="space-y-3 rounded-2xl border border-zinc-900 bg-zinc-950 p-4"
            >
              <ExerciseMedia
                muscleGroup={ex.muscle_group}
              />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800">
                  <Dumbbell className="w-5 h-5 text-zinc-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{ex.name}</h3>
                  <p className="text-[10px] font-extrabold uppercase text-zinc-500">{ex.muscle_group}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Criar Exercício */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-black uppercase">Criar Exercício</h2>
            <form onSubmit={handleCreateExercise} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase block mb-1">Nome do Exercício</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Supino Inclinado com Halteres"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase block mb-1">Grupo Muscular</label>
                <select
                  value={muscleGroup}
                  onChange={(e) => setMuscleGroup(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white"
                >
                  <option value="Peito">Peito</option>
                  <option value="Costas">Costas</option>
                  <option value="Pernas">Pernas</option>
                  <option value="Ombros">Ombros</option>
                  <option value="Bíceps">Bíceps</option>
                  <option value="Tríceps">Tríceps</option>
                  <option value="Abdômen">Abdômen</option>
                </select>
              </div>

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