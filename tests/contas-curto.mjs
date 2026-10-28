// Contas puras da versão curta do treino (src/lib/short-workout.ts). O arquivo
// .ts não tem dependências nem alias "@/", então o Node (22.18+ / 24) importa
// direto, tirando os tipos.
// Uso: node tests/contas-curto.mjs (também roda no roteiro "curto").

// O Node avisa que o .ts "não tem type no package.json": é esperado aqui.
process.removeAllListeners('warning')

const short = await import('../src/lib/short-workout.ts')

const results = []
const check = (name, condition, detail = '') => results.push(`${condition ? 'OK  ' : 'FAIL'} ${name}${condition || !detail ? '' : ` → ${detail}`}`)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const set = (type = 'working', completed = false, extra = false) => ({ type, completed, extra })
const row = (id, ...sets) => ({ id, name: `Exercício ${id}`, sets })
const four = (id) => row(id, set(), set(), set(), set())
const long = ['a', 'b', 'c', 'd', 'e', 'f'].map(four)

// ------------------------------------------------------------ duração
check('a conta de duração é a mesma do resumo do treino (8 séries, 3 exercícios = 20 min)', short.minutesFor(8, 3) === 20, String(short.minutesFor(8, 3)))
check('sem séries, 0 minutos', short.minutesFor(0, 0) === 0)
check('treino de 6 exercícios com 4 séries: cerca de 60 min', short.fullMinutes(long) === 60, String(short.fullMinutes(long)))

// ------------------------------------------------------------ séries escondidas
const rich = [set('warmup'), set('working'), set('working'), set('working'), set('top'), set('working')]
check('com limite 2: aquecimento e série principal ficam; só as 2 primeiras de trabalho', same([...short.hiddenSetIndexes(rich, 2)], [3, 5]), JSON.stringify([...short.hiddenSetIndexes(rich, 2)]))
check('série concluída nunca é escondida', same([...short.hiddenSetIndexes([set(), set(), set('working', true)], 2)], []))
check('série extra do aluno nunca é escondida', same([...short.hiddenSetIndexes([set(), set(), set(), set('working', false, true)], 2)], [2]))
check('treino com poucas séries não perde nenhuma', short.hiddenSetIndexes([set(), set()], 2).size === 0)
check('contagem visível: 4 séries, limite 2 = 2', short.visibleSetCount(four('x').sets, 2) === 2)
check('sem limite (modo completo): todas visíveis', short.visibleSetCount(four('x').sets, null) === 4)

// ------------------------------------------------------------ regra padrão
const plan = short.planShort(long)
check('regra padrão mantém os exercícios do começo, em ordem', same(plan.keep, ['a', 'b', 'c']), JSON.stringify(plan.keep))
check('o que sai é o fim do treino', same(plan.leave, ['d', 'e', 'f']), JSON.stringify(plan.leave))
check('o corte é um bloco só (nunca mantém depois de cortar)', plan.keep.every((id, index) => id === ['a', 'b', 'c', 'd', 'e', 'f'][index]))
check('treino curto estimado cabe na meta de ~20 min', short.shortMinutes(long, new Set(plan.leave)) <= 20, String(short.shortMinutes(long, new Set(plan.leave))))
check('mantendo tudo, a estimativa é a do modo curto sem cortar exercício', short.shortMinutes(long, new Set()) < short.fullMinutes(long))

const heavy = [row('a', ...Array.from({ length: 8 }, () => set())), row('b', ...Array.from({ length: 8 }, () => set())), row('c', set())]
check('pelo menos 2 exercícios ficam, mesmo estourando a meta', short.planShort(heavy, 5).keep.length >= 2)

// ------------------------------------------------------------ quando oferecer
check('treino de ~60 min: oferece a versão curta', short.canOfferShort(long))
check('treino de ~20 min: não oferece', !short.canOfferShort([row('a', set(), set(), set()), row('b', set(), set()), row('c', set(), set(), set())]))
check('treino com 2 exercícios: não oferece (não há o que cortar)', !short.canOfferShort([four('a'), four('b')]))

// ------------------------------------------------------------ estado no aparelho
const state = JSON.stringify({ workoutId: 'w1', day: '2026-10-28', hidden: ['d', 'e'], cap: 2 })
check('estado do mesmo treino e dia é lido', short.parseShortState(state, 'w1', '2026-10-28', ['a', 'd', 'e'])?.hidden.length === 2)
check('estado de outro dia é ignorado', short.parseShortState(state, 'w1', '2026-10-29', ['a', 'd', 'e']) === null)
check('estado de outro treino é ignorado', short.parseShortState(state, 'w2', '2026-10-28', ['a', 'd', 'e']) === null)
check('exercício que não existe mais invalida o estado', short.parseShortState(state, 'w1', '2026-10-28', ['a', 'd']) === null)
check('texto quebrado ou vazio vira null', short.parseShortState('{', 'w1', 'x', []) === null && short.parseShortState(null, 'w1', 'x', []) === null)
check('limite fora do intervalo invalida o estado', short.parseShortState(JSON.stringify({ workoutId: 'w1', day: 'd', hidden: [], cap: 99 }), 'w1', 'd', []) === null)
check('dia local no formato AAAA-MM-DD', short.localDay(new Date(2026, 9, 28, 23, 59)) === '2026-10-28')

console.log(results.join('\n'))
const failed = results.filter((line) => line.startsWith('FAIL')).length
console.log(`\n${results.length - failed} de ${results.length} verificações OK`)
if (failed > 0) process.exitCode = 1
