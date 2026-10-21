// Supabase falso (auth + PostgREST simplificado) para testar as telas localmente.
import http from 'node:http'
import fs from 'node:fs'
import crypto from 'node:crypto'

const PORT = 54321
const now = Date.now()
const iso = (offsetDays = 0, offsetMinutes = 0) => new Date(now + offsetDays * 864e5 + offsetMinutes * 6e4).toISOString()

function b64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}
function makeJwt(sub, email) {
  const header = b64url({ alg: 'HS256', typ: 'JWT' })
  const payload = b64url({ sub, email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(now / 1000) + 3600 * 24, iat: Math.floor(now / 1000) })
  return `${header}.${payload}.assinatura`
}

const users = {
  'jean@teste.com': { id: 'u-admin', email: 'jean@teste.com' },
  'maria@teste.com': { id: 'u-student', email: 'maria@teste.com' },
  'carlos@teste.com': { id: 'c0ffee00-0000-4000-8000-00000000c2c2', email: 'carlos@teste.com' },
}
// Senha nova (troca, recuperação ou nova senha do treinador). A padrão
// "123456" continua valendo para os roteiros antigos.
const passwords = {}
const passwordOk = (user, password) => password === '123456' || (passwords[user.id] !== undefined && password === passwords[user.id])
// Pedidos de "esqueci minha senha" (e-mail e link de volta).
const recoveries = []
const userById = Object.fromEntries(Object.values(users).map((user) => [user.id, user]))
function authUser(user) {
  return { ...user, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: iso(-30) }
}
function session(user) {
  return {
    access_token: makeJwt(user.id, user.email),
    refresh_token: 'refresh-' + user.id,
    token_type: 'bearer',
    expires_in: 86400,
    expires_at: Math.floor(now / 1000) + 86400,
    user: authUser(user),
  }
}

const ex = (id, name, muscle_group, extra = {}) => ({ id, name, muscle_group, video_url: null, ...extra })
const exercises = [
  ex('e1', 'Supino Reto com Barra', 'Peito', { video_url: 'https://www.youtube.com/watch?v=rT7DgCr-3pg' }),
  ex('e2', 'Crucifixo com Halteres', 'Peito'),
  ex('e3', 'Tríceps na Polia com Corda', 'Tríceps'),
  ex('e4', 'Puxada Frontal', 'Costas'),
  ex('e5', 'Prancha', null),
]
const exById = Object.fromEntries(exercises.map((item) => [item.id, item]))

const profiles = [
  { id: 'u-admin', role: 'admin', full_name: 'Jean Treinador', email: 'jean@teste.com', readiness_score: null, created_at: iso(-60) },
  { id: 'u-student', role: 'student', full_name: 'Maria Souza', email: 'maria@teste.com', readiness_score: 70, created_at: iso(-20) },
  { id: 'c0ffee00-0000-4000-8000-00000000c2c2', role: 'student', full_name: 'Carlos Lima', email: 'carlos@teste.com', readiness_score: null, created_at: iso(-10) },
]

// Colunas do supabase/profile.sql (somem com /__profile/off).
const PROFILE_COLUMNS = ['avatar_path', 'cover_path', 'bio', 'goal', 'instagram']
const GOALS = ['hipertrofia', 'emagrecimento', 'forca', 'condicionamento', 'saude']
for (const profile of profiles) Object.assign(profile, { avatar_path: null, cover_path: null, bio: null, goal: null, instagram: null })
profiles[0].avatar_path = 'u-admin/avatar-seed.jpg'

const assigned_workouts = [
  { id: 'w-a', student_id: 'u-student', name: 'Treino A - Peito e Tríceps', is_current: true, created_at: iso(-15) },
  { id: 'w-b', student_id: 'u-student', name: 'Treino B - Costas', is_current: true, created_at: iso(-15) },
  { id: 'w-old', student_id: 'u-student', name: 'Adaptação', is_current: false, created_at: iso(-50) },
  { id: 'w-c', student_id: 'c0ffee00-0000-4000-8000-00000000c2c2', name: 'Treino C - Peito', is_current: true, created_at: iso(-20) },
]

const assigned_workout_exercises = [
  { id: 'awe1', assigned_workout_id: 'w-a', exercise_id: 'e1', order: 1, sets_count: 3, target_reps: '8-10', planned_sets: [{ type: 'warmup', reps: '15', rir: 4 }, { type: 'working', reps: '8-10', rir: 1 }, { type: 'top', reps: '6-8', rir: 0 }], notes: 'Desça a barra até o peito.' },
  { id: 'awe2', assigned_workout_id: 'w-a', exercise_id: 'e2', order: 2, sets_count: 2, target_reps: '12', planned_sets: [], notes: null },
  { id: 'awe3', assigned_workout_id: 'w-a', exercise_id: 'e3', order: 3, sets_count: 3, target_reps: '10-12', planned_sets: null, notes: null },
  { id: 'awe4', assigned_workout_id: 'w-b', exercise_id: 'e4', order: 1, sets_count: 3, target_reps: '8-12', planned_sets: null, notes: null },
  { id: 'awe5', assigned_workout_id: 'w-c', exercise_id: 'e2', order: 1, sets_count: 3, target_reps: '12', planned_sets: null, notes: null },
]

const workout_sessions = [
  { id: 's1', assigned_workout_id: 'w-a', student_id: 'u-student', status: 'completed', completed_at: iso(-7), session_rpe: 8 },
  { id: 's2', assigned_workout_id: 'w-b', student_id: 'u-student', status: 'completed', completed_at: iso(-1), session_rpe: 7 },
  { id: 's3', assigned_workout_id: 'w-a', student_id: 'u-student', status: 'completed', completed_at: iso(-14), session_rpe: 9 },
  // Sessão abandonada criada pelo código antigo (abria uma a cada acesso).
  { id: 's-old-open', assigned_workout_id: 'w-b', student_id: 'u-student', status: 'in_progress', completed_at: null, session_rpe: null },
  // Carlos: há mais de 7 dias sem treinar (continua "sem treinar"), RPE alto.
  { id: 's-c1', assigned_workout_id: 'w-c', student_id: 'c0ffee00-0000-4000-8000-00000000c2c2', status: 'completed', completed_at: iso(-8), session_rpe: 9 },
  { id: 's-c2', assigned_workout_id: 'w-c', student_id: 'c0ffee00-0000-4000-8000-00000000c2c2', status: 'completed', completed_at: iso(-9), session_rpe: 9 },
  { id: 's-c3', assigned_workout_id: 'w-c', student_id: 'c0ffee00-0000-4000-8000-00000000c2c2', status: 'completed', completed_at: iso(-10), session_rpe: 10 },
]

const session_sets = [
  { id: 'ss1', session_id: 's1', exercise_id: 'e1', assigned_exercise_id: 'awe1', set_number: 2, weight_kg: 60, reps: 10, rir: 1, set_type: 'working', completed: true },
  { id: 'ss2', session_id: 's1', exercise_id: 'e1', assigned_exercise_id: 'awe1', set_number: 3, weight_kg: 70, reps: 6, rir: 0, set_type: 'top', completed: true },
  { id: 'ss3', session_id: 's3', exercise_id: 'e1', assigned_exercise_id: 'awe1', set_number: 3, weight_kg: 65, reps: 7, rir: 0, set_type: 'top', completed: true },
  { id: 'ss4', session_id: 's2', exercise_id: 'e4', assigned_exercise_id: 'awe4', set_number: 1, weight_kg: 50, reps: 12, rir: 2, set_type: 'working', completed: true },
  { id: 'ss4b', session_id: 's2', exercise_id: 'e4', assigned_exercise_id: 'awe4', set_number: 2, weight_kg: 52.5, reps: 10, rir: 1, set_type: 'working', completed: true },
  { id: 'ss4c', session_id: 's2', exercise_id: 'e4', assigned_exercise_id: 'awe4', set_number: 3, weight_kg: 55, reps: 8, rir: 0, set_type: 'working', completed: true },
  { id: 'ss5', session_id: 's1', exercise_id: 'e3', assigned_exercise_id: 'awe3', set_number: 1, weight_kg: 25, reps: 12, rir: 1, set_type: 'working', completed: true },
  { id: 'ss-old', session_id: 's-old-open', exercise_id: 'e4', assigned_exercise_id: 'awe4', set_number: 1, weight_kg: 200, reps: 1, rir: 0, set_type: 'working', completed: true },
  { id: 'ss-c1', session_id: 's-c1', exercise_id: 'e2', assigned_exercise_id: 'awe5', set_number: 1, weight_kg: 14, reps: 12, rir: 1, set_type: 'working', completed: true },
  { id: 'ss-c2', session_id: 's-c1', exercise_id: 'e2', assigned_exercise_id: 'awe5', set_number: 2, weight_kg: 14, reps: 12, rir: 1, set_type: 'working', completed: true },
  { id: 'ss-c3', session_id: 's-c1', exercise_id: 'e2', assigned_exercise_id: 'awe5', set_number: 3, weight_kg: 14, reps: 13, rir: 0, set_type: 'working', completed: true },
]

const notifications = [
  { id: 'n1', recipient_id: 'u-student', type: 'announcement', title: 'Bem-vinda!', message: 'Seu treino A já está liberado.' },
  { id: 'n2', recipient_id: 'u-student', type: 'workout_updated', title: 'Treino lançado! 💪', message: 'Ajustei as cargas do Treino B. Foco na execução lenta na descida.' },
]
const workout_templates = [{ id: 't1', name: 'Full body iniciante' }]
const workout_template_exercises = [
  { id: 'wte1', template_id: 't1', exercise_id: 'e1', order: 1, sets_count: 3, target_reps: '10', planned_sets: null, notes: null },
]

// --- Comunidade (supabase/community.sql) ---
const community_posts = [
  { id: 'cp-coach', author_id: 'u-admin', author_name: 'Jean Treinador', author_role: 'admin', kind: 'post', body: 'Bem-vindos à comunidade do Team Jean! 💪 Postem os treinos, as dúvidas e as conquistas. Toda segunda o ranking zera.', photos: [], meta: null, pinned: true, created_at: iso(-2) },
  { id: 'cp-maria', author_id: 'u-student', author_name: 'Maria Souza', author_role: 'student', kind: 'workout', body: 'Costas destruídas hoje 🔥 Bora que a semana tá só começando!', photos: ['u-student/seed-1.jpg'], meta: { name: 'Treino B - Costas', volume: 1565, sets: 3, minutes: 48, rpe: 7, prs: [], regions: { lats: 1, biceps: 0.5, traps: 0.6, lowerback: 0.2 } }, pinned: false, created_at: iso(-1) },
  { id: 'cp-carlos', author_id: 'c0ffee00-0000-4000-8000-00000000c2c2', author_name: 'Carlos Lima', author_role: 'student', kind: 'post', body: 'Alguém tem dica de alongamento pós-treino? Tô sentindo muito a lombar.', photos: [], meta: null, pinned: false, created_at: iso(0, -95) },
]
const community_likes = [
  { post_id: 'cp-maria', user_id: 'u-admin', created_at: iso(-1) },
  { post_id: 'cp-coach', user_id: 'c0ffee00-0000-4000-8000-00000000c2c2', created_at: iso(-1) },
]
const community_comments = [
  { id: 'cc-1', post_id: 'cp-carlos', author_id: 'u-admin', author_name: 'Jean Treinador', author_role: 'admin', body: 'Faz 5 min de alongamento leve e capricha no core. Amanhã ajusto teu treino!', created_at: iso(0, -60) },
]
// Arquivos do bucket "community": caminho -> { type, data }.
const storageFiles = new Map([
  ['u-student/seed-1.jpg', { type: 'image/jpeg', data: fs.readFileSync(new URL('./fixtures/seed-1.jpg', import.meta.url)) }],
])
const fixture = (name) => ({ type: 'image/jpeg', data: fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url)) })

// --- Perfil e medidas (supabase/profile.sql) ---
const dayISO = (offsetDays = 0) => new Date(now + offsetDays * 864e5).toISOString().slice(0, 10)
const body_measurements = [
  { id: 'bm-1', user_id: 'u-student', measured_on: dayISO(-30), weight_kg: 68.4, body_fat: 27.5, waist_cm: 78, photos: ['u-student/seed-before.jpg'], note: 'Primeira avaliação', created_at: iso(-30) },
  { id: 'bm-2', user_id: 'u-student', measured_on: dayISO(-12), weight_kg: 67.6, body_fat: null, waist_cm: 76.5, photos: [], note: null, created_at: iso(-12) },
]
const avatarFiles = new Map([['u-admin/avatar-seed.jpg', fixture('coach-avatar.jpg')]])
const progressFiles = new Map([['u-student/seed-before.jpg', fixture('progress-before.jpg')]])
// /__profile/off simula o banco sem o profile.sql.
let profileEnabled = true
const PROFILE_TABLES = ['body_measurements']

// --- Ferramentas do treinador (supabase/coach.sql) ---
const coach_notes = [
  { id: 'cn-1', student_id: 'u-student', author_id: 'u-admin', body: 'Dor leve no ombro esquerdo: evitar desenvolvimento pesado por 2 semanas.', pinned: true, created_at: iso(-5) },
]
const challenges = [
  { id: 'ch-1', title: 'Outubro sem falta', description: 'Quem completar ganha uma aula extra!', metric: 'workouts', goal: 8, starts_on: dayISO(-6), ends_on: dayISO(8), created_by: 'u-admin', created_at: iso(-6) },
]
// /__coach/off simula o banco sem o coach.sql.
let coachEnabled = true
const COACH_TABLES = ['coach_notes', 'challenges']
const METRICS = ['workouts', 'volume', 'active_days']

// --- Gestão (supabase/gestao.sql) ---
// /__gestao/off simula o banco sem o gestao.sql.
let gestaoEnabled = true
const GESTAO_TABLES = ['push_subscriptions', 'anamneses', 'student_billing', 'payments', 'coach_settings']
const GESTAO_COLUMNS = {
  notifications: ['created_at', 'pushed_at'],
  workout_sessions: ['feedback', 'feedback_tags', 'coach_reply', 'coach_reply_at'],
  profiles: ['sex', 'birth_date', 'height_cm'],
  body_measurements: ['perimeters', 'skinfolds', 'protocol'],
}
const monthISO = (offsetMonths = 0) => {
  const date = new Date(now)
  date.setDate(1)
  date.setMonth(date.getMonth() + offsetMonths)
  return date.toISOString().slice(0, 10).slice(0, 8) + '01'
}
const today = new Date(now)
const push_subscriptions = []
// Carlos respondeu o PAR-Q com um "sim"; Maria ainda não respondeu.
const anamneses = [
  { student_id: 'c0ffee00-0000-4000-8000-00000000c2c2', answers: { parq: { heart: false, chest_pain: false, chest_pain_month: false, dizziness: false, bone_joint: true, medication: false, other: false }, injuries: 'Hérnia de disco (L4-L5)', conditions: ['hipertensao'] }, parq_positive: true, updated_by: 'c0ffee00-0000-4000-8000-00000000c2c2', created_at: iso(-9), updated_at: iso(-9) },
]
// Maria vence daqui a uns dias (pendente); Carlos venceu no dia 1 (atrasado).
const student_billing = [
  { student_id: 'u-student', monthly_fee: 150, due_day: Math.min(31, today.getDate() + 5), active: true, starts_on: monthISO(-2), last_reminder_on: null, note: null, created_at: iso(-60), updated_at: iso(-60) },
  { student_id: 'c0ffee00-0000-4000-8000-00000000c2c2', monthly_fee: 120, due_day: 1, active: true, starts_on: monthISO(-1), last_reminder_on: null, note: null, created_at: iso(-30), updated_at: iso(-30) },
]
const payments = [
  { id: 'pay-1', student_id: 'u-student', reference_month: monthISO(-1), amount: 150, paid_on: dayISO(-25), method: 'pix', note: null, created_by: 'u-admin', created_at: iso(-25) },
]
const coach_settings = [{ id: 1, pix_key: 'jean@teamjean.app', pix_name: 'Jean Treinador', pix_city: 'Sao Paulo', billing_reminders: false, updated_at: iso(-30) }]
// Pushes entregues pelo servidor no "serviço de push" falso (/__push/...).
const pushes = []
const PAYMENT_METHODS = ['pix', 'dinheiro', 'cartao', 'transferencia', 'outro']

// /__community/off simula o banco sem o community.sql.
let communityEnabled = true
const COMMUNITY_TABLES = ['community_posts', 'community_likes', 'community_comments']

const tables = { profiles, exercises, assigned_workouts, assigned_workout_exercises, workout_sessions, session_sets, notifications, workout_templates, workout_template_exercises, community_posts, community_likes, community_comments, body_measurements, coach_notes, challenges, push_subscriptions, anamneses, student_billing, payments, coach_settings }


// Esquema estrito (colunas e relações comprovadas pelo código antigo).
const SCHEMA = {
  profiles: ['id', 'role', 'full_name', 'email', 'readiness_score', 'created_at'],
  exercises: ['id', 'name', 'muscle_group', 'video_url'],
  assigned_workouts: ['id', 'student_id', 'name', 'is_current', 'created_at'],
  assigned_workout_exercises: ['id', 'assigned_workout_id', 'exercise_id', 'order', 'sets_count', 'target_reps', 'planned_sets', 'notes'],
  workout_templates: ['id', 'name'],
  workout_template_exercises: ['id', 'template_id', 'exercise_id', 'order', 'sets_count', 'target_reps', 'planned_sets', 'notes'],
  workout_sessions: ['id', 'assigned_workout_id', 'student_id', 'status', 'completed_at', 'session_rpe'],
  session_sets: ['id', 'session_id', 'exercise_id', 'assigned_exercise_id', 'set_number', 'weight_kg', 'reps', 'rir', 'set_type', 'completed'],
  notifications: ['id', 'recipient_id', 'type', 'title', 'message'],
  community_posts: ['id', 'author_id', 'author_name', 'author_role', 'kind', 'body', 'photos', 'meta', 'pinned', 'created_at'],
  community_likes: ['post_id', 'user_id', 'created_at'],
  community_comments: ['id', 'post_id', 'author_id', 'author_name', 'author_role', 'body', 'created_at'],
  body_measurements: ['id', 'user_id', 'measured_on', 'weight_kg', 'body_fat', 'waist_cm', 'photos', 'note', 'created_at'],
  coach_notes: ['id', 'student_id', 'author_id', 'body', 'pinned', 'created_at'],
  challenges: ['id', 'title', 'description', 'metric', 'goal', 'starts_on', 'ends_on', 'created_by', 'created_at'],
  push_subscriptions: ['id', 'user_id', 'endpoint', 'p256dh', 'auth', 'user_agent', 'created_at'],
  anamneses: ['student_id', 'answers', 'parq_positive', 'updated_by', 'created_at', 'updated_at'],
  student_billing: ['student_id', 'monthly_fee', 'due_day', 'active', 'starts_on', 'last_reminder_on', 'note', 'created_at', 'updated_at'],
  payments: ['id', 'student_id', 'reference_month', 'amount', 'paid_on', 'method', 'note', 'created_by', 'created_at'],
  coach_settings: ['id', 'pix_key', 'pix_name', 'pix_city', 'billing_reminders', 'updated_at'],
}
function columnsOf(table) {
  let columns = SCHEMA[table]
  if (table === 'profiles' && profileEnabled) columns = [...columns, ...PROFILE_COLUMNS]
  if (gestaoEnabled && GESTAO_COLUMNS[table] && (table !== 'body_measurements' || profileEnabled)) columns = [...columns, ...GESTAO_COLUMNS[table]]
  return columns
}
// Colunas que o banco real não teria sem o gestao.sql/profile.sql somem das respostas.
function visibleRow(table, row) {
  const columns = columnsOf(table)
  const relations = RELATIONS[table] ?? []
  return Object.fromEntries(Object.entries(row).filter(([key]) => columns.includes(key) || relations.includes(key) || key === 'assigned_workout_exercises' || key === 'workout_template_exercises'))
}
const RELATIONS = {
  assigned_workouts: ['profiles'],
  assigned_workout_exercises: ['exercises'],
  session_sets: ['exercises'],
  workout_sessions: ['assigned_workouts'],
  workout_template_exercises: ['exercises'],
}

function splitTopLevel(text) {
  const parts = []
  let depth = 0
  let current = ''
  for (const char of text) {
    if (char === '(') depth++
    if (char === ')') depth--
    if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else current += char
  }
  if (current) parts.push(current)
  return parts.map((part) => part.trim()).filter(Boolean)
}

// Devolve uma mensagem de erro se o select usar coluna/relação inexistente.
function validateSelect(table, select) {
  for (const item of splitTopLevel(select)) {
    const embed = item.match(/^(?:\w+:)?(\w+)(?:!\w+)?\((.*)\)$/)
    if (embed) {
      const [, relation, inner] = embed
      if (!(RELATIONS[table] ?? []).includes(relation)) {
        return { code: 'PGRST200', message: `Could not find a relationship between '${table}' and '${relation}' in the schema cache` }
      }
      if (inner !== '*' && inner !== 'count') {
        const error = validateSelect(relation, inner)
        if (error) return error
      }
      continue
    }
    if (item === '*' || item === 'count') continue
    if (!columnsOf(table).includes(item)) return { code: '42703', message: `column ${table}.${item} does not exist` }
  }
  return null
}

function validateParams(table, params) {
  for (const [key, raw] of params.entries()) {
    if (['select', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue
    if (key === 'order') {
      for (const part of raw.split(',')) {
        const column = part.split('.')[0]
        if (!columnsOf(table).includes(column)) return { code: '42703', message: `column ${table}.${column} does not exist` }
      }
      continue
    }
    if (key.includes('.')) {
      const [relation] = key.split('.')
      if (!(RELATIONS[table] ?? []).includes(relation)) return { code: 'PGRST100', message: `unknown embedded filter ${key}` }
      continue
    }
    if (!columnsOf(table).includes(key)) return { code: '42703', message: `column ${table}.${key} does not exist` }
  }
  return null
}

function validatePayload(table, body) {
  for (const item of Array.isArray(body) ? body : [body]) {
    for (const key of Object.keys(item ?? {})) {
      if (!columnsOf(table).includes(key)) return { code: 'PGRST204', message: `Could not find the '${key}' column of '${table}' in the schema cache` }
    }
  }
  return null
}

// Embeds pedidos no select (só os que o app usa).
function embed(table, row, select) {
  const out = { ...row }
  if (select.includes('profiles(') && table === 'assigned_workouts') {
    const profile = profiles.find((p) => p.id === row.student_id)
    out.profiles = profile ? { full_name: profile.full_name, email: profile.email } : null
  }
  if (select.includes('assigned_workout_exercises(count)')) {
    out.assigned_workout_exercises = [{ count: assigned_workout_exercises.filter((r) => r.assigned_workout_id === row.id).length }]
  }
  if (select.includes('workout_template_exercises(count)')) {
    out.workout_template_exercises = [{ count: workout_template_exercises.filter((r) => r.template_id === row.id).length }]
  }
  if (select.includes('exercises(') && row.exercise_id) out.exercises = exById[row.exercise_id] ?? null
  if (/assigned_workouts(!inner)?\(/.test(select) && row.assigned_workout_id) {
    const workout = assigned_workouts.find((w) => w.id === row.assigned_workout_id)
    out.assigned_workouts = workout ? { name: workout.name, student_id: workout.student_id } : null
  }
  if (select.includes('workout_sessions!inner') && row.session_id) {
    const sessionRow = workout_sessions.find((s) => s.id === row.session_id)
    out.workout_sessions = sessionRow ? { student_id: sessionRow.student_id } : null
  }
  return out
}

function applyFilters(rows, params) {
  let result = rows
  for (const [key, raw] of params.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue
    const [op, ...rest] = raw.split('.')
    const value = rest.join('.')
    if (key.includes('.')) {
      // Filtro em tabela embutida (ex.: workout_sessions.student_id).
      const [embedTable, column] = key.split('.')
      if (op === 'eq') result = result.filter((row) => row[embedTable] && String(row[embedTable][column]) === value)
      continue
    }
    if (op === 'eq') result = result.filter((row) => String(row[key]) === value)
    if (op === 'neq') result = result.filter((row) => String(row[key]) !== value)
    if (op === 'in') {
      const values = value.replace(/^\(|\)$/g, '').split(',').map((v) => v.replace(/"/g, ''))
      result = result.filter((row) => values.includes(String(row[key])))
    }
    const comparable = (row) => row[key] !== null && row[key] !== undefined
    const compare = (row) => (typeof row[key] === 'number' ? row[key] - Number(value) : String(row[key]).localeCompare(value))
    if (op === 'gte') result = result.filter((row) => comparable(row) && compare(row) >= 0)
    if (op === 'gt') result = result.filter((row) => comparable(row) && compare(row) > 0)
    if (op === 'lte') result = result.filter((row) => comparable(row) && compare(row) <= 0)
    if (op === 'lt') result = result.filter((row) => comparable(row) && compare(row) < 0)
    if (op === 'is') result = result.filter((row) => (value === 'null' ? !comparable(row) : String(row[key]) === value))
    if (op === 'not' && value === 'is.null') result = result.filter(comparable)
  }
  return result
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Expose-Headers': 'Content-Range',
    ...headers,
  })
  res.end(body === undefined ? '' : JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data ? JSON.parse(data) : null))
  })
}

function readRaw(req) {
  return new Promise((resolve) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

// Extrai o arquivo de um upload multipart (o storage-js manda Blob como FormData).
function fileFromMultipart(req, raw) {
  const type = req.headers['content-type'] || ''
  const boundary = /boundary=(.+)$/.exec(type)?.[1]
  if (!boundary) return { type: type || 'application/octet-stream', data: raw }
  const delimiter = Buffer.from(`--${boundary}`)
  let start = raw.indexOf(delimiter)
  while (start !== -1) {
    const next = raw.indexOf(delimiter, start + delimiter.length)
    if (next === -1) break
    const part = raw.subarray(start + delimiter.length + 2, next - 2)
    const headerEnd = part.indexOf('\r\n\r\n')
    const headers = part.subarray(0, headerEnd).toString()
    if (/filename=/.test(headers)) {
      return { type: /Content-Type: (.+)/i.exec(headers)?.[1]?.trim() || 'application/octet-stream', data: part.subarray(headerEnd + 4) }
    }
    start = next
  }
  return null
}

function isAdminUser(user) {
  return profiles.find((profile) => profile.id === user?.id)?.role === 'admin'
}

const owns = (user, path) => Boolean(user) && path.split('/')[0] === user.id
const ownsOrAdmin = (user, path) => owns(user, path) || isAdminUser(user)
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
// Buckets com as mesmas regras dos arquivos .sql.
const BUCKETS = {
  community: { files: storageFiles, isPublic: false, enabled: () => communityEnabled, maxBytes: 5 * 1024 * 1024, canRead: (user) => Boolean(user), canWrite: owns, canDelete: ownsOrAdmin },
  avatars: { files: avatarFiles, isPublic: true, enabled: () => profileEnabled, maxBytes: 2 * 1024 * 1024, mimes: IMAGE_TYPES, canRead: owns, canWrite: owns, canDelete: owns },
  progress: { files: progressFiles, isPublic: false, enabled: () => profileEnabled, maxBytes: 5 * 1024 * 1024, mimes: IMAGE_TYPES, canRead: ownsOrAdmin, canWrite: ownsOrAdmin, canDelete: ownsOrAdmin },
}

const chars = (value) => [...String(value)].length
function profileViolation(row) {
  if (row.avatar_path != null && !String(row.avatar_path).startsWith(`${row.id}/`)) return 'profiles_avatar_path_check'
  if (row.cover_path != null && !String(row.cover_path).startsWith(`${row.id}/`)) return 'profiles_cover_path_check'
  if (row.bio != null && chars(row.bio) > 160) return 'profiles_bio_check'
  if (row.goal != null && !GOALS.includes(row.goal)) return 'profiles_goal_check'
  if (row.instagram != null && !/^[A-Za-z0-9._]{1,30}$/.test(row.instagram)) return 'profiles_instagram_check'
  if (row.sex != null && !['M', 'F'].includes(row.sex)) return 'profiles_sex_check'
  if (row.birth_date != null && !(String(row.birth_date) >= '1900-01-01' && String(row.birth_date) <= '2100-01-01')) return 'profiles_birth_date_check'
  if (row.height_cm != null && !(Number(row.height_cm) >= 80 && Number(row.height_cm) <= 250)) return 'profiles_height_cm_check'
  return null
}

function measurementViolation(row) {
  const between = (value, min, max) => value === null || (Number(value) >= min && Number(value) <= max)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.measured_on))) return 'measured_on'
  if (!between(row.weight_kg, 20, 400)) return 'body_measurements_weight_kg_check'
  if (!between(row.body_fat, 2, 70)) return 'body_measurements_body_fat_check'
  if (!between(row.waist_cm, 30, 250)) return 'body_measurements_waist_cm_check'
  if (!Array.isArray(row.photos) || row.photos.length > 3) return 'body_measurements_photos_check'
  if (row.note != null && chars(row.note) > 280) return 'body_measurements_note_check'
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  if (row.perimeters != null && !isObject(row.perimeters)) return 'body_measurements_perimeters_check'
  if (row.skinfolds != null && !isObject(row.skinfolds)) return 'body_measurements_skinfolds_check'
  if (row.protocol != null && !['pollock3', 'pollock7'].includes(row.protocol)) return 'body_measurements_protocol_check'
  if (row.weight_kg === null && row.body_fat === null && row.waist_cm === null && row.photos.length === 0 && row.perimeters == null && row.skinfolds == null) return 'body_measurements_has_data'
  return null
}
// numeric(5,2) / numeric(4,1) arredondam como o Postgres.
const roundTo = (value, digits) => (value === null || value === undefined ? null : Math.round(Number(value) * 10 ** digits) / 10 ** digits)

function startOfWeekISO() {
  const day = new Date()
  day.setHours(0, 0, 0, 0)
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7))
  return day.toISOString()
}

// A service_role do servidor (Server Actions e cron) ignora o RLS.
const isService = (req) => (req.headers.authorization || '') === 'Bearer service-mock'

// Aviso no sino com as colunas do gestao.sql (data e push pendente).
function pushNotification(row) {
  const item = { id: `notifications-new-${++idCounter}`, ...row }
  if (gestaoEnabled) Object.assign(item, { created_at: new Date().toISOString(), pushed_at: null })
  notifications.push(item)
  return item
}

// Triggers do gestao.sql em workout_sessions (protege a resposta e avisa o treinador do recado).
function sessionPatchViolation(user, req, body) {
  if (('coach_reply' in body || 'coach_reply_at' in body) && !isService(req) && !isAdminUser(user)) {
    return { code: 'P0001', message: 'Somente o treinador responde o recado do treino' }
  }
  if (body.feedback != null && chars(body.feedback) > 500) return { code: '23514', message: 'new row for relation "workout_sessions" violates check constraint "workout_sessions_feedback_check"' }
  if (body.coach_reply != null && (chars(String(body.coach_reply).trim()) < 1 || chars(body.coach_reply) > 500)) return { code: '23514', message: 'new row for relation "workout_sessions" violates check constraint "workout_sessions_coach_reply_check"' }
  return null
}
function notifyFeedback(before, after) {
  const tags = after.feedback_tags ?? []
  if (after.status !== 'completed' || (!String(after.feedback ?? '').trim() && tags.length === 0)) return
  if (before.status === 'completed' && before.feedback === after.feedback && JSON.stringify(before.feedback_tags ?? []) === JSON.stringify(tags)) return
  const workout = assigned_workouts.find((item) => item.id === after.assigned_workout_id)
  const studentName = (profiles.find((profile) => profile.id === after.student_id)?.full_name || '').trim() || 'Aluno'
  const message = [
    [workout?.name ?? 'Treino', after.session_rpe != null ? `RPE ${after.session_rpe}` : null].filter(Boolean).join(' · '),
    tags.length ? tags.join(' · ') : null,
    String(after.feedback ?? '').trim() ? `“${String(after.feedback).trim().slice(0, 300)}”` : null,
  ]
    .filter(Boolean)
    .join('\n')
  for (const coach of profiles.filter((profile) => profile.role === 'admin')) {
    pushNotification({ recipient_id: coach.id, type: 'feedback', title: `Recado de ${studentName}`, message })
  }
}
// Trigger anamneses_notify: aviso ao treinador quando o próprio aluno preenche.
function notifyAnamnese(before, after) {
  if (before && (!after.parq_positive || before.parq_positive)) return
  const name = (profiles.find((profile) => profile.id === after.student_id)?.full_name || '').trim() || 'Aluno'
  const title = after.parq_positive ? `PAR-Q com alerta: ${name}` : `Ficha de saúde de ${name}`
  const message = after.parq_positive
    ? 'Respondeu "sim" em alguma pergunta do PAR-Q. Confira a ficha de saúde antes de intensificar o treino.'
    : 'Anamnese preenchida, sem alertas no PAR-Q.'
  for (const coach of profiles.filter((profile) => profile.role === 'admin')) pushNotification({ recipient_id: coach.id, type: 'health', title, message })
}
function parqPositive(answers) {
  const parq = answers && typeof answers.parq === 'object' && !Array.isArray(answers.parq) ? answers.parq : {}
  return Object.values(parq).some((value) => value === true || value === 'true')
}

function userFromAuth(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    return userById[payload.sub] ?? null
  } catch {
    return null
  }
}

let idCounter = 0
const log = []

http
  .createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204)
    const url = new URL(req.url, `http://localhost:${PORT}`)
    log.push(`${req.method} ${url.pathname}${url.search}`)

    if (url.pathname === '/__log') return send(res, 200, log.splice(0))

    if (url.pathname === '/auth/v1/token') {
      const body = await readBody(req)
      const user = users[body?.email]
      if (!user || !passwordOk(user, body.password)) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
      return send(res, 200, session(user))
    }
    if (url.pathname === '/auth/v1/user') {
      const user = userFromAuth(req)
      if (!user) return send(res, 401, { msg: 'invalid JWT' })
      if (req.method === 'PUT') {
        const body = await readBody(req)
        if (body?.password === '123456' || (body?.password && body.password === passwords[user.id])) {
          return send(res, 422, { code: 422, error_code: 'same_password', msg: 'New password should be different from the old password.' })
        }
        if (body?.password && body.password.length < 6) return send(res, 422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters.' })
        if (body?.password) passwords[user.id] = body.password
      }
      return send(res, 200, authUser(user))
    }
    // Esqueci minha senha: guarda o pedido; o "e-mail" leva token_hash=recovery-<id>.
    if (url.pathname === '/auth/v1/recover' && req.method === 'POST') {
      const body = await readBody(req)
      const email = String(body?.email ?? '').toLowerCase()
      const recent = recoveries.find((item) => item.email === email && Date.now() - item.at < 60_000)
      if (recent) return send(res, 429, { code: 429, error_code: 'over_email_send_rate_limit', msg: 'For security purposes, you can only request this after 60 seconds.' })
      recoveries.push({ email, redirectTo: url.searchParams.get('redirect_to'), at: Date.now(), token: users[email] ? `recovery-${users[email].id}` : null })
      return send(res, 200, {})
    }
    if (url.pathname === '/auth/v1/verify' && req.method === 'POST') {
      const body = await readBody(req)
      const user = Object.values(users).find((item) => body?.type === 'recovery' && body?.token_hash === `recovery-${item.id}`)
      if (!user) return send(res, 403, { code: 403, error_code: 'otp_expired', msg: 'Email link is invalid or has expired' })
      return send(res, 200, session(user))
    }
    // Nova senha gerada pelo treinador (auth.admin.updateUserById).
    const adminUserMatch = url.pathname.match(/^\/auth\/v1\/admin\/users\/([^/]+)$/)
    if (adminUserMatch && req.method === 'PUT') {
      if (!isService(req)) return send(res, 403, { code: 403, msg: 'User not allowed' })
      const body = await readBody(req)
      const user = userById[adminUserMatch[1]]
      if (!user) return send(res, 404, { code: 404, error_code: 'user_not_found', msg: 'User not found' })
      if (body?.password) passwords[user.id] = body.password
      return send(res, 200, authUser(user))
    }
    // Serviço de push falso: guarda o que o servidor entregou (gone-* = aparelho cancelado).
    const pushMatch = url.pathname.match(/^\/__push\/([\w-]+)$/)
    if (pushMatch && req.method === 'POST') {
      const raw = await readRaw(req)
      if (pushMatch[1].startsWith('gone')) return send(res, 410, {})
      pushes.push({
        endpoint: `http://localhost:${PORT}${url.pathname}`,
        headers: { encoding: req.headers['content-encoding'], ttl: req.headers.ttl, authorization: req.headers.authorization },
        body: raw.toString('base64'),
      })
      return send(res, 201, {})
    }
    if (url.pathname === '/__pushes') return send(res, 200, pushes.splice(0))
    if (url.pathname === '/__recoveries') return send(res, 200, recoveries)
    if (url.pathname === '/__gestao/off') {
      gestaoEnabled = false
      return send(res, 200, { gestaoEnabled })
    }
    if (url.pathname === '/__gestao/on') {
      gestaoEnabled = true
      return send(res, 200, { gestaoEnabled })
    }
    if (url.pathname === '/auth/v1/logout') return send(res, 204)
    if (url.pathname === '/auth/v1/admin/users' && req.method === 'POST') {
      const body = await readBody(req)
      if (body.email === 'repetido@teste.com') return send(res, 422, { code: 422, msg: 'A user with this email address has already been registered' })
      return send(res, 200, { id: 'u-new-' + ++idCounter, email: body.email, user_metadata: body.user_metadata })
    }

    if (url.pathname === '/__coach/off') {
      coachEnabled = false
      return send(res, 200, { coachEnabled })
    }
    if (url.pathname === '/__coach/on') {
      coachEnabled = true
      return send(res, 200, { coachEnabled })
    }

    // Placar do desafio (challenge_standings), em dias de Brasília.
    if (url.pathname === '/rest/v1/rpc/challenge_standings') {
      if (!coachEnabled) return send(res, 404, { code: 'PGRST202', message: 'Could not find the function public.challenge_standings(p_challenge) in the schema cache' })
      if (!userFromAuth(req)) return send(res, 200, [])
      const body = await readBody(req)
      const challenge = challenges.find((item) => item.id === body?.p_challenge)
      if (!challenge) return send(res, 200, [])
      const localDay = (value) => new Date(new Date(value).getTime() - 3 * 3600e3).toISOString().slice(0, 10)
      const rows = profiles
        .filter((profile) => profile.role === 'student')
        .map((profile) => {
          const done = workout_sessions.filter(
            (session) =>
              session.student_id === profile.id &&
              session.status === 'completed' &&
              session.completed_at &&
              localDay(session.completed_at) >= challenge.starts_on &&
              localDay(session.completed_at) <= challenge.ends_on,
          )
          let progress = done.length
          if (challenge.metric === 'active_days') progress = new Set(done.map((session) => localDay(session.completed_at))).size
          if (challenge.metric === 'volume') {
            const ids = new Set(done.map((session) => session.id))
            progress = session_sets
              .filter((set) => ids.has(set.session_id) && set.completed !== false)
              .reduce((total, set) => total + (Number(set.weight_kg) || 0) * (Number(set.reps) || 0), 0)
          }
          return { user_id: profile.id, full_name: (profile.full_name || '').trim() || 'Atleta', avatar_path: profileEnabled ? profile.avatar_path : null, progress }
        })
        .sort((a, b) => b.progress - a.progress || a.full_name.localeCompare(b.full_name))
      return send(res, 200, rows)
    }

    if (url.pathname === '/__profile/off') {
      profileEnabled = false
      return send(res, 200, { profileEnabled })
    }
    if (url.pathname === '/__profile/on') {
      profileEnabled = true
      return send(res, 200, { profileEnabled })
    }
    // Estado para os testes conferirem uploads, limpezas e gravações.
    if (url.pathname === '/__state') {
      return send(res, 200, {
        storage: Object.fromEntries(Object.entries(BUCKETS).map(([id, bucket]) => [id, [...bucket.files.keys()]])),
        profiles: profiles.map(({ id, full_name, ...rest }) => ({ id, full_name, ...Object.fromEntries([...PROFILE_COLUMNS, ...GESTAO_COLUMNS.profiles].map((key) => [key, rest[key]])) })),
        body_measurements,
        coach_notes,
        challenges,
        notifications,
        workout_sessions,
        session_sets,
        assigned_workout_exercises,
        push_subscriptions,
        anamneses,
        student_billing,
        payments,
        coach_settings,
        passwords,
      })
    }

    if (url.pathname === '/__community/off') {
      communityEnabled = false
      return send(res, 200, { communityEnabled })
    }
    if (url.pathname === '/__community/on') {
      communityEnabled = true
      return send(res, 200, { communityEnabled })
    }

    // RPC do ranking (community_members)
    if (url.pathname === '/rest/v1/rpc/community_members') {
      if (!communityEnabled) return send(res, 404, { code: 'PGRST202', message: 'Could not find the function public.community_members without parameters in the schema cache' })
      if (!userFromAuth(req)) return send(res, 200, [])
      const weekStart = startOfWeekISO()
      return send(
        res,
        200,
        profiles.map((profile) => {
          const done = workout_sessions.filter((session) => session.student_id === profile.id && session.status === 'completed')
          return {
            id: profile.id,
            full_name: (profile.full_name || '').trim() || 'Atleta',
            role: profile.role,
            ...(profileEnabled ? { avatar_path: profile.avatar_path } : {}),
            total_workouts: done.length,
            week_workouts: done.filter((session) => session.completed_at && session.completed_at >= weekStart).length,
          }
        }),
      )
    }

    // Storage: "community" e "progress" (privados) e "avatars" (público).
    const publicMatch = url.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
    if (publicMatch) {
      const [, bucketId, rawPath] = publicMatch
      const bucket = BUCKETS[bucketId]
      const file = bucket?.isPublic && bucket.enabled() ? bucket.files.get(decodeURIComponent(rawPath)) : null
      if (!file) return send(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' })
      res.writeHead(200, { 'Content-Type': file.type, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'max-age=3600' })
      return res.end(file.data)
    }
    const storageMatch = url.pathname.match(/^\/storage\/v1\/object\/(sign\/)?([^/]+)\/?(.*)$/)
    if (storageMatch) {
      const [, sign, bucketId, rawPath] = storageMatch
      const path = decodeURIComponent(rawPath)
      const user = userFromAuth(req)
      const bucket = BUCKETS[bucketId]
      if (!bucket || !bucket.enabled()) {
        if (req.method === 'GET') return send(res, 404, { statusCode: '404', error: 'not_found', message: 'Object not found' })
        return send(res, 400, { statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' })
      }
      if (sign && req.method === 'POST' && !path) {
        const body = await readBody(req)
        return send(
          res,
          200,
          (body?.paths ?? []).map((item) =>
            bucket.files.has(item) && bucket.canRead(user, item)
              ? { path: item, signedURL: `/object/sign/${bucketId}/${encodeURI(item)}?token=mock-${item.length}`, error: null }
              : { path: item, signedURL: null, error: 'Either the object does not exist or you do not have access to it' },
          ),
        )
      }
      if (sign && req.method === 'GET') {
        const file = bucket.files.get(path)
        if (!file) return send(res, 404, { statusCode: '404', error: 'not_found', message: 'Object not found' })
        res.writeHead(200, { 'Content-Type': file.type, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'max-age=3600' })
        return res.end(file.data)
      }
      if (!user) return send(res, 400, { statusCode: '403', error: 'Unauthorized', message: 'invalid JWT' })
      if (req.method === 'POST' && path) {
        if (!bucket.canWrite(user, path)) return send(res, 400, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' })
        const file = fileFromMultipart(req, await readRaw(req))
        const typeOk = file && (bucket.mimes ? bucket.mimes.includes(file.type) : file.type.startsWith('image/'))
        if (!typeOk) return send(res, 400, { statusCode: '415', error: 'invalid_mime_type', message: `mime type ${file?.type} is not supported` })
        if (file.data.length > bucket.maxBytes) return send(res, 400, { statusCode: '413', error: 'Payload too large', message: 'The object exceeded the maximum allowed size' })
        if (bucket.files.has(path)) return send(res, 400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' })
        bucket.files.set(path, file)
        return send(res, 200, { Key: `${bucketId}/${path}`, Id: crypto.randomUUID() })
      }
      if (req.method === 'DELETE' && !path) {
        const body = await readBody(req)
        const removed = []
        for (const item of body?.prefixes ?? []) {
          if (bucket.files.has(item) && bucket.canDelete(user, item)) {
            bucket.files.delete(item)
            removed.push({ name: item, bucket_id: bucketId })
          }
        }
        return send(res, 200, removed)
      }
      return send(res, 400, { statusCode: '400', error: 'unsupported', message: 'unsupported storage call' })
    }

    const match = url.pathname.match(/^\/rest\/v1\/(\w+)$/)
    if (!match || !tables[match[1]]) return send(res, 404, { message: 'not found ' + url.pathname })
    const table = match[1]
    if (COMMUNITY_TABLES.includes(table) && !communityEnabled) {
      return send(res, 404, { code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache` })
    }
    if (PROFILE_TABLES.includes(table) && !profileEnabled) {
      return send(res, 404, { code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache` })
    }
    if (COACH_TABLES.includes(table) && !coachEnabled) {
      return send(res, 404, { code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache` })
    }
    if (GESTAO_TABLES.includes(table) && !gestaoEnabled) {
      return send(res, 404, { code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache` })
    }
    const select = url.searchParams.get('select') ?? '*'
    const wantsObject = (req.headers.accept || '').includes('vnd.pgrst.object')

    const queryError = validateSelect(table, select) ?? validateParams(table, url.searchParams)
    if (queryError) {
      log.push(`  -> 400 ${queryError.message}`)
      console.log(`400 ${req.method} ${url.pathname}${url.search} :: ${queryError.message}`)
      return send(res, 400, queryError)
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      let rows = tables[table].map((row) => embed(table, row, select))
      if (table === 'profiles' && !profileEnabled) {
        rows = rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !PROFILE_COLUMNS.includes(key))))
      }
      if (table === 'coach_notes') {
        // RLS: só o treinador lê.
        if (!isAdminUser(userFromAuth(req))) rows = []
      }
      if (table === 'body_measurements') {
        // RLS: o próprio aluno ou o treinador.
        const requester = userFromAuth(req)
        rows = rows.filter((row) => row.user_id === requester?.id || isAdminUser(requester))
      }
      if (GESTAO_TABLES.includes(table) && !isService(req)) {
        // RLS do gestao.sql.
        const requester = userFromAuth(req)
        if (table === 'push_subscriptions') rows = rows.filter((row) => row.user_id === requester?.id)
        else if (table === 'coach_settings') rows = requester ? rows : []
        else rows = rows.filter((row) => row.student_id === requester?.id || isAdminUser(requester))
      }
      rows = rows.map((row) => visibleRow(table, row))
      rows = applyFilters(rows, url.searchParams)
      const order = url.searchParams.get('order')
      if (order) {
        const keys = order.split(',').map((part) => part.split('.'))
        const value = (row, column) => (typeof row[column] === 'boolean' ? String(Number(row[column])) : String(row[column] ?? ''))
        rows = [...rows].sort((a, b) => {
          for (const [column, direction] of keys) {
            const result = value(a, column).localeCompare(value(b, column), 'pt-BR', { numeric: true }) * (direction === 'desc' ? -1 : 1)
            if (result !== 0) return result
          }
          return 0
        })
      }
      const limit = Number(url.searchParams.get('limit'))
      const offset = Number(url.searchParams.get('offset')) || 0
      const total = rows.length
      if (offset) rows = rows.slice(offset)
      if (limit) rows = rows.slice(0, limit)
      const headers = { 'Content-Range': `0-${Math.max(0, rows.length - 1)}/${total}` }
      if (req.method === 'HEAD') return send(res, 200, undefined, headers)
      if (wantsObject) return rows.length === 1 ? send(res, 200, rows[0], headers) : send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `${rows.length} rows` })
      return send(res, 200, rows, headers)
    }

    const body = await readBody(req)
    const payloadError = validatePayload(table, body)
    if (payloadError) {
      log.push(`  -> 400 ${payloadError.message}`)
      console.log(`400 ${req.method} ${url.pathname} :: ${payloadError.message}`)
      return send(res, 400, payloadError)
    }
    const user = userFromAuth(req)
    const service = isService(req)
    const upsert = String(req.headers.prefer || '').includes('resolution=merge-duplicates')
    const forbidden = () => send(res, 403, { code: '42501', message: `new row violates row-level security policy for table "${table}"` })
    const violates = (constraint) => send(res, 400, { code: '23514', message: `new row for relation "${table}" violates check constraint "${constraint}"` })

    if (GESTAO_TABLES.includes(table)) {
      const admin = service || isAdminUser(user)
      const items = (Array.isArray(body) ? body : [body ?? {}]).map((item) => ({ ...item }))
      const keyOf = { push_subscriptions: 'endpoint', anamneses: 'student_id', student_billing: 'student_id', payments: 'id', coach_settings: 'id' }[table]
      const conflictKey = url.searchParams.get('on_conflict') || keyOf
      const canWrite = (row) => {
        if (table === 'push_subscriptions') return service || (req.method === 'DELETE' && row.user_id === user?.id)
        if (table === 'anamneses') return admin || (req.method !== 'DELETE' && row.student_id === user?.id)
        return admin
      }
      const check = (row) => {
        if (table === 'anamneses' && (typeof row.answers !== 'object' || row.answers === null || Array.isArray(row.answers))) return 'anamneses_answers_check'
        if (table === 'student_billing') {
          if (!(Number(row.monthly_fee) > 0 && Number(row.monthly_fee) <= 100000)) return 'student_billing_monthly_fee_check'
          if (!(Number(row.due_day) >= 1 && Number(row.due_day) <= 31)) return 'student_billing_due_day_check'
        }
        if (table === 'payments') {
          if (!/^\d{4}-\d{2}-01$/.test(String(row.reference_month))) return 'payments_reference_month_check'
          if (!(Number(row.amount) > 0 && Number(row.amount) <= 100000)) return 'payments_amount_check'
          if (!PAYMENT_METHODS.includes(row.method)) return 'payments_method_check'
        }
        if (table === 'coach_settings') {
          if (Number(row.id) !== 1) return 'coach_settings_id_check'
          if (row.pix_key != null && (chars(row.pix_key) < 1 || chars(row.pix_key) > 77)) return 'coach_settings_pix_key_check'
          if (row.pix_name != null && (chars(row.pix_name) < 1 || chars(row.pix_name) > 25)) return 'coach_settings_pix_name_check'
          if (row.pix_city != null && (chars(row.pix_city) < 1 || chars(row.pix_city) > 15)) return 'coach_settings_pix_city_check'
        }
        return null
      }
      const prepare = (row) => {
        if (table === 'anamneses') Object.assign(row, { parq_positive: parqPositive(row.answers), updated_at: new Date().toISOString(), updated_by: user?.id ?? row.updated_by ?? null })
        if (table === 'student_billing' || table === 'coach_settings') row.updated_at = new Date().toISOString()
        if (table === 'student_billing' || table === 'payments') {
          if (row.monthly_fee !== undefined) row.monthly_fee = roundTo(row.monthly_fee, 2)
          if (row.amount !== undefined) row.amount = roundTo(row.amount, 2)
        }
        return row
      }
      const defaults = () => ({
        push_subscriptions: { id: crypto.randomUUID(), user_id: user?.id ?? null, user_agent: null, created_at: new Date().toISOString() },
        anamneses: { answers: {}, created_at: new Date().toISOString() },
        student_billing: { due_day: 10, active: true, starts_on: monthISO(0), last_reminder_on: null, note: null, created_at: new Date().toISOString() },
        payments: { id: crypto.randomUUID(), paid_on: dayISO(0), method: 'pix', note: null, created_by: user?.id ?? null, created_at: new Date().toISOString() },
        coach_settings: { id: 1, pix_key: null, pix_name: null, pix_city: null, billing_reminders: false },
      })[table]

      if (req.method === 'POST') {
        const saved = []
        for (const item of items) {
          const existing = tables[table].find((row) => row[conflictKey] !== undefined && String(row[conflictKey]) === String(item[conflictKey]))
          const target = existing && upsert ? { ...existing, ...item } : { ...defaults(), ...item }
          if (!canWrite(target) || (existing && upsert && !canWrite(existing))) return forbidden()
          if (existing && !upsert) return send(res, 409, { code: '23505', message: `duplicate key value violates unique constraint "${table}_pkey"` })
          if (table === 'payments' && tables.payments.some((row) => row !== existing && row.student_id === target.student_id && row.reference_month === target.reference_month)) {
            return send(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint "payments_student_id_reference_month_key"' })
          }
          const violation = check(target)
          if (violation) return violates(violation)
          prepare(target)
          const before = existing ? { ...existing } : null
          if (existing) Object.assign(existing, target)
          else tables[table].push(target)
          if (table === 'anamneses' && user?.id === target.student_id) notifyAnamnese(before, target)
          saved.push(existing ?? target)
        }
        return send(res, 201, wantsObject ? saved[0] : saved)
      }
      const rows = applyFilters(tables[table], url.searchParams)
      if (req.method === 'PATCH') {
        const allowed = rows.filter((row) => canWrite(row) && (table !== 'coach_settings' || admin))
        for (const row of allowed) {
          const violation = check({ ...row, ...body })
          if (violation) return violates(violation)
        }
        allowed.forEach((row) => Object.assign(row, prepare({ ...row, ...body })))
        return send(res, 200, wantsObject ? allowed[0] ?? null : allowed)
      }
      if (req.method === 'DELETE') {
        const allowed = rows.filter(canWrite)
        for (const row of allowed) tables[table].splice(tables[table].indexOf(row), 1)
        return send(res, 200, allowed)
      }
      return send(res, 405, {})
    }

    if (table === 'workout_sessions' && req.method === 'PATCH') {
      const violation = sessionPatchViolation(user, req, body ?? {})
      if (violation) return send(res, 400, violation)
      const rows = applyFilters(tables[table], url.searchParams).filter((row) => service || row.student_id === user?.id || isAdminUser(user))
      for (const row of rows) {
        const before = { ...row }
        Object.assign(row, body)
        notifyFeedback(before, row)
      }
      return send(res, 200, wantsObject ? rows[0] ?? null : rows.map((row) => visibleRow(table, row)))
    }
    if (req.method === 'POST' && COMMUNITY_TABLES.includes(table)) {
      const items = (Array.isArray(body) ? body : [body]).map((item) => ({ ...item }))
      for (const item of items) {
        if (table === 'community_likes') {
          if (item.user_id !== user?.id) return send(res, 403, { code: '42501', message: 'new row violates row-level security policy for table "community_likes"' })
          if (community_likes.some((like) => like.post_id === item.post_id && like.user_id === item.user_id)) {
            return send(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint "community_likes_pkey"' })
          }
          continue
        }
        // Trigger community_set_author: autor = usuário logado; nome e papel do perfil.
        const profile = profiles.find((entry) => entry.id === user?.id)
        item.author_id = user?.id
        item.author_name = (profile?.full_name || '').trim() || 'Atleta'
        item.author_role = profile?.role ?? 'student'
        if (table === 'community_posts') {
          if (item.pinned && !isAdminUser(user)) return send(res, 403, { code: '42501', message: 'new row violates row-level security policy for table "community_posts"' })
          item.kind = item.kind ?? 'post'
          item.photos = item.photos ?? []
          item.pinned = Boolean(item.pinned)
        }
        if (table === 'community_comments') {
          if (!String(item.body ?? '').trim()) return send(res, 400, { code: '23514', message: 'new row violates check constraint "community_comments_body_check"' })
          const post = community_posts.find((entry) => entry.id === item.post_id)
          if (post && post.author_id !== user?.id) {
            pushNotification({ recipient_id: post.author_id, type: 'community', title: 'Novo comentário 💬', message: `${item.author_name}: ${item.body.slice(0, 140)}` })
          }
        }
      }
      const created = items.map((item) => ({ ...(table === 'community_likes' ? {} : { id: crypto.randomUUID() }), created_at: new Date().toISOString(), ...item }))
      tables[table].push(...created)
      return send(res, 201, wantsObject ? created[0] : created)
    }
    if ((req.method === 'PATCH' || req.method === 'DELETE') && COMMUNITY_TABLES.includes(table)) {
      // RLS: só o treinador altera posts; autor ou treinador apaga; curtida só a própria.
      const allowed = (row) => {
        if (req.method === 'PATCH') return table === 'community_posts' && isAdminUser(user)
        if (table === 'community_likes') return row.user_id === user?.id
        return row.author_id === user?.id || isAdminUser(user)
      }
      const rows = applyFilters(tables[table], url.searchParams).filter(allowed)
      if (req.method === 'PATCH') rows.forEach((row) => Object.assign(row, body))
      else {
        for (const row of rows) tables[table].splice(tables[table].indexOf(row), 1)
        if (table === 'community_posts') {
          const ids = new Set(rows.map((row) => row.id))
          for (const list of [community_likes, community_comments]) {
            for (let index = list.length - 1; index >= 0; index -= 1) if (ids.has(list[index].post_id)) list.splice(index, 1)
          }
        }
      }
      return send(res, 200, wantsObject ? rows[0] ?? null : rows)
    }
    if (table === 'profiles' && req.method === 'PATCH') {
      // RLS de policies.sql + restrições do profile.sql.
      const rows = applyFilters(tables[table], url.searchParams).filter((row) => row.id === user?.id || isAdminUser(user))
      for (const row of rows) {
        const violation = profileViolation({ ...row, ...body })
        if (violation) return send(res, 400, { code: '23514', message: `new row for relation "profiles" violates check constraint "${violation}"` })
      }
      rows.forEach((row) => Object.assign(row, body))
      return send(res, 200, wantsObject ? rows[0] ?? null : rows)
    }
    if (COACH_TABLES.includes(table)) {
      // RLS do coach.sql: notas só do treinador; desafios todos leem, só o treinador escreve.
      if (!isAdminUser(user)) return send(res, 403, { code: '42501', message: `new row violates row-level security policy for table "${table}"` })
      if (req.method === 'POST') {
        const items = (Array.isArray(body) ? body : [body]).map((item) => ({
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...(table === 'coach_notes' ? { pinned: false, author_id: user.id } : { created_by: user.id, description: null }),
          ...item,
        }))
        for (const item of items) {
          if (table === 'coach_notes') {
            if (item.author_id !== user.id) return send(res, 403, { code: '42501', message: 'new row violates row-level security policy for table "coach_notes"' })
            const length = chars(String(item.body ?? '').trim())
            if (length < 1 || length > 1000) return send(res, 400, { code: '23514', message: 'new row for relation "coach_notes" violates check constraint "coach_notes_body_check"' })
          } else {
            if (item.created_by !== user.id) return send(res, 403, { code: '42501', message: 'new row violates row-level security policy for table "challenges"' })
            const titleLength = chars(String(item.title ?? '').trim())
            const span = (new Date(item.ends_on) - new Date(item.starts_on)) / 864e5
            if (titleLength < 3 || titleLength > 60) return send(res, 400, { code: '23514', message: 'new row for relation "challenges" violates check constraint "challenges_title_check"' })
            if (!METRICS.includes(item.metric)) return send(res, 400, { code: '23514', message: 'new row for relation "challenges" violates check constraint "challenges_metric_check"' })
            if (!(Number(item.goal) > 0)) return send(res, 400, { code: '23514', message: 'new row for relation "challenges" violates check constraint "challenges_goal_check"' })
            if (!(span >= 0 && span <= 180)) return send(res, 400, { code: '23514', message: 'new row for relation "challenges" violates check constraint "challenges_period"' })
          }
        }
        tables[table].push(...items)
        return send(res, 201, wantsObject ? items[0] : items)
      }
      const rows = applyFilters(tables[table], url.searchParams)
      if (req.method === 'PATCH') rows.forEach((row) => Object.assign(row, body))
      else if (req.method === 'DELETE') for (const row of rows) tables[table].splice(tables[table].indexOf(row), 1)
      return send(res, 200, wantsObject ? rows[0] ?? null : rows)
    }
    if (table === 'body_measurements') {
      if (req.method === 'POST') {
        const items = (Array.isArray(body) ? body : [body]).map((item) => ({
          id: crypto.randomUUID(),
          measured_on: dayISO(0),
          photos: [],
          note: null,
          created_at: new Date().toISOString(),
          ...item,
          weight_kg: roundTo(item.weight_kg, 2),
          body_fat: roundTo(item.body_fat, 1),
          waist_cm: roundTo(item.waist_cm, 1),
        }))
        for (const item of items) {
          if (item.user_id !== user?.id && !isAdminUser(user)) {
            return send(res, 403, { code: '42501', message: 'new row violates row-level security policy for table "body_measurements"' })
          }
          if (!profiles.some((profile) => profile.id === item.user_id)) {
            return send(res, 409, { code: '23503', message: 'insert or update on table "body_measurements" violates foreign key constraint' })
          }
          const violation = measurementViolation(item)
          if (violation) return send(res, 400, { code: '23514', message: `new row for relation "body_measurements" violates check constraint "${violation}"` })
        }
        tables[table].push(...items)
        return send(res, 201, wantsObject ? items[0] : items)
      }
      if (req.method === 'DELETE') {
        const rows = applyFilters(tables[table], url.searchParams).filter((row) => row.user_id === user?.id || isAdminUser(user))
        for (const row of rows) tables[table].splice(tables[table].indexOf(row), 1)
        return send(res, 200, rows)
      }
      return send(res, 405, { message: 'unsupported' })
    }
    if (req.method === 'POST') {
      const items = (Array.isArray(body) ? body : [body]).map((item) => ({
        id: `${table}-new-${++idCounter}`,
        ...(columnsOf(table).includes('created_at') ? { created_at: new Date().toISOString() } : {}),
        ...(table === 'notifications' && gestaoEnabled ? { pushed_at: null } : {}),
        ...item,
      }))
      // Chave primária (ids gerados no aparelho: reenviar dá 23505).
      for (const item of items) {
        if (tables[table].some((row) => row.id === item.id)) {
          return send(res, 409, { code: '23505', message: `duplicate key value violates unique constraint "${table}_pkey"` })
        }
      }
      tables[table].push(...items)
      return send(res, 201, wantsObject ? items[0] : items)
    }
    if (req.method === 'PATCH' && table === 'notifications') {
      // Só a service_role marca o envio por push (e o treinador edita os seus).
      const rows = applyFilters(tables[table], url.searchParams).filter(() => service || isAdminUser(user))
      rows.forEach((row) => Object.assign(row, body))
      return send(res, 200, wantsObject ? rows[0] ?? null : rows)
    }
    if (req.method === 'PATCH') {
      const rows = applyFilters(tables[table], url.searchParams)
      rows.forEach((row) => Object.assign(row, body))
      return send(res, 200, wantsObject ? rows[0] ?? null : rows)
    }
    if (req.method === 'DELETE') {
      const rows = applyFilters(tables[table], url.searchParams)
      for (const row of rows) tables[table].splice(tables[table].indexOf(row), 1)
      return send(res, 200, rows)
    }
    send(res, 405, {})
  })
  .listen(PORT, () => console.log('mock supabase on', PORT))
