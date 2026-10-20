'use client'

import { memo, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Ellipsis, Flame, LoaderCircle, MessageCircle, Pin, SendHorizontal, Trash2 } from 'lucide-react'
import {
  COMMENT_MAX,
  isAchievementMeta,
  isAdminRole,
  isWorkoutMeta,
  timeAgo,
  type CommentRow,
  type FeedPost,
} from '@/lib/community'
import { plural } from '@/lib/text'
import { cn } from '@/lib/cn'
import { Avatar } from '@/components/ui/avatar'
import { CoachBadge, LevelBadge } from './LevelBadge'
import { PhotoGrid } from './PhotoGrid'
import { AchievementShareCard, WorkoutShareCard } from './ShareCards'

type PostCardProps = {
  post: FeedPost
  // Treinos concluídos do autor (nível); null quando o ranking não carregou.
  authorWorkouts: number | null
  viewerId: string
  viewerIsAdmin: boolean
  onToggleLike: (post: FeedPost) => void
  onOpenPhotos: (post: FeedPost, index: number) => void
  onOpenMenu: (post: FeedPost) => void
  onAddComment: (post: FeedPost, body: string) => Promise<boolean>
  onDeleteComment: (post: FeedPost, comment: CommentRow) => void
}

const KIND_LABEL: Record<FeedPost['kind'], string> = {
  post: '',
  workout: 'concluiu um treino',
  achievement: 'desbloqueou uma conquista',
}
const BODY_PREVIEW = 280
const COMMENTS_PREVIEW = 2

// Faíscas que saem da chama ao dar fogo.
function Sparks() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <m.span
          key={angle}
          className="absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-full bg-gold"
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: Math.cos((angle * Math.PI) / 180) * 17,
            y: Math.sin((angle * Math.PI) / 180) * 17,
            opacity: 0,
            scale: 0.3,
          }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        />
      ))}
    </span>
  )
}

export const PostCard = memo(function PostCard({
  post,
  authorWorkouts,
  viewerId,
  viewerIsAdmin,
  onToggleLike,
  onOpenPhotos,
  onOpenMenu,
  onAddComment,
  onDeleteComment,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showAllComments, setShowAllComments] = useState(false)
  const [commenting, setCommenting] = useState(false)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [sparks, setSparks] = useState(0)

  const author = post.author_name || 'Atleta'
  const headingId = `post-${post.id}-author`
  const commentInputId = `comment-${post.id}`
  const canManage = viewerIsAdmin || post.author_id === viewerId
  const longBody = (post.body?.length ?? 0) > BODY_PREVIEW
  const visibleComments = showAllComments ? post.comments : post.comments.slice(-COMMENTS_PREVIEW)
  const hiddenComments = post.comments.length - visibleComments.length
  const showComments = commenting || post.comments.length > 0

  const like = () => {
    if (!post.likedByMe) setSparks((value) => value + 1)
    onToggleLike(post)
  }

  // Toque duplo só dá fogo; nunca tira.
  const likeFromPhoto = () => {
    if (!post.likedByMe) onToggleLike(post)
  }

  const openComment = () => {
    setCommenting(true)
    window.requestAnimationFrame(() => document.getElementById(commentInputId)?.focus())
  }

  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault()
    const text = comment.trim()
    if (!text || sending) return
    setSending(true)
    const ok = await onAddComment(post, text)
    setSending(false)
    if (ok) setComment('')
  }

  return (
    <article aria-labelledby={headingId} className="overflow-hidden rounded-3xl border border-line bg-surface">
      {post.pinned && (
        <p className="flex items-center gap-1.5 border-b border-gold/20 bg-gold-soft px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-gold">
          <Pin className="h-3.5 w-3.5" aria-hidden="true" /> Fixado pelo treinador
        </p>
      )}

      <header className="flex items-center gap-3 p-4 pb-3">
        <Avatar name={author} seed={post.author_id} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 id={headingId} className="truncate text-sm font-bold text-white">
              {author}
            </h3>
            {isAdminRole(post.author_role) ? (
              <CoachBadge />
            ) : (
              authorWorkouts !== null && <LevelBadge workouts={authorWorkouts} />
            )}
          </div>
          <p className="truncate text-[11px] text-zinc-500">
            <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
            {KIND_LABEL[post.kind] && ` · ${KIND_LABEL[post.kind]}`}
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => onOpenMenu(post)}
            aria-label={`Opções do post de ${author}`}
            className="-mr-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            <Ellipsis className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </header>

      {post.body && (
        <div className="px-4 pb-3">
          <p
            className={cn(
              'whitespace-pre-line break-words text-[15px] leading-relaxed text-zinc-100',
              longBody && !expanded && 'line-clamp-5',
            )}
          >
            {post.body}
          </p>
          {longBody && !expanded && (
            <button type="button" onClick={() => setExpanded(true)} className="mt-1 text-xs font-bold text-zinc-400 hover:text-white">
              ver mais
            </button>
          )}
        </div>
      )}

      {isWorkoutMeta(post.meta) && <WorkoutShareCard meta={post.meta} className="mx-4 mb-3" />}
      {isAchievementMeta(post.meta) && <AchievementShareCard meta={post.meta} className="mx-4 mb-3" />}

      {post.photoUrls.length > 0 && (
        <PhotoGrid urls={post.photoUrls} onOpen={(index) => onOpenPhotos(post, index)} onDoubleTap={likeFromPhoto} />
      )}

      <div className="flex items-center gap-1 px-2 py-1.5">
        <m.button
          type="button"
          whileTap={{ scale: 0.88 }}
          aria-pressed={post.likedByMe}
          onClick={like}
          className={cn(
            'flex h-11 items-center gap-1.5 rounded-2xl px-3 text-sm font-bold tabular-nums transition-colors',
            post.likedByMe ? 'text-gold' : 'text-zinc-400 hover:text-white',
          )}
        >
          <span className="relative grid place-items-center">
            <m.span
              key={sparks}
              initial={false}
              animate={sparks > 0 && post.likedByMe ? { scale: [1, 1.4, 1] } : { scale: 1 }}
              transition={{ duration: 0.35 }}
              className="grid"
            >
              <Flame className={cn('h-5 w-5', post.likedByMe && 'fill-current')} aria-hidden="true" />
            </m.span>
            {sparks > 0 && <Sparks key={`sparks-${sparks}`} />}
          </span>
          <span className="sr-only">Dar fogo · </span>
          {post.likeCount}
        </m.button>
        <button
          type="button"
          onClick={openComment}
          className="flex h-11 items-center gap-1.5 rounded-2xl px-3 text-sm font-bold tabular-nums text-zinc-400 transition-colors hover:text-white"
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Comentar · </span>
          {post.comments.length}
        </button>
      </div>

      {showComments && (
        <div className="space-y-2.5 border-t border-line px-4 py-3">
          {hiddenComments > 0 && (
            <button
              type="button"
              onClick={() => setShowAllComments(true)}
              className="text-xs font-bold text-zinc-400 hover:text-white"
            >
              Ver os {plural(post.comments.length, 'comentário', 'comentários')}
            </button>
          )}
          {visibleComments.length > 0 && (
            <ul className="space-y-2.5" aria-label={`Comentários do post de ${author}`}>
              <AnimatePresence initial={false}>
                {visibleComments.map((item) => {
                  const name = item.author_name || 'Atleta'
                  return (
                    <m.li
                      key={item.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-start gap-2.5"
                    >
                      <Avatar name={name} seed={item.author_id} size="xs" className="mt-1" />
                      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-white/[0.05] px-3 py-2">
                        <p className="flex min-w-0 items-center gap-1.5 text-xs">
                          <span className="truncate font-bold text-white">{name}</span>
                          {isAdminRole(item.author_role) && <CoachBadge />}
                          <time dateTime={item.created_at} className="shrink-0 text-[10px] text-zinc-500">
                            {timeAgo(item.created_at)}
                          </time>
                        </p>
                        <p className="mt-0.5 whitespace-pre-line break-words text-[13px] leading-relaxed text-zinc-200">{item.body}</p>
                      </div>
                      {(viewerIsAdmin || item.author_id === viewerId) && (
                        <button
                          type="button"
                          onClick={() => onDeleteComment(post, item)}
                          aria-label={`Apagar comentário de ${name}`}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-danger-soft hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </m.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          )}
          <form onSubmit={submitComment} className="flex items-center gap-2">
            <label htmlFor={commentInputId} className="sr-only">
              Escreva um comentário
            </label>
            <input
              id={commentInputId}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={COMMENT_MAX}
              placeholder="Escreva um comentário..."
              enterKeyHint="send"
              autoComplete="off"
              className="h-11 min-w-0 flex-1 rounded-2xl border border-line bg-black/40 px-4 text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none"
            />
            <button
              type="submit"
              disabled={!comment.trim() || sending}
              aria-label="Enviar comentário"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand text-black transition-colors disabled:bg-surface-3 disabled:text-zinc-500"
            >
              {sending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <SendHorizontal className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </form>
        </div>
      )}
    </article>
  )
})
