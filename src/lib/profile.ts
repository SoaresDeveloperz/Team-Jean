// Perfil do atleta: foto, capa, bio, objetivo e Instagram.
// As colunas, o bucket "avatars" e as permissões ficam em supabase/profile.sql.
import { getSupabaseEnv } from './supabase/env'
import type { createClient } from './supabase/client'
import type { Profile } from './types'
import { friendlyError } from './errors'

type Supabase = ReturnType<typeof createClient>
type DbError = { code?: string; message?: string } | null | undefined

export const AVATAR_BUCKET = 'avatars'
export const BIO_MAX = 160

export type ProfileImageKind = 'avatar' | 'cover'

export type ProfileDetails = Pick<
  Profile,
  'id' | 'full_name' | 'email' | 'role' | 'avatar_path' | 'cover_path' | 'bio' | 'goal' | 'instagram'
>

export const GOALS = [
  { value: 'hipertrofia', label: 'Hipertrofia', emoji: '💪' },
  { value: 'emagrecimento', label: 'Emagrecimento', emoji: '🔥' },
  { value: 'forca', label: 'Força', emoji: '🏋️' },
  { value: 'condicionamento', label: 'Condicionamento', emoji: '⚡' },
  { value: 'saude', label: 'Saúde', emoji: '🌿' },
] as const

export function goalInfo(goal: string | null | undefined) {
  return GOALS.find((item) => item.value === goal) ?? null
}

// URL pública da foto/capa (bucket público). Só aceita caminhos da pasta do
// próprio usuário, como o banco também exige.
export function publicImageUrl(path: string | null | undefined, ownerId?: string | null) {
  if (!path) return null
  if (ownerId && !path.startsWith(`${ownerId}/`)) return null
  // A URL do projeto pode vir com barra no fim.
  const base = getSupabaseEnv().url.replace(/\/+$/, '')
  return `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`
}

export const avatarUrlOf = (person: { id: string; avatar_path?: string | null } | null | undefined) =>
  person ? publicImageUrl(person.avatar_path, person.id) : null

// "@maria.fit", "instagram.com/maria.fit" (com ou sem https://) ou
// "maria.fit" viram "maria.fit".
export function normalizeInstagram(value: string) {
  return value
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '')
    .replace(/^@+/, '')
    .replace(/[/?#].*$/, '')
}

export const isValidInstagram = (handle: string) => /^[A-Za-z0-9._]{1,30}$/.test(handle)

// Sem o profile.sql, o Supabase recusa as colunas novas.
export function isProfileSetupMissing(error: DbError) {
  if (!error) return false
  if (['PGRST204', '42703', 'PGRST205', '42P01'].includes(error.code ?? '')) return true
  return /schema cache|does not exist|bucket not found/i.test(error.message ?? '')
}

export class ProfileError extends Error {
  readonly missing: boolean

  constructor(message: string, missing = false) {
    super(message)
    this.missing = missing
  }
}

export const PROFILE_SETUP_MESSAGE = 'Este recurso ainda não foi ativado. Avise seu treinador.'

function fail(prefix: string, error: NonNullable<DbError>): never {
  throw new ProfileError(friendlyError(error, prefix), isProfileSetupMissing(error))
}

export async function updateProfileDetails(
  supabase: Supabase,
  userId: string,
  patch: Partial<Pick<ProfileDetails, 'full_name' | 'bio' | 'goal' | 'instagram'>>,
) {
  if (Object.keys(patch).length === 0) return
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select('id')
  if (error) fail('Não foi possível salvar o perfil', error)
  if (!data || data.length === 0) throw new ProfileError('Não foi possível salvar o perfil.')
}

// Envia a nova foto/capa, grava o caminho no perfil e só então apaga a antiga.
export async function saveProfileImage(
  supabase: Supabase,
  userId: string,
  kind: ProfileImageKind,
  image: Blob,
  previousPath: string | null | undefined,
) {
  const bucket = supabase.storage.from(AVATAR_BUCKET)
  const path = `${userId}/${kind}-${crypto.randomUUID()}.jpg`
  const { error: uploadError } = await bucket.upload(path, image, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  })
  if (uploadError) fail(kind === 'avatar' ? 'Não foi possível enviar a foto' : 'Não foi possível enviar a capa', uploadError)

  const column = kind === 'avatar' ? 'avatar_path' : 'cover_path'
  const { data, error } = await supabase.from('profiles').update({ [column]: path }).eq('id', userId).select('id')
  if (error || !data || data.length === 0) {
    // Sem gravar no perfil, a foto enviada ficaria solta no Storage.
    await bucket.remove([path])
    if (error) fail('Não foi possível salvar no perfil', error)
    throw new ProfileError('Não foi possível salvar no perfil.')
  }
  if (previousPath && previousPath !== path) await bucket.remove([previousPath])
  return path
}

export async function removeProfileImage(
  supabase: Supabase,
  userId: string,
  kind: ProfileImageKind,
  previousPath: string | null | undefined,
) {
  const column = kind === 'avatar' ? 'avatar_path' : 'cover_path'
  const { error } = await supabase.from('profiles').update({ [column]: null }).eq('id', userId)
  if (error) fail(kind === 'avatar' ? 'Não foi possível remover a foto' : 'Não foi possível remover a capa', error)
  if (previousPath) await supabase.storage.from(AVATAR_BUCKET).remove([previousPath])
}
