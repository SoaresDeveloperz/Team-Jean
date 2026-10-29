// Contas puras do "Trocar exercício" (src/lib/swap-exercise.ts). O arquivo .ts
// não tem dependências nem alias "@/", então o Node (22.18+ / 24) importa
// direto, tirando os tipos.
// Uso: node tests/contas-trocar.mjs (também roda no roteiro "trocar").

// O Node avisa que o .ts "não tem type no package.json": é esperado aqui.
process.removeAllListeners('warning')

const swap = await import('../src/lib/swap-exercise.ts')

const results = []
const check = (name, condition, detail = '') => results.push(`${condition ? 'OK  ' : 'FAIL'} ${name}${condition || !detail ? '' : ` → ${detail}`}`)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const lib = [
  { id: 'supino', name: 'Supino Reto com Barra', muscle_group: 'Peito', media_id: '0025-EIeI8Vf' },
  { id: 'crucifixo', name: 'Crucifixo com Halteres', muscle_group: 'Peito', media_id: '0308-yz9nUhF' },
  { id: 'inclinado', name: 'Supino Inclinado com Halteres', muscle_group: 'Peito', media_id: '0314-ns0SIbU' },
  { id: 'maquina', name: 'Crucifixo Máquina', muscle_group: 'Peito', media_id: null },
  { id: 'flexao', name: 'Flexão de Braços', muscle_group: 'Peito', media_id: null },
  { id: 'puxada', name: 'Puxada Frontal', muscle_group: 'Costas', media_id: '0198-RVwzP10' },
  { id: 'prancha', name: 'Prancha', muscle_group: null, media_id: null },
]
const ids = (options) => options.map((option) => option.id)
const original = { exercise_id: 'supino', muscle_group: 'Peito' }

// ------------------------------------------------------------ sugestão pelo grupo muscular
const auto = swap.swapOptions({ original, library: lib, taken: new Set(['supino']) })
check('sem alternativas do treinador: sugere do mesmo grupo (Peito), no máximo 3', auto.length === 3 && auto.every((option) => option.muscle_group === 'Peito'), JSON.stringify(ids(auto)))
check('sugestão não inclui o próprio exercício nem outro grupo', !ids(auto).includes('supino') && !ids(auto).includes('puxada'))
check('sugestões com GIF vêm primeiro', same(ids(auto).slice(0, 2).sort(), ['crucifixo', 'inclinado']), JSON.stringify(ids(auto)))
check('toda sugestão do app vem marcada como "app"', auto.every((option) => option.source === 'app'))
check('ordem estável (mesma entrada, mesma saída)', same(ids(auto), ids(swap.swapOptions({ original, library: [...lib].reverse(), taken: new Set(['supino']) }))))

// ------------------------------------------------------------ alternativas do treinador
const manual = swap.swapOptions({ original, alternatives: ['flexao'], library: lib, taken: new Set(['supino']) })
check('alternativa do treinador vem primeiro e marcada como "jean"', manual[0].id === 'flexao' && manual[0].source === 'jean', JSON.stringify(manual))
check('depois da escolha do treinador, completa com sugestões até 3', manual.length === 3 && manual.slice(1).every((option) => option.source === 'app'))
check('alternativa que não existe mais na biblioteca é ignorada', !ids(swap.swapOptions({ original, alternatives: ['apagado'], library: lib, taken: new Set() })).includes('apagado'))
check('alternativa repetida aparece uma vez só', ids(swap.swapOptions({ original, alternatives: ['flexao', 'flexao'], library: lib, taken: new Set() })).filter((id) => id === 'flexao').length === 1)
check('alternativa que é o próprio exercício é ignorada', !ids(swap.swapOptions({ original, alternatives: ['supino'], library: lib, taken: new Set() })).includes('supino'))
check('exercício que já está no treino de hoje não é oferecido', !ids(swap.swapOptions({ original, alternatives: ['crucifixo'], library: lib, taken: new Set(['crucifixo']) })).includes('crucifixo'))

// ------------------------------------------------------------ essencial
const essentialNoAlt = swap.swapOptions({ original, essential: true, library: lib, taken: new Set() })
check('essencial sem alternativa do treinador: nenhuma opção (nada de sugestão automática)', essentialNoAlt.length === 0)
const essentialAlt = swap.swapOptions({ original, essential: true, alternatives: ['flexao', 'maquina'], library: lib, taken: new Set() })
check('essencial só troca pelas alternativas do treinador', same(ids(essentialAlt), ['flexao', 'maquina']) && essentialAlt.every((option) => option.source === 'jean'), JSON.stringify(essentialAlt))

// ------------------------------------------------------------ casos de borda
check('exercício sem grupo muscular e sem alternativas: nenhuma opção', swap.swapOptions({ original: { exercise_id: 'prancha', muscle_group: null }, library: lib, taken: new Set() }).length === 0)
check('grupo muscular ignora maiúsculas e acentos', swap.swapOptions({ original: { exercise_id: 'x', muscle_group: 'PEITO' }, library: lib, taken: new Set() }).length === 3)
check('biblioteca vazia: nenhuma opção', swap.swapOptions({ original, library: [], taken: new Set() }).length === 0)
check('limites: 3 opções para o aluno e 5 alternativas para o treinador', swap.SWAP_MAX_OPTIONS === 3 && swap.SWAP_MAX_ALTERNATIVES === 5)

// ------------------------------------------------------------ quando oferecer o botão
const some = swap.swapOptions({ original, library: lib, taken: new Set() })
check('botão aparece com opções e sem série feita', swap.canOfferSwap(some, 0))
check('depois de uma série feita no exercício, o botão some', !swap.canOfferSwap(some, 1))
check('sem opções, o botão não aparece', !swap.canOfferSwap([], 0))

// ------------------------------------------------------------ estado no aparelho
const state = JSON.stringify({ workoutId: 'w1', day: '2026-10-28', swaps: { a1: 'flexao', a2: 'maquina' } })
const valid = (raw, workout = 'w1', day = '2026-10-28', rows = ['a1', 'a2'], exs = ['flexao', 'maquina']) => swap.parseSwapState(raw, workout, day, rows, exs)
check('estado do mesmo treino e dia é lido', same(valid(state), { a1: 'flexao', a2: 'maquina' }))
check('estado de outro dia é ignorado', same(valid(state, 'w1', '2026-10-29'), {}))
check('estado de outro treino é ignorado', same(valid(state, 'w2'), {}))
check('linha do treino que não existe mais sai do estado', same(valid(state, 'w1', '2026-10-28', ['a1']), { a1: 'flexao' }))
check('exercício que saiu da biblioteca sai do estado', same(valid(state, 'w1', '2026-10-28', ['a1', 'a2'], ['flexao']), { a1: 'flexao' }))
check('texto quebrado, vazio ou de tipo errado vira {}', same(valid('{'), {}) && same(valid(null), {}) && same(valid(JSON.stringify({ workoutId: 'w1', day: '2026-10-28', swaps: 'x' })), {}))

console.log(results.join('\n'))
const failed = results.filter((line) => line.startsWith('FAIL')).length
console.log(`\n${results.length - failed} de ${results.length} verificações OK`)
if (failed > 0) process.exitCode = 1
