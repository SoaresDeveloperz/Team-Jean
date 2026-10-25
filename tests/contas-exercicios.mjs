// Contas puras dos GIFs dos exercícios: endereço do GIF (src/lib/exercises/media.ts),
// busca na biblioteca (src/lib/exercises/library.ts) e os arquivos gerados
// (public/exercicios/, supabase/exercicios-casamento.sql). Os .ts não têm
// dependências nem alias "@/", então o Node (22.18+ / 24) importa direto.
// Uso: node tests/contas-exercicios.mjs (também roda no roteiro "exercicios").
import { readFileSync, readdirSync } from 'node:fs'

// O Node avisa que o .ts "não tem type no package.json": é esperado aqui.
process.removeAllListeners('warning')

const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')
const results = []
const check = (name, condition, detail = '') => results.push(`${condition ? 'OK  ' : 'FAIL'} ${name}${condition || !detail ? '' : ` → ${detail}`}`)

// Cada import com "?caso" reavalia o arquivo com a variável do momento.
async function mediaWith(value, tag) {
  if (value === undefined) delete process.env.NEXT_PUBLIC_EXERCISE_MEDIA_BASE_URL
  else process.env.NEXT_PUBLIC_EXERCISE_MEDIA_BASE_URL = value
  return import(`../src/lib/exercises/media.ts?${tag}`)
}

// ------------------------------------------------------ base dos GIFs
const CDN = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/videos'
const semVariavel = await mediaWith(undefined, 'sem')
check('sem a variável: base padrão é a CDN do dataset', semVariavel.EXERCISE_MEDIA_BASE === CDN, semVariavel.EXERCISE_MEDIA_BASE)
check('sem a variável: GIF vem da CDN', semVariavel.exerciseGifUrl('0025-EIeI8Vf') === `${CDN}/0025-EIeI8Vf.gif`, semVariavel.exerciseGifUrl('0025-EIeI8Vf'))
const vazia = await mediaWith('', 'vazia')
check('variável vazia: também usa a CDN', vazia.EXERCISE_MEDIA_BASE === CDN)

const desligado = await mediaWith('off', 'off')
check('com "off": base null (GIFs desligados)', desligado.EXERCISE_MEDIA_BASE === null)
check('com "off": exerciseGifUrl devolve null', desligado.exerciseGifUrl('0025-EIeI8Vf') === null)
const desligadoMaiusculo = await mediaWith('  OFF ', 'OFF')
check('"OFF" com espaços também desliga', desligadoMaiusculo.EXERCISE_MEDIA_BASE === null)

const propria = await mediaWith('https://arquivos.teamjean.app/gifs/', 'propria')
check('base própria tem prioridade e perde a barra do fim', propria.EXERCISE_MEDIA_BASE === 'https://arquivos.teamjean.app/gifs')
check('base própria: endereço do GIF', propria.exerciseGifUrl('0001-2gPfomN') === 'https://arquivos.teamjean.app/gifs/0001-2gPfomN.gif')
const { resolveMediaBase, exerciseGifUrl, isValidMediaId } = propria
check('http também vale (Supabase falso dos testes)', resolveMediaBase('http://localhost:54321/__gif') === 'http://localhost:54321/__gif')
for (const invalid of ['javascript:alert(1)', 'ftp://exemplo.com/gifs', 'data:image/gif;base64,AAAA', 'gifs', '//exemplo.com', 'https://exemplo.com/gifs?token=1', 'https://user:senha@exemplo.com']) {
  check(`base inválida desliga os GIFs: ${invalid}`, resolveMediaBase(invalid) === null, String(resolveMediaBase(invalid)))
}

// ------------------------------------------------------ media_id
const base = 'https://cdn.exemplo/videos'
check('media_id válido vira endereço', exerciseGifUrl('0025-EIeI8Vf', base) === 'https://cdn.exemplo/videos/0025-EIeI8Vf.gif')
for (const invalid of ['videos/0001-2gPfomN', 'http://malicioso.com/x', '../segredo', '0001.gif', '', ' ', 'a b', 'a'.repeat(65), null, undefined, 42]) {
  check(`media_id inválido não vira endereço: ${JSON.stringify(invalid)}`, exerciseGifUrl(invalid, base) === null && !isValidMediaId(invalid))
}
check('media_id de 64 caracteres ainda vale', isValidMediaId('a'.repeat(64)))
check('sem base (off), nenhum GIF', exerciseGifUrl('0025-EIeI8Vf', null) === null)

// ------------------------------------------------------ biblioteca gerada
const library = await import('../src/lib/exercises/library.ts')
const muscles = await import('../src/lib/muscles.ts')
const { baseExerciseCatalog } = await import('../src/lib/exercises/catalog.ts')
const index = JSON.parse(read('public/exercicios/biblioteca.json'))
const items = index.itens
const size = Buffer.byteLength(read('public/exercicios/biblioteca.json'))
check('biblioteca com os 1.324 exercícios', items.length === 1324 && index.total === 1324, String(items.length))
check(`índice pequeno (${Math.round(size / 1024)} KB < 600 KB)`, size < 600 * 1024)
const FIELDS = ['id', 'media', 'nome', 'nome_en', 'grupo', 'equipamento', 'musculo_alvo', 'credito']
check('nenhum campo vazio', items.every((item) => FIELDS.every((field) => typeof item[field] === 'string' && item[field].trim() !== '')))
check('sem campos a mais (instruções em outros idiomas ficam de fora)', items.every((item) => Object.keys(item).sort().join() === [...FIELDS].sort().join()))
check('todo media passa na regra do banco', items.every((item) => isValidMediaId(item.media)))
check('todo exercício com o crédito da Gym visual', items.every((item) => item.credito === '© Gym visual — https://gymvisual.com/') && index.credito === '© Gym visual — https://gymvisual.com/')
check('ids e arquivos sem repetição', new Set(items.map((item) => item.id)).size === 1324 && new Set(items.map((item) => item.media)).size === 1324)
const names = items.map((item) => item.nome.toLocaleLowerCase('pt-BR'))
check('nomes em português sem repetição', new Set(names).size === names.length)
check('nome em português diferente do inglês na maioria', items.filter((item) => item.nome.toLowerCase() !== item.nome_en.toLowerCase()).length > 1200)
check('sem codificação quebrada nos nomes ("45в°")', items.every((item) => !/в°/.test(item.nome_en + item.nome)))
const LABELS = ['Peito', 'Costas', 'Pernas', 'Glúteos', 'Ombros', 'Bíceps', 'Tríceps', 'Abdômen', 'Panturrilhas', 'Trapézio', 'Antebraços', 'Lombar', 'Cardio', 'Pescoço']
check('grupos com os rótulos do app', items.every((item) => LABELS.includes(item.grupo)), [...new Set(items.map((item) => item.grupo))].join(', '))
check(
  'todo grupo (menos Cardio e Pescoço) acende o mapa muscular e o corpo 3D',
  LABELS.filter((label) => !['Cardio', 'Pescoço'].includes(label)).every((label) => muscles.regionsFor(label).length > 0),
)
check('total por grupo confere', index.grupos.every(({ grupo, total }) => items.filter((item) => item.grupo === grupo).length === total))

const stepsFiles = readdirSync(new URL('public/exercicios/passos/', root))
const steps = Object.assign({}, ...stepsFiles.map((file) => JSON.parse(read(`public/exercicios/passos/${file}`))))
check('passo a passo de todos os exercícios, separado por grupo', items.every((item) => Array.isArray(steps[item.id]) && steps[item.id].length > 0))
check('cada grupo aponta para o arquivo de passos certo', index.grupos.every(({ grupo, passos }) => {
  const file = JSON.parse(read(`public/exercicios/${passos}`))
  return items.filter((item) => item.grupo === grupo).every((item) => item.id in file)
}))

// ------------------------------------------------------ busca
const nomes = (list) => list.map((item) => item.nome)
const supino = library.searchLibrary(items, { term: 'supino' })
check('"supino" acha o Supino Reto com Barra entre os primeiros', nomes(supino).slice(0, 10).includes('Supino Reto com Barra'), nomes(supino).slice(0, 10).join(' | '))
check('"supino" só traz supinos', supino.length > 10 && supino.every((item) => /supino|bench|press/i.test(item.nome + item.nome_en)))
check('busca sem acento e com várias palavras ("triceps frances halteres")', nomes(library.searchLibrary(items, { term: 'triceps frances halteres' })).includes('Tríceps Francês Sentado com Halteres'))
check('busca pelo nome em inglês ("lat pulldown")', library.searchLibrary(items, { term: 'lat pulldown' }).length > 0)
const peitoHalteres = library.searchLibrary(items, { group: 'Peito', equipment: 'Halteres' })
check('filtro de grupo e equipamento', peitoHalteres.length > 10 && peitoHalteres.every((item) => item.grupo === 'Peito' && item.equipamento === 'Halteres'))
check('sem filtro: todos', library.searchLibrary(items, {}).length === 1324)
check('termo sem resultado: lista vazia', library.searchLibrary(items, { term: 'xyzxyz' }).length === 0)
check('nome exato vem primeiro', library.searchLibrary(items, { term: 'Barra Fixa' })[0].nome === 'Barra Fixa')
const equips = library.equipmentOptions(items, 'Peito')
check('equipamentos do grupo, os mais comuns primeiro', equips.length > 3 && equips.includes('Halteres') && !equips.includes('Bicicleta ergométrica'))
check('páginas de 20 resultados', library.LIBRARY_PAGE_SIZE === 20)

let calls = 0
const failing = async () => {
  calls += 1
  if (calls === 1) throw new TypeError('Failed to fetch')
  return { ok: true, json: async () => index }
}
const firstTry = await library.loadExerciseLibrary(failing).then(() => 'ok', () => 'erro')
const secondTry = await library.loadExerciseLibrary(failing).then((value) => value.itens.length, () => 'erro')
check('sem internet a biblioteca falha e tenta de novo na próxima abertura', firstTry === 'erro' && secondTry === 1324, `${firstTry} / ${secondTry}`)
check('depois de carregar, não baixa de novo', (await library.loadExerciseLibrary(failing)).itens.length === 1324 && calls === 2)

// ------------------------------------------------------ casamento e catálogo
const byMedia = new Map(items.map((item) => [item.media, item]))
const casamento = read('supabase/exercicios-casamento.sql')
const updates = casamento.split('\n').filter((line) => /^\s*update\b/i.test(line))
const statements = casamento.split('\n').filter((line) => line.trim() && !line.trim().startsWith('--'))
check('casamento com 51 exercícios', updates.length === 51, String(updates.length))
check(
  'casamento só preenche quem está sem GIF (reaplicável) e nunca renomeia',
  updates.every((line) => /^update public\.exercises set media_id = '[A-Za-z0-9_-]+' where lower\(name\) = lower\('(?:[^']|'')+'\) and media_id is null;$/.test(line)),
)
check('casamento sem delete, insert ou troca de nome', statements.every((line) => /^(update public\.exercises set media_id|alter table public\.exercises add column if not exists media_id text;)/.test(line)))
check('todo GIF do casamento existe na biblioteca', updates.every((line) => byMedia.has(line.match(/media_id = '([^']+)'/)[1])))
check('cabeçalho avisa que o casamento é deste banco', /ESPEC[ÍI]FICO do banco do Team Jean/i.test(casamento))
check('catálogo base: GIFs existem na biblioteca', baseExerciseCatalog.every((item) => item.media === null || byMedia.has(item.media)))
check('catálogo base: mesmo GIF do casamento', baseExerciseCatalog.every((item) => {
  if (item.media === null) return !updates.some((line) => line.includes(`lower('${item.name}')`))
  return updates.some((line) => line.includes(`'${item.media}'`) && line.includes(`lower('${item.name}')`))
}))

// ------------------------------------------------------ nenhum endereço de GIF solto
const sources = ['src/lib/exercises/media.ts', 'src/components/workout/ExerciseGif.tsx', 'src/components/admin/ExerciseLibrarySearch.tsx', 'src/app/admin/exercises/page.tsx', 'src/components/workout/session/ExerciseBlock.tsx']
check('só o media.ts conhece a CDN', sources.filter((file) => read(file).includes('jsdelivr')).join() === 'src/lib/exercises/media.ts')
check('test:build aponta os GIFs para o Supabase falso', JSON.parse(read('package.json')).scripts['test:build'].includes('NEXT_PUBLIC_EXERCISE_MEDIA_BASE_URL=http://localhost:54321/__gif'))
check('.env.example documenta a variável', /^#?\s*NEXT_PUBLIC_EXERCISE_MEDIA_BASE_URL=/m.test(read('.env.example')))

console.log(results.join('\n'))
const failed = results.filter((line) => line.startsWith('FAIL')).length
console.log(`\n${results.length - failed} de ${results.length} verificações OK`)
if (failed > 0) process.exitCode = 1
