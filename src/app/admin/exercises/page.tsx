'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { m } from 'framer-motion'
import { Dumbbell, Images, LibraryBig, LoaderCircle, Pencil, Play, Plus, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Exercise } from '@/lib/types'
import { MUSCLE_GROUPS } from '@/lib/workouts'
import { baseExerciseCatalog } from '@/lib/exercises/catalog'
import { plural } from '@/lib/text'
import { summarizeWork } from '@/lib/workout-summary'
import type { MuscleRegion } from '@/lib/muscles'
import { cn } from '@/lib/cn'
import { friendlyError } from '@/lib/errors'
import { Body3D } from '@/components/fitness/Body3D'
import { MuscleMap } from '@/components/fitness/MuscleMap'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { Eyebrow } from '@/components/ui/tile'
import { ExerciseMedia, getExerciseMedia } from '@/components/workout/ExerciseMedia'
import { ExerciseGif } from '@/components/workout/ExerciseGif'
import { ExerciseLibrarySearch } from '@/components/admin/ExerciseLibrarySearch'
import { EXERCISE_MEDIA_BASE, isValidMediaId } from '@/lib/exercises/media'
import { normalizeSearch, type LibraryItem } from '@/lib/exercises/library'

const ALL = 'Todos'
const GENERAL = 'Geral'
const inputClassName =
  'w-full rounded-2xl border border-line-strong bg-black/40 p-3.5 text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none'
const labelClassName = 'mb-1.5 block text-xs font-black uppercase tracking-[0.1em] text-zinc-400'
// GIFs ligados (NEXT_PUBLIC_EXERCISE_MEDIA_BASE_URL diferente de "off").
const GIFS_ON = EXERCISE_MEDIA_BASE !== null
const MEDIA_SETUP_MESSAGE = 'Para usar os GIFs da biblioteca, rode o arquivo supabase/exercicios.sql no Supabase.'

type SupabaseError = { code?: string; message?: string } | null

// Erro ao gravar: falta da coluna media_id vira o aviso de rodar o SQL.
function saveError(error: SupabaseError, prefix: string) {
  const text = `${error?.code ?? ''} ${error?.message ?? ''}`
  if (/media_id/.test(text) && /PGRST204|42703|schema cache|does not exist/.test(text)) return MEDIA_SETUP_MESSAGE
  if (/exercises_media_id_check/.test(text)) return 'O GIF escolhido é inválido. Escolha outro na biblioteca.'
  return friendlyError(error, prefix)
}

function normalizeName(name: string | null | undefined) {
  return String(name ?? '').trim().toLowerCase()
}

const normalizeText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

// Mapa de um exercício só: principal aceso e secundários (pelo nome) mais suaves.
function exerciseFills(name: string, muscle: string | null | undefined, secondary?: unknown) {
  return summarizeWork([{ name, muscle, secondary, sets: 1 }]).fills
}

// "principal" para a região mais trabalhada, "secundário" para as demais.
function roleDetails(fills: Partial<Record<MuscleRegion, string>>) {
  const details: Partial<Record<MuscleRegion, string>> = {}
  for (const [region, fill] of Object.entries(fills) as [MuscleRegion, string][]) {
    const alpha = Number(fill.match(/,\s*([\d.]+)\s*\)$/)?.[1] ?? 1)
    details[region] = alpha >= 0.99 ? 'principal' : 'secundário'
  }
  return details
}

export default function AdminExercisesPage() {
  const [supabase] = useState(() => createClient())
  const toast = useToast()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [search, setSearch] = useState('')
  const [muscleFilter, setMuscleFilter] = useState(ALL)
  const [catalogLoading, setCatalogLoading] = useState(false)
  // Busca na biblioteca: "create" (botão do topo) ou "link" (editor).
  const [libraryMode, setLibraryMode] = useState<'create' | 'link' | null>(null)

  const [detail, setDetail] = useState<Exercise | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  // ?novo=1 (atalho do treinador) já abre o cadastro.
  const [editor, setEditor] = useState<{ id: string | null } | null>(() => (searchParams.get('novo') === '1' ? { id: null } : null))
  const [name, setName] = useState('')
  const [muscleGroup, setMuscleGroup] = useState(MUSCLE_GROUPS[0])
  const [videoUrl, setVideoUrl] = useState('')
  const [mediaId, setMediaId] = useState<string | null>(null)
  const [originalMediaId, setOriginalMediaId] = useState<string | null>(null)
  const [editorError, setEditorError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true

    const load = async () => {
      const { data, error } = await supabase.from('exercises').select('*').order('name', { ascending: true })
      if (!active) return
      if (error) {
        setLoadError(friendlyError(error, 'Não foi possível carregar a biblioteca'))
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

  useEffect(() => {
    if (searchParams.get('novo')) router.replace(pathname, { scroll: false })
  }, [searchParams, router, pathname])

  const reload = () => setReloadKey((key) => key + 1)
  const closeEditor = useCallback(() => setEditor(null), [])
  const closeDetail = useCallback(() => setDetail(null), [])
  const closeLibrary = useCallback(() => setLibraryMode(null), [])

  const openEditor = (exercise?: Exercise) => {
    setEditor({ id: exercise?.id ?? null })
    setName(exercise?.name ?? '')
    setMuscleGroup(exercise?.muscle_group || MUSCLE_GROUPS[0])
    setVideoUrl(exercise?.video_url ?? '')
    setMediaId(exercise?.media_id ?? null)
    setOriginalMediaId(exercise?.media_id ?? null)
    setEditorError('')
  }

  // A coluna media_id existe? (null = não dá para saber: biblioteca vazia).
  const mediaColumn = exercises.length > 0 ? exercises.some((exercise) => 'media_id' in exercise) : null
  const existingNames = useMemo(() => new Set(exercises.map((exercise) => normalizeSearch(exercise.name))), [exercises])

  const createFromLibrary = async (item: LibraryItem) => {
    if (existingNames.has(normalizeSearch(item.nome))) {
      return `Já existe "${item.nome}" na sua biblioteca. Abra o exercício e toque em Vincular GIF.`
    }
    const values: { name: string; muscle_group: string; media_id?: string } = { name: item.nome, muscle_group: item.grupo }
    let withoutGif = mediaColumn === false
    let { error } = await supabase.from('exercises').insert(withoutGif ? values : { ...values, media_id: item.media })
    // Banco sem o exercicios.sql: cria sem o GIF e avisa o que falta rodar.
    if (error && !withoutGif && saveError(error, '') === MEDIA_SETUP_MESSAGE) {
      withoutGif = true
      ;({ error } = await supabase.from('exercises').insert(values))
    }
    if (error) return saveError(error, 'Não foi possível criar o exercício')
    setLibraryMode(null)
    toast({
      tone: 'success',
      title: 'Exercício criado',
      description: withoutGif ? `${item.nome}, ainda sem GIF. ${MEDIA_SETUP_MESSAGE}` : item.nome,
    })
    reload()
    return null
  }

  const linkFromLibrary = (item: LibraryItem) => {
    setMediaId(item.media)
    setLibraryMode(null)
    return null
  }

  const missingCatalog = useMemo(() => {
    const existing = new Set(exercises.map((exercise) => normalizeName(exercise.name)))
    return baseExerciseCatalog.filter((exercise) => !existing.has(normalizeName(exercise.name)))
  }, [exercises])

  const handleAddCatalog = async () => {
    if (missingCatalog.length === 0) return
    setCatalogLoading(true)
    // Com a coluna media_id, o catálogo já entra com o GIF de cada exercício.
    const rows = missingCatalog.map(({ name, muscle_group, media }) => ({
      name,
      muscle_group,
      ...(mediaColumn === true && media ? { media_id: media } : {}),
    }))
    const { error } = await supabase.from('exercises').insert(rows)
    setCatalogLoading(false)
    if (error) {
      toast({ tone: 'error', title: 'Não foi possível adicionar o catálogo', description: friendlyError(error) })
      return
    }
    toast({
      tone: 'success',
      title: 'Catálogo adicionado',
      description: `${plural(missingCatalog.length, 'exercício novo', 'exercícios novos')}, sem apagar os atuais.`,
    })
    reload()
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
    if (mediaId !== null && !isValidMediaId(mediaId)) return setEditorError('O GIF escolhido é inválido. Escolha outro na biblioteca.')
    const duplicate = exercises.find(
      (exercise) => exercise.id !== editor.id && normalizeName(exercise.name) === normalizeName(trimmedName),
    )
    if (duplicate) return setEditorError('Já existe um exercício com esse nome.')

    setSaving(true)
    // media_id só vai junto quando mudou: sem o exercicios.sql, editar o resto continua funcionando.
    const values = {
      name: trimmedName,
      muscle_group: muscleGroup,
      video_url: trimmedVideo || null,
      ...(mediaId !== originalMediaId ? { media_id: mediaId } : {}),
    }
    const { error } = editor.id
      ? await supabase.from('exercises').update(values).eq('id', editor.id)
      : await supabase.from('exercises').insert(values)
    setSaving(false)

    if (error) {
      setEditorError(saveError(error, 'Não foi possível salvar'))
      return
    }
    setEditor(null)
    toast({ tone: 'success', title: editor.id ? 'Exercício atualizado' : 'Exercício criado', description: trimmedName })
    reload()
  }

  const fillsById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof exerciseFills>>()
    for (const exercise of exercises) {
      map.set(exercise.id, exerciseFills(exercise.name, exercise.muscle_group, exercise.secondary_muscle))
    }
    return map
  }, [exercises])

  const muscleOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const exercise of exercises) {
      const muscle = exercise.muscle_group || GENERAL
      counts.set(muscle, (counts.get(muscle) ?? 0) + 1)
    }
    const known = MUSCLE_GROUPS.filter((muscle) => counts.has(muscle))
    const others = [...counts.keys()]
      .filter((muscle) => !MUSCLE_GROUPS.includes(muscle) && muscle !== GENERAL)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    const ordered = [...known, ...others, ...(counts.has(GENERAL) ? [GENERAL] : [])]
    return [{ muscle: ALL, count: exercises.length }, ...ordered.map((muscle) => ({ muscle, count: counts.get(muscle) ?? 0 }))]
  }, [exercises])

  const term = normalizeText(search.trim())
  const filteredExercises = exercises.filter((exercise) => {
    const muscle = exercise.muscle_group || GENERAL
    const matchesMuscle = muscleFilter === ALL || muscle === muscleFilter
    return matchesMuscle && (!term || normalizeText(`${exercise.name} ${muscle}`).includes(term))
  })

  const withVideo = exercises.filter((exercise) => exercise.video_url).length
  const withGif = exercises.filter((exercise) => isValidMediaId(exercise.media_id)).length
  const editorFills = useMemo(() => exerciseFills(name, muscleGroup), [name, muscleGroup])
  const groupOptions = [...new Set([...MUSCLE_GROUPS, muscleGroup])]

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <Eyebrow>Biblioteca</Eyebrow>
          <h1 className="mt-1 font-display text-[2.75rem] font-bold uppercase leading-[0.9]">Exercícios</h1>
          {!loading && (
            <p className="mt-1.5 text-xs text-zinc-500">
              {plural(exercises.length, 'exercício', 'exercícios')} · {withVideo} com vídeo
              {GIFS_ON && mediaColumn && ` · ${withGif} com GIF`}
            </p>
          )}
        </div>
        <m.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={() => openEditor()}
          className="flex h-11 items-center gap-1.5 rounded-2xl bg-white px-4 text-xs font-black uppercase tracking-wider text-black"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>
            Novo<span className="sr-only"> exercício</span>
          </span>
        </m.button>
      </div>

      <button
        type="button"
        onClick={() => setLibraryMode('create')}
        className="flex min-h-14 w-full items-center gap-3.5 rounded-3xl border border-line bg-surface p-3 text-left transition hover:border-line-strong"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand text-black">
          <Images className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-white">Buscar na biblioteca</span>
          <span className="block text-xs leading-snug text-zinc-400">
            1.324 exercícios prontos{GIFS_ON ? ', com GIF do movimento' : ''}
          </span>
        </span>
        <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
      </button>

      {GIFS_ON && !loading && !loadError && mediaColumn === false && <Alert variant="info">GIFs dos exercícios: {MEDIA_SETUP_MESSAGE}</Alert>}

      {!loading && !loadError && missingCatalog.length > 0 && (
        <div className="flex items-center gap-3.5 rounded-3xl border border-gold/25 bg-gold-soft p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold text-black">
            <LibraryBig className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">Catálogo base</p>
            <p className="text-xs leading-snug text-zinc-300">
              {plural(missingCatalog.length, 'exercício pronto', 'exercícios prontos')} para completar a biblioteca, sem
              apagar os atuais.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddCatalog}
            disabled={catalogLoading}
            className="grid h-10 shrink-0 place-items-center rounded-xl bg-white px-3.5 text-xs font-black uppercase tracking-wider text-black disabled:opacity-60"
          >
            {catalogLoading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-label="Adicionando" /> : 'Adicionar'}
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar exercício ou músculo..."
          aria-label="Buscar exercício"
          className={cn(inputClassName, 'h-12 py-0 pl-11')}
        />
      </div>

      {muscleOptions.length > 2 && (
        <div role="radiogroup" aria-label="Filtrar por grupo muscular" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {muscleOptions.map(({ muscle, count }) => (
            <button
              key={muscle}
              type="button"
              role="radio"
              aria-checked={muscleFilter === muscle}
              onClick={() => setMuscleFilter(muscle)}
              className={cn(
                'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold transition',
                muscleFilter === muscle ? 'border-white bg-white text-black' : 'border-line bg-surface text-zinc-400 hover:text-white',
              )}
            >
              {muscle}
              <span className={cn('tabular-nums', muscleFilter === muscle ? 'text-zinc-700' : 'text-zinc-500')}>{count}</span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4" role="status" aria-label="Carregando biblioteca">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-52 rounded-3xl" />
          ))}
        </div>
      ) : loadError ? (
        <Alert
          variant="error"
          onRetry={() => {
            setLoading(true)
            reload()
          }}
        >
          {loadError}
        </Alert>
      ) : filteredExercises.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line-strong p-8 text-center">
          <Dumbbell className="h-9 w-9 text-zinc-600" aria-hidden="true" />
          <p className="text-sm font-semibold text-zinc-300">
            {exercises.length === 0 ? 'Nenhum exercício cadastrado ainda.' : 'Nenhum exercício encontrado.'}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {filteredExercises.map((exercise, index) => {
            const hasVideo = Boolean(exercise.video_url)
            const hasGif = GIFS_ON && isValidMediaId(exercise.media_id)
            return (
              <m.li
                key={exercise.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-24px' }}
                transition={{ type: 'spring', stiffness: 300, damping: 28, delay: (index % 2) * 0.05 }}
              >
                <button
                  type="button"
                  onClick={() => setDetail(exercise)}
                  className="flex h-full w-full flex-col rounded-3xl border border-line bg-surface p-2.5 text-left transition hover:border-line-strong active:scale-[0.98]"
                >
                  <span className="sr-only">Ver o modelo 3D de </span>
                  <span aria-hidden="true" className="relative block rounded-2xl bg-black/40 px-2 py-2.5">
                    <MuscleMap fills={fillsById.get(exercise.id) ?? {}} animated={false} />
                    {hasVideo && (
                      <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-brand text-black">
                        <Play className="h-3 w-3 fill-current" />
                      </span>
                    )}
                    {hasGif && (
                      <span className="absolute left-2 top-2 rounded-full bg-gold px-1.5 py-0.5 text-xs font-black leading-none text-black">
                        GIF
                      </span>
                    )}
                  </span>
                  <span className="mt-2.5 line-clamp-2 px-1 text-[13px] font-bold leading-snug text-white">{exercise.name}</span>
                  <span className="mt-auto px-1 pb-0.5 pt-1.5 text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
                    {exercise.muscle_group || GENERAL}
                    {hasVideo && <span className="sr-only">, com vídeo</span>}
                    {hasGif && <span className="sr-only">, com GIF</span>}
                  </span>
                </button>
              </m.li>
            )
          })}
        </ul>
      )}

      <Modal
        open={detail !== null}
        onClose={closeDetail}
        variant="sheet"
        title={detail?.name ?? ''}
        description={detail ? `${detail.muscle_group || GENERAL} · modelo do exercício` : undefined}
      >
        {detail && (
          <div className="space-y-4">
            <Body3D
              fills={fillsById.get(detail.id) ?? {}}
              details={roleDetails(fillsById.get(detail.id) ?? {})}
              label={`Músculos trabalhados em ${detail.name}`}
              heightClassName="h-[26rem]"
            />
            {GIFS_ON && isValidMediaId(detail.media_id) && <ExerciseGif key={detail.media_id} mediaId={detail.media_id} name={detail.name} />}
            {detail.video_url && getExerciseMedia(detail.video_url) && (
              <ExerciseMedia muscleGroup={detail.muscle_group} videoUrl={detail.video_url} name={detail.name} />
            )}
            <m.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setDetail(null)
                openEditor(detail)
              }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line-strong bg-white/[0.04] text-xs font-black uppercase tracking-wider text-white"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" /> Editar exercício
            </m.button>
          </div>
        )}
      </Modal>

      <Modal open={editor !== null} onClose={closeEditor} title={editor?.id ? 'Editar exercício' : 'Novo exercício'}>
        <form onSubmit={handleSaveExercise} className="space-y-4">
          <div>
            <label htmlFor="exercise-name" className={labelClassName}>
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

          <fieldset>
            <legend className={labelClassName}>Grupo muscular</legend>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {groupOptions.map((muscle) => (
                  <label
                    key={muscle}
                    className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:text-white has-[:checked]:border-white has-[:checked]:bg-white has-[:checked]:text-black has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand"
                  >
                    <input
                      type="radio"
                      name="exercise-muscle"
                      value={muscle}
                      checked={muscleGroup === muscle}
                      onChange={() => setMuscleGroup(muscle)}
                      className="sr-only"
                    />
                    {muscle}
                  </label>
                ))}
              </div>
              {/* Prévia ao vivo: os músculos acendem conforme o grupo e o nome. */}
              <Body3D fills={editorFills} label="Prévia 3D dos músculos trabalhados" heightClassName="h-60" showChips={false} />
            </div>
          </fieldset>

          {GIFS_ON && (
            <div>
              <p className={labelClassName}>GIF da biblioteca (opcional)</p>
              {mediaColumn === false ? (
                <Alert variant="info">{MEDIA_SETUP_MESSAGE}</Alert>
              ) : (
                <div className="space-y-2.5">
                  {mediaId && <ExerciseGif key={mediaId} mediaId={mediaId} name={name} />}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setLibraryMode('link')}
                      className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-line-strong bg-white/[0.04] text-xs font-black uppercase tracking-wider text-white"
                    >
                      <Images className="h-4 w-4" aria-hidden="true" /> {mediaId ? 'Trocar GIF' : 'Vincular GIF'}
                    </button>
                    {mediaId && (
                      <button
                        type="button"
                        onClick={() => setMediaId(null)}
                        className="flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-line-strong px-3.5 text-xs font-black uppercase tracking-wider text-zinc-200"
                      >
                        <X className="h-4 w-4" aria-hidden="true" /> Tirar GIF
                      </button>
                    )}
                  </div>
                  {mediaId && videoUrl.trim() && (
                    <p className="text-xs leading-snug text-zinc-400">No treino, o aluno vê o seu vídeo; o GIF aparece quando não houver vídeo.</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label htmlFor="exercise-video" className={labelClassName}>
              Link de vídeo próprio (opcional)
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

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={closeEditor}
              className="h-12 rounded-2xl border border-line-strong text-xs font-black uppercase tracking-wider text-zinc-200"
            >
              Cancelar
            </button>
            <m.button
              type="submit"
              disabled={saving}
              whileTap={{ scale: 0.97 }}
              className="flex h-12 items-center justify-center rounded-2xl bg-white text-xs font-black uppercase tracking-wider text-black disabled:opacity-60"
            >
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-label="Salvando" /> : 'Salvar'}
            </m.button>
          </div>
        </form>
      </Modal>

      <ExerciseLibrarySearch
        open={libraryMode !== null}
        onClose={closeLibrary}
        mode={libraryMode ?? 'create'}
        existingNames={existingNames}
        currentMediaId={mediaId}
        onPick={libraryMode === 'link' ? linkFromLibrary : createFromLibrary}
        notice={
          GIFS_ON && mediaColumn === false && libraryMode === 'create' ? (
            <Alert variant="info">Os exercícios entram sem GIF até você rodar o supabase/exercicios.sql no Supabase.</Alert>
          ) : undefined
        }
      />
    </div>
  )
}
