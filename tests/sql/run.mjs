// Testa os arquivos supabase/*.sql num Postgres de verdade: cada teste roda
// num banco novo, com os arquivos aplicados duas vezes (idempotência) e em
// duas ordens diferentes.
//
// Uso: PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres node tests/sql/run.mjs
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const root = new URL('../../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

const ORDERS = [
  ['policies.sql', 'community.sql', 'profile.sql', 'coach.sql', 'gestao.sql', 'exercicios.sql', 'exercicios-casamento.sql', 'treino-curto.sql'],
  ['treino-curto.sql', 'exercicios-casamento.sql', 'policies.sql', 'gestao.sql', 'coach.sql', 'exercicios.sql', 'profile.sql', 'community.sql'],
]
const TESTS = ['rls-test.sql', 'rls-profile.sql', 'rls-coach.sql', 'rls-gestao.sql', 'rls-funcoes.sql', 'rls-exercicios.sql', 'rls-curto.sql']
// Num teste, a linha "-- @incluir supabase/arquivo.sql" roda aquele arquivo ali
// (ex.: reaplicar o casamento dos GIFs depois de cadastrar exercícios).
const withIncludes = (sql) => sql.replace(/^--\s*@incluir\s+(\S+)\s*$/gm, (_, path) => `${read(path)}\n;`)

function psql(database, sql) {
  const result = spawnSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', database], { input: sql, encoding: 'utf8' })
  if (result.error) throw result.error
  return result
}

let failures = 0
let passed = 0

for (const [orderIndex, order] of ORDERS.entries()) {
  for (const test of TESTS) {
    const database = `tj_${orderIndex}_${test.replace(/\W/g, '_')}`
    const label = `${test} (ordem ${orderIndex + 1})`
    const setup = psql('postgres', `drop database if exists ${database};\ncreate database ${database};`)
    if (setup.status !== 0) {
      console.error(`FALHOU ${label}: não criou o banco\n${setup.stderr}`)
      process.exit(1)
    }
    const files = [read('tests/sql/stub.sql'), ...order.map((file) => read(`supabase/${file}`)), ...order.map((file) => read(`supabase/${file}`))]
    const applied = psql(database, files.join('\n;\n'))
    if (applied.status !== 0) {
      failures += 1
      console.error(`FALHOU ${label}: erro ao aplicar ${order.join(', ')}\n${applied.stderr}`)
      psql('postgres', `drop database if exists ${database};`)
      continue
    }
    const run = psql(database, withIncludes(read(`tests/sql/${test}`)))
    const notices = run.stderr
      .split('\n')
      .map((line) => line.replace(/^(psql:[^:]*:\d+: )?(NOTICE|ERROR):\s+/, ''))
      .filter((line) => /^(OK|FALHOU)/.test(line))
    const failed = notices.filter((line) => line.startsWith('FALHOU'))
    const ok = notices.filter((line) => line.startsWith('OK'))
    if (run.status !== 0 || failed.length > 0 || ok.length === 0) {
      failures += 1
      console.error(`FALHOU ${label}`)
      failed.forEach((line) => console.error(`  ${line}`))
      if (run.status !== 0) console.error(run.stderr.split('\n').filter((line) => /ERROR/.test(line)).join('\n'))
    } else {
      passed += ok.length
      console.log(`ok ${label}: ${ok.length} verificações`)
    }
    psql('postgres', `drop database if exists ${database};`)
  }
}

console.log(failures === 0 ? `\nSQL: tudo certo (${passed} verificações)` : `\nSQL: ${failures} arquivo(s) com falha`)
process.exit(failures === 0 ? 0 : 1)
