// Gera a biblioteca de exercícios com GIFs (public/exercicios/) a partir do
// dataset público https://github.com/hasaneyldrm/exercises-dataset e dos nomes
// traduzidos para o português do Brasil.
//
// Uso (Node 24, sem dependências):
//   node scripts/gerar-biblioteca-exercicios.mjs --dataset caminho/exercises.json
//   node scripts/gerar-biblioteca-exercicios.mjs --dataset caminho/exercises.json \
//     --nomes saida-1.json saida-2.json saida-3.json saida-4.json
//
// --dataset  o exercises.json do repositório (≈17 MB; não vai para o Git).
// --nomes    arquivos {"<id>": "<nome em português>"} para juntar. Sem esta
//            opção, usa os nomes já juntados em scripts/dados/exercicios-nomes-pt.json
//            (com ela, esse arquivo é regravado com a junção).
//
// Saída:
//   public/exercicios/biblioteca.json        índice para a busca do treinador
//                                            (nome, grupo, equipamento, GIF, crédito)
//   public/exercicios/passos/<grupo>.json    passo a passo (em inglês por ora),
//                                            separado por grupo para o índice
//                                            ficar pequeno
//
// O script para com erro se algum exercício ficar sem nome em português, com
// valor vazio, com nome repetido ou com grupo/equipamento sem tradução.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const NOMES_JUNTADOS = `${ROOT}scripts/dados/exercicios-nomes-pt.json`
const SAIDA = `${ROOT}public/exercicios`
const CREDITO = '© Gym visual — https://gymvisual.com/'
// Mesmo formato aceito pelo banco (supabase/exercicios.sql) e pelo app.
const MEDIA = /^[A-Za-z0-9_-]{1,64}$/

// Músculo-alvo do dataset → grupo muscular do app (mesmos rótulos de
// src/lib/workouts.ts, que o mapa muscular e o corpo 3D já reconhecem).
const GRUPOS = {
  abs: 'Abdômen',
  pectorals: 'Peito',
  'serratus anterior': 'Peito',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  glutes: 'Glúteos',
  abductors: 'Glúteos',
  adductors: 'Pernas',
  quads: 'Pernas',
  hamstrings: 'Pernas',
  delts: 'Ombros',
  'upper back': 'Costas',
  lats: 'Costas',
  spine: 'Lombar',
  traps: 'Trapézio',
  calves: 'Panturrilhas',
  forearms: 'Antebraços',
  'cardiovascular system': 'Cardio',
  'levator scapulae': 'Pescoço',
}
const ARQUIVO_DO_GRUPO = {
  Abdômen: 'abdomen',
  Peito: 'peito',
  Bíceps: 'biceps',
  Tríceps: 'triceps',
  Glúteos: 'gluteos',
  Pernas: 'pernas',
  Ombros: 'ombros',
  Costas: 'costas',
  Lombar: 'lombar',
  Trapézio: 'trapezio',
  Panturrilhas: 'panturrilhas',
  Antebraços: 'antebracos',
  Cardio: 'cardio',
  Pescoço: 'pescoco',
}
const MUSCULOS = {
  abs: 'Abdômen',
  pectorals: 'Peitoral',
  'serratus anterior': 'Serrátil anterior',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  glutes: 'Glúteos',
  abductors: 'Abdutores',
  adductors: 'Adutores',
  quads: 'Quadríceps',
  hamstrings: 'Posteriores da coxa',
  delts: 'Deltoides',
  'upper back': 'Parte alta das costas',
  lats: 'Dorsais',
  spine: 'Eretores da coluna (lombar)',
  traps: 'Trapézio',
  calves: 'Panturrilhas',
  forearms: 'Antebraços',
  'cardiovascular system': 'Sistema cardiovascular',
  'levator scapulae': 'Elevador da escápula',
}
const EQUIPAMENTOS = {
  'body weight': 'Peso do corpo',
  dumbbell: 'Halteres',
  cable: 'Polia',
  barbell: 'Barra',
  'leverage machine': 'Máquina',
  band: 'Elástico',
  'smith machine': 'Smith',
  kettlebell: 'Kettlebell',
  weighted: 'Com peso',
  'stability ball': 'Bola suíça',
  'ez barbell': 'Barra W',
  assisted: 'Assistido',
  'sled machine': 'Leg press / hack (máquina)',
  'medicine ball': 'Medicine ball',
  rope: 'Corda',
  roller: 'Rolo',
  'resistance band': 'Faixa elástica',
  'bosu ball': 'Bosu',
  'olympic barbell': 'Barra olímpica',
  'wheel roller': 'Roda abdominal',
  'upper body ergometer': 'Ergômetro de braço',
  'skierg machine': 'SkiErg',
  hammer: 'Marreta',
  'stationary bike': 'Bicicleta ergométrica',
  tire: 'Pneu',
  'trap bar': 'Barra hexagonal',
  'elliptical machine': 'Elíptico',
  'stepmill machine': 'Simulador de escada',
}
// Traduções que sairiam iguais para exercícios diferentes: o treinador não
// pode ter dois exercícios com o mesmo nome.
const NOMES_AJUSTADOS = {
  '0572': 'Barra Fixa Supinada Assistida na Máquina', // lever assisted chin-up
  '0139': 'Barra Fixa Supinada Pegada Fechada (Bíceps)', // biceps narrow pull-ups
  '0140': 'Barra Fixa Supinada (Bíceps)', // biceps pull-up
  '1459': 'Levantamento Terra Romeno com Halteres', // dumbbell romanian deadlift
}

function argumentos(argv) {
  const opcoes = { dataset: null, nomes: [] }
  let atual = null
  for (const arg of argv) {
    if (arg === '--dataset' || arg === '--nomes') atual = arg.slice(2)
    else if (atual === 'dataset') opcoes.dataset = arg
    else if (atual === 'nomes') opcoes.nomes.push(arg)
    else throw new Error(`Argumento inesperado: ${arg}`)
  }
  if (!opcoes.dataset) throw new Error('Informe o dataset: --dataset caminho/exercises.json')
  return opcoes
}

const lerJson = (caminho) => JSON.parse(readFileSync(caminho, 'utf8'))
const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '')
// Alguns nomes do dataset vêm com "45в°" (codificação quebrada de "45°").
const limparIngles = (valor) => texto(valor).replace(/в°/g, '°').replace(/\s+/g, ' ')

function juntarNomes(arquivos) {
  if (arquivos.length === 0) return lerJson(NOMES_JUNTADOS)
  const nomes = {}
  for (const arquivo of arquivos) {
    for (const [id, nome] of Object.entries(lerJson(arquivo))) {
      if (id in nomes && nomes[id] !== nome) throw new Error(`Id ${id} com dois nomes: "${nomes[id]}" e "${nome}"`)
      nomes[id] = nome
    }
  }
  const ordenado = Object.fromEntries(Object.entries(nomes).sort(([a], [b]) => a.localeCompare(b)))
  mkdirSync(`${ROOT}scripts/dados`, { recursive: true })
  writeFileSync(NOMES_JUNTADOS, `${JSON.stringify(ordenado, null, 1)}\n`)
  return ordenado
}

function gerar({ dataset, nomes: arquivosDeNomes }) {
  const exercicios = lerJson(dataset)
  if (!Array.isArray(exercicios)) throw new Error('O dataset precisa ser uma lista de exercícios.')
  const nomes = juntarNomes(arquivosDeNomes)
  const erros = []
  const itens = []
  const passosPorGrupo = {}
  const vistos = new Map()

  for (const exercicio of exercicios) {
    const id = texto(exercicio.id)
    const media = texto(exercicio.gif_url).match(/^videos\/([^/]+)\.gif$/)?.[1] ?? ''
    const nome = texto(NOMES_AJUSTADOS[id] ?? nomes[id]).replace(/\s+/g, ' ')
    const alvo = texto(exercicio.target)
    const item = {
      id,
      media,
      nome,
      nome_en: limparIngles(exercicio.name),
      grupo: GRUPOS[alvo] ?? '',
      equipamento: EQUIPAMENTOS[texto(exercicio.equipment)] ?? '',
      musculo_alvo: MUSCULOS[alvo] ?? '',
      credito: texto(exercicio.attribution),
    }
    const passos = (exercicio.instruction_steps?.en ?? []).map(limparIngles).filter(Boolean)

    for (const [campo, valor] of Object.entries(item)) if (!valor) erros.push(`${id || '(sem id)'}: "${campo}" vazio`)
    if (passos.length === 0) erros.push(`${id}: sem passo a passo`)
    if (media && !MEDIA.test(media)) erros.push(`${id}: arquivo do GIF inválido (${media})`)
    if (item.credito && item.credito !== CREDITO) erros.push(`${id}: crédito diferente do esperado (${item.credito})`)
    if (!item.grupo) erros.push(`${id}: músculo-alvo sem grupo (${alvo})`)
    if (!item.equipamento) erros.push(`${id}: equipamento sem tradução (${exercicio.equipment})`)
    const chave = nome.toLocaleLowerCase('pt-BR')
    if (nome && vistos.has(chave)) erros.push(`${id}: nome repetido com ${vistos.get(chave)} ("${nome}")`)
    vistos.set(chave, id)

    itens.push(item)
    const arquivo = ARQUIVO_DO_GRUPO[item.grupo]
    if (arquivo) (passosPorGrupo[arquivo] ??= {})[id] = passos
  }

  const ids = new Set(itens.map((item) => item.id))
  if (ids.size !== itens.length) erros.push('Há ids repetidos no dataset.')
  for (const id of Object.keys(nomes)) if (!ids.has(id)) erros.push(`${id}: nome traduzido para um id que não existe no dataset`)
  if (erros.length > 0) throw new Error(`Biblioteca com problemas:\n- ${erros.slice(0, 40).join('\n- ')}${erros.length > 40 ? `\n… e mais ${erros.length - 40}` : ''}`)

  itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const grupos = Object.entries(ARQUIVO_DO_GRUPO)
    .map(([grupo, arquivo]) => ({ grupo, passos: `passos/${arquivo}.json`, total: itens.filter((item) => item.grupo === grupo).length }))
    .filter((grupo) => grupo.total > 0)

  rmSync(SAIDA, { recursive: true, force: true })
  mkdirSync(`${SAIDA}/passos`, { recursive: true })
  const indice = { fonte: 'https://github.com/hasaneyldrm/exercises-dataset', credito: CREDITO, total: itens.length, grupos, itens }
  writeFileSync(`${SAIDA}/biblioteca.json`, `${JSON.stringify(indice)}\n`)
  for (const [arquivo, passos] of Object.entries(passosPorGrupo)) {
    writeFileSync(`${SAIDA}/passos/${arquivo}.json`, `${JSON.stringify(passos)}\n`)
  }
  return { total: itens.length, grupos }
}

try {
  const { total, grupos } = gerar(argumentos(process.argv.slice(2)))
  console.log(`Biblioteca gerada: ${total} exercícios com nome em português.`)
  for (const { grupo, total: quantos } of grupos) console.log(`  ${grupo}: ${quantos}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
