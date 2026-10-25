// GIFs dos exercícios (biblioteca em public/exercicios/biblioteca.json).
// O banco guarda só o nome do arquivo (exercises.media_id, ex.: "0025-EIeI8Vf");
// o endereço é montado aqui com a base configurada.
//
// Base: NEXT_PUBLIC_EXERCISE_MEDIA_BASE_URL (sem barra no fim, só http/https)
// ou, sem a variável, a CDN do repositório público do dataset. "off" desliga
// os GIFs: o app fica como era antes deles. O crédito da Gym visual aparece
// sempre junto de qualquer GIF (componente ExerciseGif).
//
// Sem dependências nem alias "@/": o teste em Node (tests/contas-exercicios.mjs)
// importa este arquivo direto.

export const DEFAULT_EXERCISE_MEDIA_BASE = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/videos'
export const EXERCISE_MEDIA_CREDIT = '© Gym visual'
export const EXERCISE_MEDIA_CREDIT_URL = 'https://gymvisual.com/'
// Mesmo formato da restrição do banco (supabase/exercicios.sql).
export const MEDIA_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

export function isValidMediaId(value: unknown): value is string {
  return typeof value === 'string' && MEDIA_ID_PATTERN.test(value)
}

// Base em uso: null = GIFs desligados ("off" ou valor inválido).
export function resolveMediaBase(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim()
  if (!raw) return DEFAULT_EXERCISE_MEDIA_BASE
  if (raw.toLowerCase() === 'off') return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.search || url.hash || url.username || url.password) return null
  return raw.replace(/\/+$/, '')
}

// Lido em tempo de build (o Next embute NEXT_PUBLIC_* no código do navegador).
export const EXERCISE_MEDIA_BASE = resolveMediaBase(process.env.NEXT_PUBLIC_EXERCISE_MEDIA_BASE_URL)

export function exerciseGifUrl(mediaId: string | null | undefined, base: string | null = EXERCISE_MEDIA_BASE): string | null {
  if (!base || !isValidMediaId(mediaId)) return null
  return `${base}/${mediaId}.gif`
}
