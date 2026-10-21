// Anamnese (ficha de saúde com o PAR-Q) e avaliação física: dobras cutâneas
// (Jackson & Pollock 3 e 7 dobras + fórmula de Siri), IMC e composição.
// Tabelas e colunas em supabase/gestao.sql.
import type { createClient } from './supabase/client'
import { requestPushDelivery } from './push/client'

type Supabase = ReturnType<typeof createClient>
type DbError = { code?: string; message?: string } | null | undefined

// ---------------------------------------------------------------- anamnese
// PAR-Q (Physical Activity Readiness Questionnaire), versão em português.
export const PARQ = [
  { key: 'heart', text: 'Algum médico já disse que você tem um problema no coração e que só deve fazer atividade física com supervisão?' },
  { key: 'chest_pain', text: 'Você sente dor no peito quando pratica atividade física?' },
  { key: 'chest_pain_month', text: 'No último mês, você sentiu dor no peito sem estar fazendo atividade física?' },
  { key: 'dizziness', text: 'Você perde o equilíbrio por tontura ou já desmaiou?' },
  { key: 'bone_joint', text: 'Você tem algum problema nos ossos ou nas articulações que pode piorar com exercício?' },
  { key: 'medication', text: 'Você toma remédio para pressão arterial ou para o coração?' },
  { key: 'other', text: 'Existe alguma outra razão pela qual você não deveria fazer atividade física?' },
] as const

export type ParqKey = (typeof PARQ)[number]['key']

export const CONDITIONS = [
  { key: 'hipertensao', label: 'Pressão alta' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'colesterol', label: 'Colesterol alto' },
  { key: 'asma', label: 'Asma ou bronquite' },
  { key: 'cardiaco', label: 'Doença no coração' },
  { key: 'tireoide', label: 'Tireoide' },
  { key: 'ansiedade', label: 'Ansiedade ou depressão' },
  { key: 'gestante', label: 'Gestante' },
] as const

export const ACTIVITY_LEVELS = [
  { key: 'sedentario', label: 'Parado(a)', hint: 'sem exercício' },
  { key: 'leve', label: '1–2x', hint: 'por semana' },
  { key: 'moderado', label: '3–4x', hint: 'por semana' },
  { key: 'intenso', label: '5x ou mais', hint: 'por semana' },
] as const

export type AnamneseAnswers = {
  parq: Partial<Record<ParqKey, boolean>>
  conditions: string[]
  medications: string
  injuries: string
  surgeries: string
  smoker: boolean | null
  activity: string | null
  sleep: number | null
  notes: string
}

export type Anamnese = {
  student_id: string
  answers: AnamneseAnswers
  parq_positive: boolean
  updated_by: string | null
  updated_at: string
}

export const EMPTY_ANSWERS: AnamneseAnswers = {
  parq: {},
  conditions: [],
  medications: '',
  injuries: '',
  surgeries: '',
  smoker: null,
  activity: null,
  sleep: null,
  notes: '',
}

export const TEXT_LIMIT = 400

export const parqAnswered = (answers: AnamneseAnswers) => PARQ.every((question) => typeof answers.parq[question.key] === 'boolean')
export const parqPositive = (answers: AnamneseAnswers) => PARQ.some((question) => answers.parq[question.key] === true)

export class HealthError extends Error {
  readonly missing: boolean

  constructor(message: string, missing = false) {
    super(message)
    this.missing = missing
  }
}

// Sem o gestao.sql, a tabela/coluna não existe.
export function isHealthSetupMissing(error: DbError) {
  if (!error) return false
  if (['PGRST205', 'PGRST204', '42P01', '42703'].includes(error.code ?? '')) return true
  return /schema cache|does not exist/i.test(error.message ?? '')
}

export const HEALTH_SETUP_MESSAGE = 'Para usar a ficha de saúde e a avaliação completa, rode o arquivo supabase/gestao.sql no Supabase.'

function fail(prefix: string, error: NonNullable<DbError>): never {
  const missing = isHealthSetupMissing(error)
  throw new HealthError(missing ? HEALTH_SETUP_MESSAGE : `${prefix}: ${error.message ?? 'erro desconhecido'}`, missing)
}

function normalize(raw: unknown): AnamneseAnswers {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<AnamneseAnswers>
  return {
    ...EMPTY_ANSWERS,
    ...value,
    parq: value.parq && typeof value.parq === 'object' ? value.parq : {},
    conditions: Array.isArray(value.conditions) ? value.conditions : [],
  }
}

export async function loadAnamnese(supabase: Supabase, studentId: string): Promise<Anamnese | null> {
  const { data, error } = await supabase.from('anamneses').select('*').eq('student_id', studentId).maybeSingle()
  if (error) fail('Não foi possível carregar a ficha de saúde', error)
  if (!data) return null
  const row = data as Omit<Anamnese, 'answers'> & { answers: unknown }
  return { ...row, answers: normalize(row.answers) }
}

// Alerta do PAR-Q de todos os alunos (lista do treinador).
export async function loadParqAlerts(supabase: Supabase) {
  const { data, error } = await supabase.from('anamneses').select('student_id, parq_positive')
  if (error) return null
  return new Map(((data ?? []) as { student_id: string; parq_positive: boolean }[]).map((row) => [row.student_id, row.parq_positive]))
}

export async function saveAnamnese(supabase: Supabase, studentId: string, answers: AnamneseAnswers): Promise<Anamnese> {
  const clean: AnamneseAnswers = {
    ...answers,
    medications: answers.medications.trim().slice(0, TEXT_LIMIT),
    injuries: answers.injuries.trim().slice(0, TEXT_LIMIT),
    surgeries: answers.surgeries.trim().slice(0, TEXT_LIMIT),
    notes: answers.notes.trim().slice(0, TEXT_LIMIT),
  }
  const { data, error } = await supabase
    .from('anamneses')
    .upsert({ student_id: studentId, answers: clean }, { onConflict: 'student_id' })
    .select('*')
    .single()
  if (error || !data) fail('Não foi possível salvar a ficha de saúde', error ?? { message: 'sem resposta' })
  // O banco avisa o treinador (ficha nova ou PAR-Q com alerta).
  requestPushDelivery()
  const row = data as Omit<Anamnese, 'answers'> & { answers: unknown }
  return { ...row, answers: normalize(row.answers) }
}

// ------------------------------------------------------- avaliação física
export type Sex = 'M' | 'F'
export type Protocol = 'pollock3' | 'pollock7'

export const SKINFOLDS = {
  chest: 'Peitoral',
  midaxillary: 'Axilar média',
  triceps: 'Tríceps',
  subscapular: 'Subescapular',
  abdomen: 'Abdominal',
  suprailiac: 'Supra-ilíaca',
  thigh: 'Coxa',
} as const

export type SkinfoldSite = keyof typeof SKINFOLDS

export const PROTOCOLS: { value: Protocol; label: string; hint: string }[] = [
  { value: 'pollock3', label: 'Pollock 3', hint: '3 dobras' },
  { value: 'pollock7', label: 'Pollock 7', hint: '7 dobras' },
]

export function protocolSites(protocol: Protocol, sex: Sex | null): SkinfoldSite[] {
  if (protocol === 'pollock7') return ['chest', 'midaxillary', 'triceps', 'subscapular', 'abdomen', 'suprailiac', 'thigh']
  return sex === 'F' ? ['triceps', 'suprailiac', 'thigh'] : ['chest', 'abdomen', 'thigh']
}

// Perímetros (a cintura continua em waist_cm).
export const PERIMETERS = [
  { key: 'neck', label: 'Pescoço' },
  { key: 'shoulders', label: 'Ombros' },
  { key: 'chest', label: 'Tórax' },
  { key: 'arm_right', label: 'Braço D' },
  { key: 'arm_left', label: 'Braço E' },
  { key: 'forearm_right', label: 'Antebraço D' },
  { key: 'forearm_left', label: 'Antebraço E' },
  { key: 'abdomen', label: 'Abdômen' },
  { key: 'hip', label: 'Quadril' },
  { key: 'thigh_right', label: 'Coxa D' },
  { key: 'thigh_left', label: 'Coxa E' },
  { key: 'calf_right', label: 'Panturrilha D' },
  { key: 'calf_left', label: 'Panturrilha E' },
] as const

export type PerimeterKey = (typeof PERIMETERS)[number]['key']

export function ageOn(birthDate: string | null | undefined, on: string) {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null
  const [year, month, day] = birthDate.split('-').map(Number)
  const [onYear, onMonth, onDay] = on.split('-').map(Number)
  let age = onYear - year
  if (onMonth < month || (onMonth === month && onDay < day)) age -= 1
  return age >= 0 && age < 120 ? age : null
}

// Densidade corporal de Jackson & Pollock (soma das dobras em mm).
export function bodyDensity(protocol: Protocol, sex: Sex, sum: number, age: number) {
  if (protocol === 'pollock3') {
    return sex === 'M'
      ? 1.10938 - 0.0008267 * sum + 0.0000016 * sum ** 2 - 0.0002574 * age
      : 1.0994921 - 0.0009929 * sum + 0.0000023 * sum ** 2 - 0.0001392 * age
  }
  return sex === 'M'
    ? 1.112 - 0.00043499 * sum + 0.00000055 * sum ** 2 - 0.00028826 * age
    : 1.097 - 0.00046971 * sum + 0.00000056 * sum ** 2 - 0.00012828 * age
}

// % de gordura pela fórmula de Siri.
export const siri = (density: number) => 495 / density - 450

export type FatEstimate = { bodyFat: number; density: number; sum: number }

// Calcula o % de gordura quando todas as dobras do protocolo foram medidas.
export function estimateBodyFat(
  protocol: Protocol | null,
  sex: Sex | null,
  age: number | null,
  skinfolds: Partial<Record<SkinfoldSite, number | null>>,
): FatEstimate | null {
  if (!protocol || !sex || age === null || age < 10) return null
  const sites = protocolSites(protocol, sex)
  const values = sites.map((site) => skinfolds[site])
  if (values.some((value) => typeof value !== 'number' || !(value > 0))) return null
  const sum = (values as number[]).reduce((total, value) => total + value, 0)
  const density = bodyDensity(protocol, sex, sum, age)
  const bodyFat = Math.round(siri(density) * 10) / 10
  return bodyFat >= 2 && bodyFat <= 70 ? { bodyFat, density, sum } : null
}

export function bmi(weightKg: number | null | undefined, heightCm: number | null | undefined) {
  if (!weightKg || !heightCm) return null
  const meters = heightCm / 100
  return Math.round((weightKg / (meters * meters)) * 10) / 10
}

export function bmiLabel(value: number) {
  if (value < 18.5) return 'Abaixo do peso'
  if (value < 25) return 'Peso normal'
  if (value < 30) return 'Sobrepeso'
  return 'Obesidade'
}

export function composition(weightKg: number | null | undefined, bodyFat: number | null | undefined) {
  if (!weightKg || bodyFat === null || bodyFat === undefined) return null
  const fat = Math.round(((weightKg * bodyFat) / 100) * 10) / 10
  return { fatMass: fat, leanMass: Math.round((weightKg - fat) * 10) / 10 }
}
