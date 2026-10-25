'use client'

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { Check, Dumbbell, LoaderCircle, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { friendlyError } from '@/lib/errors'
import { EXERCISE_MEDIA_BASE } from '@/lib/exercises/media'
import {
  ANY,
  LIBRARY_PAGE_SIZE,
  equipmentOptions,
  loadExerciseLibrary,
  normalizeSearch,
  searchLibrary,
  type LibraryIndex,
  type LibraryItem,
} from '@/lib/exercises/library'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { ExerciseGif } from '@/components/workout/ExerciseGif'

type ExerciseLibrarySearchProps = {
  open: boolean
  onClose: () => void
  // "create": cria o exercício (nome, grupo e GIF); "link": só escolhe o GIF.
  mode: 'create' | 'link'
  // Nomes já cadastrados (normalizeSearch) para não criar repetido.
  existingNames: ReadonlySet<string>
  currentMediaId?: string | null
  // Devolve a mensagem de erro, ou null quando deu certo.
  onPick: (item: LibraryItem) => Promise<string | null> | string | null
  // Aviso no topo (ex.: falta rodar o supabase/exercicios.sql).
  notice?: ReactNode
}

const inputClassName =
  'w-full rounded-2xl border border-line-strong bg-black/40 p-3.5 text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none'
const labelClassName = 'mb-1.5 block text-xs font-black uppercase tracking-[0.1em] text-zinc-400'

export function ExerciseLibrarySearch(props: ExerciseLibrarySearchProps) {
  const { open, onClose, mode } = props
  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="sheet"
      title={mode === 'create' ? 'Buscar na biblioteca' : 'Vincular GIF'}
      description={mode === 'create' ? 'Exercícios prontos com nome em português' : 'Escolha o movimento deste exercício'}
    >
      {/* Montado só aberto: cada abertura começa com a busca limpa. */}
      {open && <LibraryBody {...props} />}
    </Modal>
  )
}

function LibraryBody({ mode, existingNames, currentMediaId, onPick, notice }: ExerciseLibrarySearchProps) {
  const ids = useId()
  const [library, setLibrary] = useState<LibraryIndex | null>(null)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [term, setTerm] = useState('')
  const [group, setGroup] = useState(ANY)
  const [equipment, setEquipment] = useState(ANY)
  const [visible, setVisible] = useState(LIBRARY_PAGE_SIZE)
  const [busy, setBusy] = useState<string | null>(null)
  const [pickError, setPickError] = useState('')
  const gifsOn = EXERCISE_MEDIA_BASE !== null

  useEffect(() => {
    let active = true
    loadExerciseLibrary()
      .then((index) => {
        if (active) setLibrary(index)
      })
      .catch((error) => {
        if (active) setLoadError(friendlyError(error, 'Não foi possível abrir a biblioteca'))
      })
    return () => {
      active = false
    }
  }, [attempt])

  const items = useMemo(() => library?.itens ?? [], [library])
  const equipments = useMemo(() => equipmentOptions(items, group), [items, group])
  const results = useMemo(() => searchLibrary(items, { term, group, equipment }), [items, term, group, equipment])
  const shown = results.slice(0, visible)

  const changeFilter = (apply: () => void) => {
    apply()
    setVisible(LIBRARY_PAGE_SIZE)
    setPickError('')
  }

  const pick = async (item: LibraryItem) => {
    setBusy(item.id)
    setPickError('')
    const error = await onPick(item)
    setBusy(null)
    if (error) setPickError(error)
  }

  if (loadError) {
    return (
      <Alert
        variant="error"
        onRetry={() => {
          setLoadError('')
          setAttempt((value) => value + 1)
        }}
      >
        {loadError}
      </Alert>
    )
  }
  if (!library) {
    return (
      <div className="grid grid-cols-2 gap-2.5" role="status" aria-label="Carregando a biblioteca">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-64 rounded-3xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {notice}

      <div>
        <label htmlFor={`${ids}-term`} className={labelClassName}>
          Nome do exercício
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <input
            id={`${ids}-term`}
            type="search"
            value={term}
            onChange={(event) => changeFilter(() => setTerm(event.target.value))}
            placeholder="Ex: supino, remada, agachamento..."
            autoComplete="off"
            className={cn(inputClassName, 'h-12 py-0 pl-11')}
          />
        </div>
      </div>

      <div role="radiogroup" aria-label="Grupo muscular" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {[{ grupo: ANY, total: library.total }, ...library.grupos].map(({ grupo, total }) => (
          <button
            key={grupo}
            type="button"
            role="radio"
            aria-checked={group === grupo}
            onClick={() =>
              changeFilter(() => {
                setGroup(grupo)
                setEquipment(ANY)
              })
            }
            className={cn(
              'flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold transition',
              group === grupo ? 'border-white bg-white text-black' : 'border-line bg-surface text-zinc-400 hover:text-white',
            )}
          >
            {grupo}
            <span className={cn('tabular-nums', group === grupo ? 'text-zinc-700' : 'text-zinc-500')}>{total}</span>
          </button>
        ))}
      </div>

      <div>
        <label htmlFor={`${ids}-equipment`} className={labelClassName}>
          Equipamento
        </label>
        <select
          id={`${ids}-equipment`}
          value={equipment}
          onChange={(event) => changeFilter(() => setEquipment(event.target.value))}
          className={cn(inputClassName, 'h-12 py-0')}
        >
          <option value={ANY}>Todos os equipamentos</option>
          {equipments.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs font-semibold text-zinc-400" aria-live="polite">
        {results.length === 0
          ? 'Nenhum exercício encontrado.'
          : `${results.length} ${results.length === 1 ? 'exercício encontrado' : 'exercícios encontrados'}${
              results.length > shown.length ? ` · mostrando ${shown.length}` : ''
            }`}
      </p>

      {pickError && <Alert variant="error">{pickError}</Alert>}

      {shown.length > 0 && (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" aria-label="Resultados da biblioteca">
          {shown.map((item) => {
            const exists = mode === 'create' && existingNames.has(normalizeSearch(item.nome))
            const current = mode === 'link' && currentMediaId === item.media
            return (
              <li key={item.id} className="flex flex-col rounded-3xl border border-line bg-surface p-2.5">
                {gifsOn ? (
                  <ExerciseGif mediaId={item.media} name={item.nome} />
                ) : (
                  <span aria-hidden="true" className="grid aspect-square w-full place-items-center rounded-2xl bg-black/40">
                    <Dumbbell className="h-8 w-8 text-zinc-600" />
                  </span>
                )}
                <h3 className="mt-2.5 px-1 text-[13px] font-bold leading-snug text-white">{item.nome}</h3>
                <p className="px-1 pt-1 text-xs text-zinc-400">
                  {item.grupo} · {item.equipamento}
                </p>
                <div className="mt-auto pt-2.5">
                  {exists || current ? (
                    <p className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-line text-xs font-bold text-zinc-300">
                      <Check className="h-4 w-4 text-brand" aria-hidden="true" />
                      {exists ? 'Já cadastrado' : 'GIF atual'}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void pick(item)}
                      disabled={busy !== null}
                      aria-label={mode === 'create' ? `Criar ${item.nome}` : `Usar este GIF: ${item.nome}`}
                      className="flex h-11 w-full items-center justify-center rounded-xl bg-white text-xs font-black uppercase tracking-wider text-black disabled:opacity-60"
                    >
                      {busy === item.id ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" aria-label="Salvando" />
                      ) : mode === 'create' ? (
                        'Criar'
                      ) : (
                        'Usar este GIF'
                      )}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {results.length > shown.length && (
        <button
          type="button"
          onClick={() => setVisible((value) => value + LIBRARY_PAGE_SIZE)}
          className="flex h-12 w-full items-center justify-center rounded-2xl border border-line-strong bg-white/[0.04] text-xs font-black uppercase tracking-wider text-white"
        >
          Mostrar mais {Math.min(LIBRARY_PAGE_SIZE, results.length - shown.length)}
        </button>
      )}
    </div>
  )
}
