'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ImagePlus, LoaderCircle, MessageCircleHeart, Pin, PinOff, RefreshCw, Trash2 } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/client'
import {
  CommunityError,
  addComment,
  deleteComment,
  deletePost,
  isAdminRole,
  loadFeedPage,
  loadMembers,
  setLike,
  setPinned,
  type CommentRow,
  type CommunityMember,
  type FeedPost,
  type PostDraft,
} from '@/lib/community'
import { avatarUrlOf } from '@/lib/profile'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { Avatar } from '@/components/ui/avatar'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { Eyebrow } from '@/components/ui/tile'
import { ChallengesSection } from './ChallengesSection'
import { Composer } from './Composer'
import { LeaderboardCard } from './LeaderboardCard'
import { PhotoViewer } from './PhotoViewer'
import { PostCard } from './PostCard'

type Status = 'loading' | 'ready' | 'missing' | 'error'
type ViewerState = { open: boolean; photos: (string | null)[]; index: number; title: string }

const NEW_POST: PostDraft = { kind: 'post', meta: null }

// Fixados primeiro; depois do mais novo para o mais antigo.
function sortFeed(posts: FeedPost[]) {
  return [...posts].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at))
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : undefined)

export function CommunityScreen({ role }: { role: 'student' | 'admin' }) {
  const [supabase] = useState(() => createClient())
  const toast = useToast()
  const viewerIsAdmin = role === 'admin'

  const [viewerId, setViewerId] = useState<string | null>(null)
  const [members, setMembers] = useState<CommunityMember[]>([])
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [loadError, setLoadError] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const [composerOpen, setComposerOpen] = useState(false)
  const [viewer, setViewer] = useState<ViewerState>({ open: false, photos: [], index: 0, title: '' })
  const [menuPost, setMenuPost] = useState<FeedPost | null>(null)
  const [confirmPost, setConfirmPost] = useState<FeedPost | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Curtidas de um mesmo post vão em fila para o banco terminar no estado da tela.
  const likeQueue = useRef(new Map<string, Promise<void>>())

  useEffect(() => {
    let active = true

    const load = async () => {
      const user = await getCurrentUser(supabase)
      if (!active || !user) return
      setViewerId(user.id)
      const [feedResult, membersResult] = await Promise.allSettled([
        loadFeedPage(supabase, user.id, 0),
        loadMembers(supabase),
      ])
      if (!active) return
      setRefreshing(false)

      if (feedResult.status === 'rejected') {
        const error = feedResult.reason
        if (error instanceof CommunityError && error.missing) {
          setStatus('missing')
        } else {
          setLoadError(messageOf(error) ?? 'Não foi possível carregar a comunidade.')
          setStatus('error')
        }
        return
      }
      setPosts(feedResult.value.posts)
      setHasMore(feedResult.value.hasMore)
      setPage(0)
      // Sem ranking o feed funciona do mesmo jeito (só some o nível e o pódio).
      setMembers(membersResult.status === 'fulfilled' ? membersResult.value : [])
      setStatus('ready')
    }

    void load()
    return () => {
      active = false
    }
  }, [supabase, reloadKey])

  const workoutsById = useMemo(() => new Map(members.map((member) => [member.id, member.total_workouts])), [members])
  const avatarUrls = useMemo(() => new Map(members.map((member) => [member.id, avatarUrlOf(member)])), [members])
  const studentIds = useMemo(() => members.filter((member) => !isAdminRole(member.role)).map((member) => member.id), [members])
  const viewerName = members.find((member) => member.id === viewerId)?.full_name ?? null

  const refresh = () => {
    setRefreshing(true)
    setReloadKey((key) => key + 1)
  }

  const updatePost = useCallback((id: string, update: (post: FeedPost) => FeedPost) => {
    setPosts((list) => list.map((post) => (post.id === id ? update(post) : post)))
  }, [])

  const toggleLike = useCallback(
    (post: FeedPost) => {
      if (!viewerId) return
      const liked = !post.likedByMe
      haptic(liked ? [8, 40, 12] : 8)
      updatePost(post.id, (item) => ({
        ...item,
        likedByMe: liked,
        likeCount: Math.max(0, item.likeCount + (liked ? 1 : -1)),
      }))
      const previous = likeQueue.current.get(post.id) ?? Promise.resolve()
      const next = previous
        .then(() => setLike(supabase, post.id, viewerId, liked))
        .catch((error) => {
          updatePost(post.id, (item) => ({
            ...item,
            likedByMe: !liked,
            likeCount: Math.max(0, item.likeCount + (liked ? -1 : 1)),
          }))
          toast({ tone: 'error', title: 'Não foi possível dar fogo', description: messageOf(error) })
        })
      likeQueue.current.set(post.id, next)
    },
    [supabase, viewerId, updatePost, toast],
  )

  const openPhotos = useCallback((post: FeedPost, index: number) => {
    setViewer({ open: true, photos: post.photoUrls, index, title: `Post de ${post.author_name || 'Atleta'}` })
  }, [])

  const addCommentTo = useCallback(
    async (post: FeedPost, body: string) => {
      if (!viewerId) return false
      try {
        const created = await addComment(supabase, post.id, viewerId, body)
        updatePost(post.id, (item) => ({ ...item, comments: [...item.comments, created] }))
        return true
      } catch (error) {
        toast({ tone: 'error', title: 'Não foi possível comentar', description: messageOf(error) })
        return false
      }
    },
    [supabase, viewerId, updatePost, toast],
  )

  const removeComment = useCallback(
    async (post: FeedPost, comment: CommentRow) => {
      updatePost(post.id, (item) => ({ ...item, comments: item.comments.filter((entry) => entry.id !== comment.id) }))
      try {
        await deleteComment(supabase, comment.id)
      } catch (error) {
        updatePost(post.id, (item) => ({
          ...item,
          comments: [...item.comments, comment].sort((a, b) => a.created_at.localeCompare(b.created_at)),
        }))
        toast({ tone: 'error', title: 'Não foi possível apagar o comentário', description: messageOf(error) })
      }
    },
    [supabase, updatePost, toast],
  )

  const closeMenu = useCallback(() => setMenuPost(null), [])
  const closeComposer = useCallback(() => setComposerOpen(false), [])
  const closeViewer = useCallback(() => setViewer((state) => ({ ...state, open: false })), [])
  const changeViewerIndex = useCallback((index: number) => setViewer((state) => ({ ...state, index })), [])
  const closeConfirm = useCallback(() => {
    if (!deleting) setConfirmPost(null)
  }, [deleting])

  const handlePosted = useCallback(
    (post: FeedPost) => {
      setPosts((list) => sortFeed([post, ...list.filter((item) => item.id !== post.id)]))
      haptic([10, 30, 10])
      toast({ tone: 'success', title: 'Publicado na comunidade 🔥' })
    },
    [toast],
  )

  const togglePin = async () => {
    const post = menuPost
    if (!post) return
    setMenuPost(null)
    try {
      await setPinned(supabase, post.id, !post.pinned)
      setPosts((list) => sortFeed(list.map((item) => (item.id === post.id ? { ...item, pinned: !post.pinned } : item))))
      toast({ tone: 'success', title: post.pinned ? 'Post desafixado' : 'Post fixado no topo' })
    } catch (error) {
      toast({ tone: 'error', title: 'Não foi possível alterar', description: messageOf(error) })
    }
  }

  const confirmDelete = async () => {
    const post = confirmPost
    if (!post) return
    setDeleting(true)
    try {
      await deletePost(supabase, post)
      setPosts((list) => list.filter((item) => item.id !== post.id))
      toast({ tone: 'success', title: 'Post apagado' })
    } catch (error) {
      toast({ tone: 'error', title: 'Não foi possível apagar', description: messageOf(error) })
    } finally {
      setDeleting(false)
      setConfirmPost(null)
    }
  }

  const loadMore = async () => {
    if (!viewerId || loadingMore) return
    setLoadingMore(true)
    try {
      const next = await loadFeedPage(supabase, viewerId, page + 1)
      setPosts((list) => {
        const seen = new Set(list.map((post) => post.id))
        return [...list, ...next.posts.filter((post) => !seen.has(post.id))]
      })
      setPage((current) => current + 1)
      setHasMore(next.hasMore)
    } catch (error) {
      toast({ tone: 'error', title: 'Não foi possível carregar mais posts', description: messageOf(error) })
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <Eyebrow>Equipe Team Jean</Eyebrow>
          <h1 className="mt-1 font-display text-[2.75rem] font-bold uppercase leading-[0.9]">Comunidade</h1>
          <p className="mt-1.5 text-xs text-zinc-500">Treinos, conquistas e bastidores da equipe.</p>
        </div>
        {status === 'ready' && (
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            aria-label="Atualizar comunidade"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-line bg-surface text-zinc-300 transition hover:text-white"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden="true" />
          </button>
        )}
      </div>

      {status === 'loading' && (
        <div className="space-y-3" role="status" aria-label="Carregando comunidade">
          <Skeleton className="h-52 rounded-3xl" />
          <Skeleton className="h-16 rounded-3xl" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      )}

      {status === 'missing' && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line-strong p-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
            <MessageCircleHeart className="h-7 w-7" aria-hidden="true" />
          </span>
          {viewerIsAdmin ? (
            <>
              <p className="text-sm font-bold text-white">Ative a comunidade</p>
              <p className="text-xs leading-relaxed text-zinc-400">
                No Supabase, abra o SQL Editor e rode o arquivo <code className="text-brand">supabase/community.sql</code> (depois do{' '}
                <code className="text-brand">policies.sql</code>). Ele cria os posts, as fotos e o ranking.
              </p>
              <button
                type="button"
                onClick={refresh}
                className="mt-1 rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-black"
              >
                Já rodei, atualizar
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-white">A comunidade está chegando!</p>
              <p className="text-xs leading-relaxed text-zinc-400">
                Em breve você vai poder postar fotos, treinos e conquistas com a equipe.
              </p>
            </>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-3">
          <Alert variant="error">{loadError}</Alert>
          <button
            type="button"
            onClick={refresh}
            className="h-11 w-full rounded-2xl border border-line-strong text-xs font-bold text-zinc-200"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {status === 'ready' && viewerId && (
        <>
          <ChallengesSection viewerId={viewerId} viewerIsAdmin={viewerIsAdmin} studentIds={studentIds} refreshKey={reloadKey} />

          <LeaderboardCard members={members} viewerId={viewerId} viewerIsAdmin={viewerIsAdmin} />

          <m.button
            type="button"
            whileTap={{ scale: 0.99 }}
            onClick={() => setComposerOpen(true)}
            className="flex w-full items-center gap-3 rounded-3xl border border-line bg-surface p-3 text-left transition hover:border-line-strong"
          >
            <Avatar name={viewerName ?? (viewerIsAdmin ? 'Treinador' : 'Você')} seed={viewerId} src={avatarUrls.get(viewerId)} size="md" />
            <span className="min-w-0 flex-1 text-sm text-zinc-400">
              {viewerIsAdmin ? 'Escreva um recado ou poste uma foto para a equipe...' : 'Compartilhe um treino, uma foto ou uma conquista...'}
            </span>
            <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand text-black">
              <ImagePlus className="h-5 w-5" />
            </span>
          </m.button>

          {posts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-line-strong p-8 text-center">
              <MessageCircleHeart className="h-9 w-9 text-zinc-600" aria-hidden="true" />
              <p className="text-sm font-semibold text-zinc-300">Nenhum post ainda.</p>
              <p className="text-xs text-zinc-500">Seja o primeiro a mostrar o treino de hoje!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {posts.map((post) => (
                  <m.div
                    key={post.id}
                    layout="position"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                  >
                    <PostCard
                      post={post}
                      authorWorkouts={workoutsById.get(post.author_id) ?? null}
                      avatarUrls={avatarUrls}
                      viewerId={viewerId}
                      viewerIsAdmin={viewerIsAdmin}
                      onToggleLike={toggleLike}
                      onOpenPhotos={openPhotos}
                      onOpenMenu={setMenuPost}
                      onAddComment={addCommentTo}
                      onDeleteComment={removeComment}
                    />
                  </m.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line text-xs font-bold text-zinc-300 transition hover:border-line-strong hover:text-white"
            >
              {loadingMore && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Ver posts anteriores
            </button>
          )}
        </>
      )}

      <Composer open={composerOpen} onClose={closeComposer} onPosted={handlePosted} draft={NEW_POST} canPin={viewerIsAdmin} />

      <PhotoViewer
        open={viewer.open}
        photos={viewer.photos}
        index={viewer.index}
        title={viewer.title}
        onIndexChange={changeViewerIndex}
        onClose={closeViewer}
      />

      <Modal open={menuPost !== null} onClose={closeMenu} title="Opções do post" description={menuPost?.author_name ?? undefined}>
        <div className="space-y-2">
          {viewerIsAdmin && (
            <button
              type="button"
              onClick={togglePin}
              className="flex h-14 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 text-left text-sm font-bold text-white transition hover:border-line-strong"
            >
              {menuPost?.pinned ? (
                <PinOff className="h-5 w-5 text-gold" aria-hidden="true" />
              ) : (
                <Pin className="h-5 w-5 text-gold" aria-hidden="true" />
              )}
              {menuPost?.pinned ? 'Desafixar do topo' : 'Fixar no topo'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setConfirmPost(menuPost)
              setMenuPost(null)
            }}
            className="flex h-14 w-full items-center gap-3 rounded-2xl border border-danger/25 bg-danger-soft px-4 text-left text-sm font-bold text-danger transition hover:border-danger/50"
          >
            <Trash2 className="h-5 w-5" aria-hidden="true" /> Apagar post
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmPost !== null}
        title="Apagar post?"
        description="O post, as fotos, o fogo e os comentários saem da comunidade. Não dá para desfazer."
        confirmLabel="Apagar"
        busy={deleting}
        onConfirm={confirmDelete}
        onClose={closeConfirm}
      />
    </div>
  )
}
