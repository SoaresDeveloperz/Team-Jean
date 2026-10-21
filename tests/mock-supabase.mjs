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
}
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
  { id: 'u-s2', role: 'student', full_name: 'Carlos Lima', email: 'carlos@teste.com', readiness_score: null, created_at: iso(-10) },
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
  { id: 'w-c', student_id: 'u-s2', name: 'Treino C - Peito', is_current: true, created_at: iso(-20) },
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
  { id: 's-c1', assigned_workout_id: 'w-c', student_id: 'u-s2', status: 'completed', completed_at: iso(-8), session_rpe: 9 },
  { id: 's-c2', assigned_workout_id: 'w-c', student_id: 'u-s2', status: 'completed', completed_at: iso(-9), session_rpe: 9 },
  { id: 's-c3', assigned_workout_id: 'w-c', student_id: 'u-s2', status: 'completed', completed_at: iso(-10), session_rpe: 10 },
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
  { id: 'cp-carlos', author_id: 'u-s2', author_name: 'Carlos Lima', author_role: 'student', kind: 'post', body: 'Alguém tem dica de alongamento pós-treino? Tô sentindo muito a lombar.', photos: [], meta: null, pinned: false, created_at: iso(0, -95) },
]
const community_likes = [
  { post_id: 'cp-maria', user_id: 'u-admin', created_at: iso(-1) },
  { post_id: 'cp-coach', user_id: 'u-s2', created_at: iso(-1) },
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

// /__community/off simula o banco sem o community.sql.
let communityEnabled = true
const COMMUNITY_TABLES = ['community_posts', 'community_likes', 'community_comments']

const tables = { profiles, exercises, assigned_workouts, assigned_workout_exercises, workout_sessions, session_sets, notifications, workout_templates, workout_template_exercises, community_posts, community_likes, community_comments, body_measurements, coach_notes, challenges }


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
}
function columnsOf(table) {
  if (table === 'profiles' && profileEnabled) return [...SCHEMA.profiles, ...PROFILE_COLUMNS]
  return SCHEMA[table]
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
    if (op === 'gte') result = result.filter((row) => row[key] && row[key] >= value)
    if (op === 'lt') result = result.filter((row) => row[key] && row[key] < value)
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
  if (row.weight_kg === null && row.body_fat === null && row.waist_cm === null && row.photos.length === 0) return 'body_measurements_has_data'
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
      if (!user || body.password !== '123456') return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
      return send(res, 200, session(user))
    }
    if (url.pathname === '/auth/v1/user') {
      const user = userFromAuth(req)
      if (!user) return send(res, 401, { msg: 'invalid JWT' })
      if (req.method === 'PUT') {
        const body = await readBody(req)
        if (body?.password === '123456') {
          return send(res, 422, { code: 422, error_code: 'same_password', msg: 'New password should be different from the old password.' })
        }
      }
      return send(res, 200, authUser(user))
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
        profiles: profiles.map(({ id, full_name, ...rest }) => ({ id, full_name, ...Object.fromEntries(PROFILE_COLUMNS.map((key) => [key, rest[key]])) })),
        body_measurements,
        coach_notes,
        challenges,
        notifications,
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
            notifications.push({ id: `notifications-new-${++idCounter}`, recipient_id: post.author_id, type: 'community', title: 'Novo comentário 💬', message: `${item.author_name}: ${item.body.slice(0, 140)}` })
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
      const items = (Array.isArray(body) ? body : [body]).map((item) => ({ id: `${table}-new-${++idCounter}`, ...(columnsOf(table).includes('created_at') ? { created_at: new Date().toISOString() } : {}), ...item }))
      tables[table].push(...items)
      return send(res, 201, wantsObject ? items[0] : items)
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
