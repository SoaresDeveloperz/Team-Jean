'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ImagePlus, LoaderCircle, X } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import {
  COMMUNITY_BUCKET,
  CommunityError,
  MAX_PHOTOS,
  POST_MAX,
  compressImage,
  createPost,
  isAchievementMeta,
  isWorkoutMeta,
  signPhotoUrls,
  uploadPhotos,
  type FeedPost,
  type PostDraft,
} from '@/lib/community'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { Avatar } from '@/components/ui/avatar'
import { Modal, SheetFooter } from '@/components/ui/modal'
import { Switch } from '@/components/ui/switch'
import { AchievementShareCard, WorkoutShareCard } from './ShareCards'

type SelectedPhoto = { id: string; file: File; preview: string }

const MAX_FILE_BYTES = 25 * 1024 * 1024
const EMPTY_DRAFT: PostDraft = { kind: 'post', meta: null }
export const COMMUNITY_MISSING_MESSAGE =
  'A comunidade ainda não foi ativada. Treinador: rode o arquivo supabase/community.sql no SQL Editor do Supabase.'

const TITLES: Record<PostDraft['kind'], string> = {
  post: 'Novo post',
  workout: 'Postar treino',
  achievement: 'Postar conquista',
}

const PLACEHOLDERS: Record<PostDraft['kind'], string> = {
  post: 'O que está rolando no seu treino?',
  workout: 'Como foi o treino? Conte para a equipe...',
  achievement: 'Conta como foi chegar até aqui...',
}

type ComposerProps = {
  open: boolean
  onClose: () => void
  onPosted: (post: FeedPost) => void
  draft?: PostDraft
  // Treinador pode publicar já fixado no topo.
  canPin?: boolean
}

export function Composer({ open, onClose, onPosted, draft = EMPTY_DRAFT, canPin = false }: ComposerProps) {
  const [supabase] = useState(() => createClient())
  const bodyId = useId()
  const [author, setAuthor] = useState<{ id: string; name: string } | null>(null)
  const [body, setBody] = useState('')
  const [photos, setPhotos] = useState<SelectedPhoto[]>([])
  const [pinned, setPinned] = useState(false)
  const [error, setError] = useState('')
  const [stage, setStage] = useState<string | null>(null)
  const photosRef = useRef<SelectedPhoto[]>([])

  useEffect(() => {
    photosRef.current = photos
  }, [photos])

  // Libera as prévias (object URLs) se o componente sair da tela.
  useEffect(
    () => () => {
      for (const photo of photosRef.current) URL.revokeObjectURL(photo.preview)
    },
    [],
  )

  useEffect(() => {
    if (!open || author) return
    let active = true
    const load = async () => {
      const user = await getCurrentUser(supabase)
      if (!active || !user) return
      const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      if (!active) return
      const name = (data as { full_name?: string | null } | null)?.full_name?.trim()
      setAuthor({ id: user.id, name: name || 'Você' })
    }
    void load()
    return () => {
      active = false
    }
  }, [open, author, supabase])

  const reset = () => {
    for (const photo of photos) URL.revokeObjectURL(photo.preview)
    setPhotos([])
    setBody('')
    setPinned(false)
    setError('')
    setStage(null)
  }

  const close = () => {
    if (stage) return
    reset()
    onClose()
  }

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return
    setError('')
    const images = [...list].filter((file) => file.type.startsWith('image/'))
    const room = MAX_PHOTOS - photos.length
    const accepted: SelectedPhoto[] = []
    for (const file of images.slice(0, room)) {
      if (file.size > MAX_FILE_BYTES) {
        setError('Uma das fotos é grande demais (máximo de 25 MB).')
        continue
      }
      accepted.push({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) })
    }
    if (images.length < list.length) setError('Só dá para anexar imagens.')
    else if (images.length > room) setError(`Cada post aceita até ${MAX_PHOTOS} fotos.`)
    setPhotos((current) => [...current, ...accepted])
  }

  const removePhoto = (id: string) => {
    const photo = photos.find((item) => item.id === id)
    if (photo) URL.revokeObjectURL(photo.preview)
    setPhotos((current) => current.filter((item) => item.id !== id))
  }

  const canPublish = Boolean(author) && (body.trim().length > 0 || photos.length > 0 || draft.kind !== 'post')

  const publish = async () => {
    if (!author || !canPublish || stage) return
    setError('')
    try {
      const blobs: Blob[] = []
      for (const [index, photo] of photos.entries()) {
        setStage(`Preparando foto ${index + 1} de ${photos.length}`)
        try {
          blobs.push(await compressImage(photo.file))
        } catch {
          throw new CommunityError('Não consegui abrir uma das fotos. Tente uma imagem JPG ou PNG.')
        }
      }
      if (blobs.length > 0) setStage(`Enviando foto 1 de ${blobs.length}`)
      const paths = await uploadPhotos(supabase, author.id, blobs, (done, total) =>
        setStage(`Enviando foto ${Math.min(done + 1, total)} de ${total}`),
      )
      setStage('Publicando')
      let row
      try {
        row = await createPost(supabase, { userId: author.id, body, photos: paths, draft, pinned: canPin && pinned })
      } catch (postError) {
        if (paths.length > 0) await supabase.storage.from(COMMUNITY_BUCKET).remove(paths)
        throw postError
      }
      const urls = await signPhotoUrls(supabase, paths)
      onPosted({
        ...row,
        photos: paths,
        photoUrls: paths.map((path) => urls.get(path) ?? null),
        likeCount: 0,
        likedByMe: false,
        comments: [],
      })
      reset()
      onClose()
    } catch (publishError) {
      setStage(null)
      if (publishError instanceof CommunityError && publishError.missing) setError(COMMUNITY_MISSING_MESSAGE)
      else setError(publishError instanceof Error ? publishError.message : 'Não foi possível publicar.')
    }
  }

  return (
    <Modal open={open} onClose={close} variant="sheet" title={TITLES[draft.kind]} description="Visível para toda a equipe Team Jean.">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={author?.name} seed={author?.id} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{author?.name ?? 'Carregando...'}</p>
            <p className="text-[11px] text-zinc-500">Publicando na Comunidade</p>
          </div>
        </div>

        {isWorkoutMeta(draft.meta) && <WorkoutShareCard meta={draft.meta} />}
        {isAchievementMeta(draft.meta) && <AchievementShareCard meta={draft.meta} />}

        <div>
          <label htmlFor={bodyId} className="sr-only">
            Texto do post
          </label>
          <textarea
            id={bodyId}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={POST_MAX}
            rows={4}
            placeholder={PLACEHOLDERS[draft.kind]}
            className="max-h-72 min-h-28 w-full resize-none rounded-2xl border border-line-strong bg-black/40 p-4 leading-relaxed text-white placeholder:text-zinc-600 [field-sizing:content] focus:border-brand focus:outline-none"
          />
          <p aria-hidden="true" className="mt-1 text-right text-[10px] tabular-nums text-zinc-500">
            {body.length}/{POST_MAX}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <AnimatePresence initial={false}>
            {photos.map((photo, index) => (
              <m.div
                key={photo.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative aspect-square overflow-hidden rounded-2xl bg-surface-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) */}
                <img src={photo.preview} alt={`Foto ${index + 1} selecionada`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  disabled={Boolean(stage)}
                  aria-label={`Remover foto ${index + 1}`}
                  className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/75 text-white backdrop-blur"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </m.div>
            ))}
          </AnimatePresence>
          {photos.length < MAX_PHOTOS && (
            <label
              className={cn(
                'grid aspect-square cursor-pointer place-items-center rounded-2xl border border-dashed border-line-strong text-zinc-400 transition hover:border-brand/50 hover:text-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand',
                stage && 'pointer-events-none opacity-50',
              )}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={Boolean(stage)}
                onChange={(event) => {
                  addFiles(event.target.files)
                  event.target.value = ''
                }}
                className="sr-only"
              />
              <span className="flex flex-col items-center gap-1 text-[10px] font-bold">
                <ImagePlus className="h-6 w-6" aria-hidden="true" />
                <span>
                  <span className="sr-only">Adicionar </span>Foto
                </span>
              </span>
            </label>
          )}
        </div>

        {canPin && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">Fixar no topo</p>
              <p className="text-[11px] text-zinc-500">O post fica em destaque para todos os alunos.</p>
            </div>
            <Switch checked={pinned} onChange={setPinned} label="Fixar no topo" />
          </div>
        )}

        {error && <Alert variant="error">{error}</Alert>}
        <p className="sr-only" aria-live="polite">
          {stage ?? ''}
        </p>

        <SheetFooter>
          <m.button
            type="button"
            onClick={publish}
            disabled={!canPublish || Boolean(stage)}
            whileTap={{ scale: 0.98 }}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black uppercase tracking-[0.14em] text-black transition-colors disabled:bg-surface-3 disabled:text-zinc-400"
          >
            {stage ? (
              <>
                <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                <span className="text-xs normal-case tracking-normal">{stage}...</span>
              </>
            ) : (
              'Publicar'
            )}
          </m.button>
        </SheetFooter>
      </div>
    </Modal>
  )
}
