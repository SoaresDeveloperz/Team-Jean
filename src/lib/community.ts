// Comunidade: posts com fotos, fogo (curtidas), comentários e ranking.
// As tabelas, o bucket e as permissões ficam em supabase/community.sql.
import { REGION_LABELS, type MuscleRegion } from './muscles'
import type { createClient } from './supabase/client'

type Supabase = ReturnType<typeof createClient>
type DbError = { code?: string; message?: string } | null | undefined

export const COMMUNITY_BUCKET = 'community'
export const PAGE_SIZE = 10
export const MAX_PHOTOS = 4
export const POST_MAX = 2000
export const COMMENT_MAX = 1000
// Links das fotos são temporários (bucket privado).
const SIGNED_URL_SECONDS = 6 * 60 * 60

export type PostKind = 'post' | 'workout' | 'achievement'

export type WorkoutMeta = {
  name: string
  volume: number
  sets: number
  minutes: number | null
  rpe: number | null
  prs: { name: string; weight: number; reps: number }[]
  // Intensidade 0..1 por região do mapa muscular.
  regions: Partial<Record<MuscleRegion, number>>
}

export type AchievementMeta = { title: string; description: string; icon: string; goal: number }

export type PostRow = {
  id: string
  author_id: string
  author_name: string | null
  author_role: string | null
  kind: PostKind
  body: string | null
  photos: string[] | null
  meta: WorkoutMeta | AchievementMeta | null
  pinned: boolean
  created_at: string
}

export type CommentRow = {
  id: string
  post_id: string
  author_id: string
  author_name: string | null
  author_role: string | null
  body: string
  created_at: string
}

export type FeedPost = PostRow & {
  photoUrls: (string | null)[]
  likeCount: number
  likedByMe: boolean
  comments: CommentRow[]
}

export type CommunityMember = {
  id: string
  full_name: string
  role: string
  // Vem do community_members() atualizado (profile.sql/community.sql).
  avatar_path?: string | null
  total_workouts: number
  week_workouts: number
}

export type PostDraft = { kind: PostKind; meta: WorkoutMeta | AchievementMeta | null }

// Sem o supabase/community.sql, o Supabase responde "tabela/função/bucket não existe".
export function isCommunityMissing(error: DbError) {
  if (!error) return false
  if (['PGRST205', 'PGRST202', '42P01', '42883'].includes(error.code ?? '')) return true
  return /schema cache|does not exist|bucket not found/i.test(error.message ?? '')
}

export class CommunityError extends Error {
  readonly missing: boolean

  constructor(message: string, missing = false) {
    super(message)
    this.missing = missing
  }
}

function fail(prefix: string, error: NonNullable<DbError>): never {
  throw new CommunityError(`${prefix}: ${error.message ?? 'erro desconhecido'}`, isCommunityMissing(error))
}

export const isAdminRole = (role: string | null | undefined) => (role ?? '').trim().toLowerCase() === 'admin'

// O meta é JSON gravado pelo próprio aluno: na leitura ele é normalizado para o
// formato esperado, então um registro malformado não quebra o feed de todos.
const asNumber = (value: unknown) => {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : 0
}
const asText = (value: unknown, fallback: string, max = 120) =>
  (typeof value === 'string' && value.trim() ? value.trim() : fallback).slice(0, max)
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export function sanitizeMeta(kind: PostKind, meta: unknown): PostRow['meta'] {
  if (!isRecord(meta)) return null
  if (kind === 'workout') {
    const regions: WorkoutMeta['regions'] = {}
    if (isRecord(meta.regions)) {
      for (const [region, value] of Object.entries(meta.regions)) {
        if (region in REGION_LABELS) regions[region as MuscleRegion] = Math.min(1, Math.max(0, asNumber(value)))
      }
    }
    return {
      name: asText(meta.name, 'Treino', 80),
      volume: Math.max(0, asNumber(meta.volume)),
      sets: Math.max(0, Math.round(asNumber(meta.sets))),
      minutes: meta.minutes == null ? null : Math.max(0, Math.round(asNumber(meta.minutes))),
      rpe: meta.rpe == null ? null : Math.min(10, Math.max(0, asNumber(meta.rpe))),
      prs: (Array.isArray(meta.prs) ? meta.prs : [])
        .filter(isRecord)
        .slice(0, 10)
        .map((record) => ({ name: asText(record.name, 'Exercício', 80), weight: asNumber(record.weight), reps: asNumber(record.reps) })),
      regions,
    }
  }
  if (kind === 'achievement') {
    return {
      title: asText(meta.title, 'Conquista', 60),
      description: asText(meta.description, '', 160),
      icon: asText(meta.icon, 'award', 20),
      goal: asNumber(meta.goal),
    }
  }
  return null
}

export function isWorkoutMeta(meta: PostRow['meta']): meta is WorkoutMeta {
  return Boolean(meta && typeof meta === 'object' && 'sets' in meta && 'volume' in meta)
}

export function isAchievementMeta(meta: PostRow['meta']): meta is AchievementMeta {
  return Boolean(meta && typeof meta === 'object' && 'title' in meta && 'goal' in meta)
}

export function timeAgo(iso: string, now = Date.now()) {
  const minutes = Math.floor(Math.max(0, now - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------
export async function signPhotoUrls(supabase: Supabase, paths: string[]) {
  const urls = new Map<string, string>()
  const unique = [...new Set(paths)]
  if (unique.length === 0) return urls
  const { data, error } = await supabase.storage.from(COMMUNITY_BUCKET).createSignedUrls(unique, SIGNED_URL_SECONDS)
  // Sem link a foto aparece como indisponível; o post continua legível.
  if (error || !data) return urls
  for (const item of data) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl)
  }
  return urls
}

async function hydratePosts(supabase: Supabase, userId: string, rows: PostRow[]): Promise<FeedPost[]> {
  if (rows.length === 0) return []
  const ids = rows.map((row) => row.id)
  const [likesResult, commentsResult, urls] = await Promise.all([
    supabase.from('community_likes').select('post_id, user_id').in('post_id', ids),
    supabase.from('community_comments').select('*').in('post_id', ids).order('created_at', { ascending: true }),
    signPhotoUrls(
      supabase,
      rows.flatMap((row) => row.photos ?? []),
    ),
  ])
  if (likesResult.error) fail('Não foi possível carregar o fogo dos posts', likesResult.error)
  if (commentsResult.error) fail('Não foi possível carregar os comentários', commentsResult.error)

  const likes = (likesResult.data ?? []) as { post_id: string; user_id: string }[]
  const comments = (commentsResult.data ?? []) as CommentRow[]
  return rows.map((row) => ({
    ...row,
    meta: sanitizeMeta(row.kind, row.meta),
    photos: row.photos ?? [],
    photoUrls: (row.photos ?? []).map((path) => urls.get(path) ?? null),
    likeCount: likes.filter((like) => like.post_id === row.id).length,
    likedByMe: likes.some((like) => like.post_id === row.id && like.user_id === userId),
    comments: comments.filter((comment) => comment.post_id === row.id),
  }))
}

export async function loadFeedPage(supabase: Supabase, userId: string, page: number) {
  const from = page * PAGE_SIZE
  // Pede um a mais para saber se há outra página.
  const { data, error } = await supabase
    .from('community_posts')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE)
  if (error) fail('Não foi possível carregar a comunidade', error)
  const rows = (data ?? []) as PostRow[]
  return {
    posts: await hydratePosts(supabase, userId, rows.slice(0, PAGE_SIZE)),
    hasMore: rows.length > PAGE_SIZE,
  }
}

export async function loadMembers(supabase: Supabase): Promise<CommunityMember[]> {
  const { data, error } = await supabase.rpc('community_members')
  if (error) fail('Não foi possível carregar o ranking', error)
  return ((data ?? []) as CommunityMember[]).map((member) => ({
    ...member,
    total_workouts: Number(member.total_workouts) || 0,
    week_workouts: Number(member.week_workouts) || 0,
  }))
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------
export async function uploadPhotos(
  supabase: Supabase,
  userId: string,
  photos: Blob[],
  onProgress?: (done: number, total: number) => void,
) {
  const bucket = supabase.storage.from(COMMUNITY_BUCKET)
  const paths: string[] = []
  try {
    for (const photo of photos) {
      const path = `${userId}/${crypto.randomUUID()}.jpg`
      const { error } = await bucket.upload(path, photo, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })
      if (error) fail('Não foi possível enviar a foto', error)
      paths.push(path)
      onProgress?.(paths.length, photos.length)
    }
    return paths
  } catch (error) {
    // Não deixa fotos soltas no Storage se o envio parar no meio.
    if (paths.length > 0) await bucket.remove(paths)
    throw error
  }
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------
export async function createPost(
  supabase: Supabase,
  input: { userId: string; body: string; photos: string[]; draft: PostDraft; pinned?: boolean },
): Promise<PostRow> {
  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      // O trigger do banco confirma o autor (auth.uid()) e preenche nome e papel.
      author_id: input.userId,
      kind: input.draft.kind,
      body: input.body.trim() || null,
      photos: input.photos,
      meta: input.draft.meta,
      // Só o treinador consegue publicar já fixado (o RLS recusa os demais).
      pinned: input.pinned ?? false,
    })
    .select('*')
    .single()
  if (error || !data) fail('Não foi possível publicar', error ?? { message: 'sem resposta' })
  const row = data as PostRow
  return { ...row, meta: sanitizeMeta(row.kind, row.meta) }
}

export async function deletePost(supabase: Supabase, post: Pick<PostRow, 'id' | 'photos'>) {
  const { data, error } = await supabase.from('community_posts').delete().eq('id', post.id).select('id')
  if (error) fail('Não foi possível apagar o post', error)
  if (!data || data.length === 0) throw new CommunityError('Você não tem permissão para apagar este post.')
  // As fotos saem depois do post; se falhar, ficam só como arquivos soltos.
  if (post.photos && post.photos.length > 0) await supabase.storage.from(COMMUNITY_BUCKET).remove(post.photos)
}

export async function setLike(supabase: Supabase, postId: string, userId: string, liked: boolean) {
  const { error } = liked
    ? await supabase.from('community_likes').insert({ post_id: postId, user_id: userId })
    : await supabase.from('community_likes').delete().eq('post_id', postId).eq('user_id', userId)
  // 23505: já tinha curtido (toque duplo rápido); o estado final é o mesmo.
  if (error && error.code !== '23505') fail('Não foi possível registrar o fogo', error)
}

export async function addComment(supabase: Supabase, postId: string, userId: string, body: string): Promise<CommentRow> {
  const { data, error } = await supabase
    .from('community_comments')
    .insert({ post_id: postId, author_id: userId, body: body.trim() })
    .select('*')
    .single()
  if (error || !data) fail('Não foi possível comentar', error ?? { message: 'sem resposta' })
  return data as CommentRow
}

export async function deleteComment(supabase: Supabase, commentId: string) {
  const { data, error } = await supabase.from('community_comments').delete().eq('id', commentId).select('id')
  if (error) fail('Não foi possível apagar o comentário', error)
  if (!data || data.length === 0) throw new CommunityError('Você não tem permissão para apagar este comentário.')
}

export async function setPinned(supabase: Supabase, postId: string, pinned: boolean) {
  const { data, error } = await supabase.from('community_posts').update({ pinned }).eq('id', postId).select('id')
  if (error) fail(pinned ? 'Não foi possível fixar o post' : 'Não foi possível desafixar o post', error)
  if (!data || data.length === 0) throw new CommunityError('Só o treinador pode fixar posts.')
}
