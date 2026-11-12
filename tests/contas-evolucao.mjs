// Contas puras do relatório de evolução do treinador (src/lib/progress-report.ts):
// referência, percentual, aquecimento fora, exercício sem carga e ordem da lista.
// Uso: node tests/contas-evolucao.mjs (também roda no roteiro "evolucao").
process.removeAllListeners('warning')
const report = await import('../src/lib/progress-report.ts')

const results = []
const check = (name, condition, detail = '') => results.push(`${condition ? 'OK  ' : 'FAIL'} ${name}${condition || !detail ? '' : ` → ${detail}`}`)

const day = (n) => new Date(2026, 10, n, 9).toISOString()
const sessions = [
  { id: 's1', completed_at: day(3) },
  { id: 's2', completed_at: day(10) },
  { id: 's3', completed_at: day(15) },
]
const set = (session_id, exercise_id, weight_kg, reps, set_type = 'normal') => ({ session_id, exercise_id, weight_kg, reps, set_type })
const periodStart = new Date(2026, 10, 9)

// Exemplo do Jean: supino com 50 no dia 10 e 52 no dia 15 (dia 3 fica antes do período).
const supino = report.buildTrends(sessions, [set('s1', 'sup', 48, 8), set('s2', 'sup', 50, 10), set('s2', 'sup', 45, 12), set('s3', 'sup', 52, 8), set('s3', 'sup', 60, 3, 'warmup')], periodStart)[0]
check('referência é o último treino antes do período', supino.base.sessionId === 's1' && supino.base.weight === 48)
check('atual é o último treino do período, sem contar aquecimento', supino.latest.weight === 52 && supino.latest.reps === 8)
check('percentual 48 → 52 = +8%', report.formatChange(supino.change) === '+8%', supino.change)
check('gráfico tem a referência e os treinos do período', supino.points.map((p) => p.sessionId).join() === 's1,s2,s3')

const semAntes = report.buildTrends(sessions.slice(1), [set('s2', 'sup', 50, 10), set('s3', 'sup', 52, 10)], periodStart)[0]
check('sem treino antes: compara o primeiro e o último do período (50 → 52 = +4%)', report.formatChange(semAntes.change) === '+4%')

const queda = report.buildTrends(sessions, [set('s2', 'agach', 100, 5), set('s3', 'agach', 90, 5)], periodStart)[0]
check('queda de carga: -10% e tipo "down"', report.formatChange(queda.change) === '-10%' && report.trendKind(queda) === 'down')

const unico = report.buildTrends(sessions, [set('s3', 'rosca', 12, 10)], periodStart)[0]
check('um registro só: sem percentual ("first")', unico.change === null && report.trendKind(unico) === 'first')

const barra = report.buildTrends(sessions, [set('s2', 'barra', 0, 6), set('s3', 'barra', 0, 9)], periodStart)[0]
check('sem carga compara repetições (6 → 9 = +50%)', barra.unit === 'reps' && report.formatChange(barra.change) === '+50%')

check('fora do período não entra no relatório', report.buildTrends(sessions, [set('s1', 'leg', 80, 10)], periodStart).length === 0)
const pouco = report.buildTrends(sessions, [set('s2', 'x', 250, 5), set('s3', 'x', 251, 5)], periodStart)[0]
check('+0,4% aparece como "manteve"', report.trendKind(pouco) === 'same')
check('série sem carga e sem repetição é ignorada', report.buildTrends(sessions, [set('s3', 'y', null, null)], periodStart).length === 0)

const ordem = report.sortTrends([unico, supino, queda, pouco, semAntes]).map((t) => report.trendKind(t)).join()
check('ordem: quedas, altas (maior primeiro), manteve, primeiro registro', ordem === 'down,up,up,same,first', ordem)

console.log(results.join('\n'))
const failed = results.filter((line) => line.startsWith('FAIL')).length
console.log(`\n${results.length - failed} de ${results.length} verificações OK`)
if (failed > 0) process.exitCode = 1
