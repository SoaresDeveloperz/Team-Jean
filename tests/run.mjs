// Roda os testes de ponta a ponta contra o app de produção (next start) e um
// Supabase falso (tests/mock-supabase.mjs). Cada roteiro começa com o banco
// falso zerado.
//
// Uso: pnpm build && pnpm test:e2e            (todos)
//      node tests/run.mjs e2e coach            (só alguns roteiros)
// O build precisa ter NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 e
// NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-mock (o pnpm test:build já faz isso).
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import webpush from 'web-push'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PORT = Number(process.env.PORT || 3200)
const BASE = `http://localhost:${PORT}`
const MOCK = 'http://localhost:54321'

const ROUTES = {
  anon: ['/login', '/esqueci-senha'],
  maria: ['/student/today', '/student/week', '/student/history', '/student/progress', '/student/profile', '/student/community'],
  jean: ['/admin', '/admin/students', '/admin/workouts', '/admin/exercises', '/admin/announcements', '/admin/community', '/admin/finance'],
}
const SUITES = {
  e2e: ['tests/e2e.cjs'],
  gestao: ['tests/e2e-gestao.cjs'],
  // Aquecimento com anilhas e WhatsApp para quem sumiu (contas puras + telas).
  novidades: ['tests/contas-novidades.mjs', 'tests/e2e-novidades.cjs'],
  // GIFs dos exercícios: treino do aluno, biblioteca do treinador e o banco sem o SQL.
  exercicios: ['tests/contas-exercicios.mjs', 'tests/e2e-exercicios.cjs'],
  // "Tenho pouco tempo" (versão curta do treino): contas puras + telas, com e sem o SQL.
  curto: ['tests/contas-curto.mjs', 'tests/e2e-curto.cjs'],
  routes: [
    ['tests/a11y/a11y.cjs', 'anon', ...ROUTES.anon],
    ['tests/a11y/a11y.cjs', 'maria', ...ROUTES.maria],
    ['tests/a11y/a11y.cjs', 'jean', ...ROUTES.jean],
  ],
  admin: ['tests/a11y/admin-a11y.cjs'],
  coach: ['tests/a11y/coach-a11y.cjs'],
  community: ['tests/a11y/community-a11y.cjs'],
  profile: ['tests/a11y/profile-a11y.cjs'],
  'gestao-a11y': ['tests/a11y/gestao-a11y.cjs'],
  'novidades-a11y': ['tests/a11y/novidades-a11y.cjs'],
  'exercicios-a11y': ['tests/a11y/exercicios-a11y.cjs'],
  'curto-a11y': ['tests/a11y/curto-a11y.cjs'],
}

const vapid = webpush.generateVAPIDKeys()
const appEnv = {
  ...process.env,
  NODE_ENV: 'production',
  SUPABASE_SERVICE_ROLE_KEY: 'service-mock',
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  VAPID_SUBJECT: 'mailto:testes@teamjean.app',
  CRON_SECRET: 'cron-teste',
  // Só nos testes: aceita "aparelhos" falsos que entregam o push no mock.
  PUSH_TEST_ENDPOINT_PREFIX: `${MOCK}/__push/`,
}

const children = new Set()
function start(command, args, env, label) {
  const child = spawn(command, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] })
  children.add(child)
  const prefix = (chunk) =>
    chunk
      .toString()
      .split('\n')
      .filter(Boolean)
      .map((line) => `[${label}] ${line}`)
      .join('\n')
  child.stdout.on('data', (chunk) => process.env.VERBOSE && console.log(prefix(chunk)))
  child.stderr.on('data', (chunk) => console.error(prefix(chunk)))
  child.on('exit', () => children.delete(child))
  return child
}

async function waitFor(url, timeout = 60_000) {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    try {
      const response = await fetch(url, { redirect: 'manual' })
      if (response.status < 500) return
    } catch {
      // ainda subindo
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`${url} não respondeu a tempo`)
}

function stop(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve()
    child.once('exit', resolve)
    child.kill('SIGTERM')
  })
}

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, env: { ...process.env, BASE }, stdio: 'inherit' })
    children.add(child)
    child.on('exit', (code) => {
      children.delete(child)
      resolve(code ?? 1)
    })
  })
}

process.on('SIGINT', () => {
  children.forEach((child) => child.kill('SIGTERM'))
  process.exit(130)
})

const wanted = process.argv.slice(2)
const suites = wanted.length > 0 ? wanted : Object.keys(SUITES)
const unknown = suites.filter((name) => !SUITES[name])
if (unknown.length > 0) {
  console.error(`Roteiros desconhecidos: ${unknown.join(', ')}. Opções: ${Object.keys(SUITES).join(', ')}`)
  process.exit(1)
}

const failures = []
let mock = null
let app = null
try {
  app = start(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], appEnv, 'app')
  for (const name of suites) {
    for (const entry of SUITES[name]) {
      const [script, ...args] = Array.isArray(entry) ? entry : [entry]
      await stop(mock)
      mock = start(process.execPath, ['tests/mock-supabase.mjs'], process.env, 'mock')
      await waitFor(`${MOCK}/__log`)
      await waitFor(`${BASE}/login`, 120_000)
      const label = [script, ...args.slice(0, 1)].join(' ')
      console.log(`\n▶ ${label}`)
      const code = await run([script, ...args])
      if (code !== 0) failures.push(label)
    }
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error))
} finally {
  await stop(mock)
  await stop(app)
}

console.log(failures.length === 0 ? '\nTestes de ponta a ponta: tudo certo' : `\nFalharam: ${failures.join(' · ')}`)
process.exit(failures.length === 0 ? 0 : 1)
