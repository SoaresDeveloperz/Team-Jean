// Medidas corporais e fotos de evolução (supabase/profile.sql).
// Fotos ficam no bucket privado "progress": só o aluno e o treinador veem.
import { compressImage } from './images'
import { ProfileError, isProfileSetupMissing } from './profile'
import type { createClient } from './supabase/client'

type Supabase = ReturnType<typeof createClient>
type DbError = { code?: string; message?: string } | null | undefined

export const PROGRESS_BUCKET = 'progress'
export const MAX_PROGRESS_PHOTOS = 3
const SIGNED_URL_SECONDS = 6 * 60 * 60

export type Measurement = {
  id: string
  user_id: string
  measured_on: string
  weight_kg: number | null
  body_fat: number | null
  waist_cm: number | null
  photos: string[]
  note: string | null
  created_at: string
  photoUrls: (string | null)[]
}

export type MeasurementInput = {
  measuredOn: string
  weight: number | null
  bodyFat: number | null
  waist: number | null
  note: string
  photos: Blob[]
}

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function fail(prefix: string, error: NonNullable<DbError>): never {
  throw new ProfileError(`${prefix}: ${error.message ?? 'erro desconhecido'}`, isProfileSetupMissing(error))
}

// "72,4" ou "72.4" → 72.4; vazio → null.
export function parseDecimal(value: string) {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return null
  const number = Number(normalized)
  return Number.isFinite(number) ? number : Number.NaN
}

// Data de hoje no fuso do aparelho, no formato do banco (AAAA-MM-DD).
export function todayISO(now = new Date()) {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

// "2026-10-20" → Date no meio do dia local (evita pular de dia por fuso).
export const dateFromISO = (value: string) => new Date(`${value}T12:00:00`)

export async function loadMeasurements(supabase: Supabase, userId: string): Promise<Measurement[]> {
  const { data, error } = await supabase
    .from('body_measurements')
    .select('*')
    .eq('user_id', userId)
    .order('measured_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) fail('Não foi possível carregar as medidas', error)

  const rows = (data ?? []) as (Omit<Measurement, 'photoUrls'> & { photos: string[] | null })[]
  const paths = [...new Set(rows.flatMap((row) => row.photos ?? []))]
  const urls = new Map<string, string>()
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from(PROGRESS_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)
    for (const item of signed ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl)
  }
  return rows.map((row) => ({
    ...row,
    weight_kg: toNumber(row.weight_kg),
    body_fat: toNumber(row.body_fat),
    waist_cm: toNumber(row.waist_cm),
    photos: row.photos ?? [],
    photoUrls: (row.photos ?? []).map((path) => urls.get(path) ?? null),
  }))
}

export async function addMeasurement(
  supabase: Supabase,
  userId: string,
  input: MeasurementInput,
  onProgress?: (label: string) => void,
) {
  const bucket = supabase.storage.from(PROGRESS_BUCKET)
  const paths: string[] = []
  try {
    for (const [index, photo] of input.photos.entries()) {
      onProgress?.(`Enviando foto ${index + 1} de ${input.photos.length}`)
      const compressed = await compressImage(photo)
      const path = `${userId}/${input.measuredOn}-${crypto.randomUUID()}.jpg`
      const { error } = await bucket.upload(path, compressed, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })
      if (error) fail('Não foi possível enviar a foto', error)
      paths.push(path)
    }
    onProgress?.('Salvando')
    const { error } = await supabase.from('body_measurements').insert({
      user_id: userId,
      measured_on: input.measuredOn,
      weight_kg: input.weight,
      body_fat: input.bodyFat,
      waist_cm: input.waist,
      note: input.note.trim() || null,
      photos: paths,
    })
    if (error) fail('Não foi possível salvar a medida', error)
  } catch (error) {
    // Sem a linha no banco, as fotos enviadas ficariam soltas no Storage.
    if (paths.length > 0) await bucket.remove(paths)
    throw error
  }
}

export async function deleteMeasurement(supabase: Supabase, measurement: Pick<Measurement, 'id' | 'photos'>) {
  const { data, error } = await supabase.from('body_measurements').delete().eq('id', measurement.id).select('id')
  if (error) fail('Não foi possível apagar a medida', error)
  if (!data || data.length === 0) throw new ProfileError('Você não tem permissão para apagar esta medida.')
  if (measurement.photos.length > 0) await supabase.storage.from(PROGRESS_BUCKET).remove(measurement.photos)
}
