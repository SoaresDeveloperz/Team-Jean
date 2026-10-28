// Contas puras do aquecimento/anilhas (src/lib/warmup.ts) e da mensagem de
// WhatsApp (src/lib/whatsapp.ts). Os arquivos .ts não têm dependências nem
// alias "@/", então o Node (22.18+ / 24) importa direto, tirando os tipos.
// Uso: node tests/contas-novidades.mjs (também roda no roteiro "novidades").

// O Node avisa que o .ts "não tem type no package.json": é esperado aqui.
process.removeAllListeners('warning')

const warmup = await import('../src/lib/warmup.ts')
const whatsapp = await import('../src/lib/whatsapp.ts')

const results = []
const check = (name, condition, detail = '') => results.push(`${condition ? 'OK  ' : 'FAIL'} ${name}${condition || !detail ? '' : ` → ${detail}`}`)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const plates = (kg, bar) => warmup.describePlates(warmup.platesFor(kg, bar))

// ------------------------------------------------------------ aquecimento
const hundred = warmup.suggestWarmup(100, 20)
check('100 kg: aquecimentos a 40/60/80% = 40, 60 e 80 kg', same(hundred.map((set) => set.load), [40, 60, 80]), JSON.stringify(hundred.map((set) => set.load)))
check('100 kg: repetições decrescentes 10, 6, 3', same(hundred.map((set) => set.reps), [10, 6, 3]))
check('100 kg: percentuais 40, 60, 80', same(hundred.map((set) => set.percent), [40, 60, 80]))
check('40 kg na barra de 20: 10 de cada lado', hundred[0].plates.exact && plates(40, 20) === 'na barra de 20 kg: 10 de cada lado', plates(40, 20))
check('80 kg na barra de 20: 25 + 5 de cada lado', plates(80, 20) === 'na barra de 20 kg: 25 + 5 de cada lado', plates(80, 20))

const odd = warmup.suggestWarmup(57, 20)
check('aquecimento arredonda ao degrau de 2,5 kg (57 kg → 22,5 · 35 · 45)', same(odd.map((set) => set.load), [22.5, 35, 45]), JSON.stringify(odd.map((set) => set.load)))
check('aquecimento sempre fecha com as anilhas', odd.every((set) => set.plates.exact))

const light = warmup.suggestWarmup(30, 20)
check('carga leve: nunca abaixo da barra e sem séries repetidas (30 kg → 20, 25)', same(light.map((set) => set.load), [20, 25]), JSON.stringify(light.map((set) => set.load)))
check('carga leve: a série só com a barra fica com mais repetições', light[0].reps === 10 && warmup.describePlates(light[0].plates) === 'só a barra de 20 kg')
check('carga igual à barra: nenhuma série de aquecimento', warmup.suggestWarmup(20, 20).length === 0)
check('sem carga: nenhuma série', warmup.suggestWarmup(0, 20).length === 0 && warmup.suggestWarmup(Number.NaN, 20).length === 0)
check('sem barra: aquecimento começa nas anilhas (50 kg → 20, 30, 40)', same(warmup.suggestWarmup(50, 0).map((set) => set.load), [20, 30, 40]))

// --------------------------------------------------------------- anilhas
check('62,5 kg na barra de 20: 20 + 1,25 de cada lado', plates(62.5, 20) === 'na barra de 20 kg: 20 + 1,25 de cada lado', plates(62.5, 20))
check('22,5 kg na barra de 20: 1,25 de cada lado', plates(22.5, 20) === 'na barra de 20 kg: 1,25 de cada lado', plates(22.5, 20))
check('60 kg na barra de 20: 20 de cada lado', plates(60, 20) === 'na barra de 20 kg: 20 de cada lado')
check('60 kg na barra de 15: 20 + 2,5 de cada lado', plates(60, 15) === 'na barra de 15 kg: 20 + 2,5 de cada lado', plates(60, 15))
check('101,25 kg na barra de 20: 25 + 15 + 1,25 + ... confere a soma', (() => {
  const result = warmup.platesFor(101.25, 20)
  return !result.exact && result.total === 100 && result.perSide.reduce((sum, plate) => sum + plate, 0) * 2 + 20 === result.total
})())
check('toda montagem exata soma a carga pedida (20 a 200 kg, barras 20/15/10/0)', (() => {
  for (const bar of warmup.BARS) {
    for (let cents = bar * 100; cents <= 20000; cents += 250) {
      const kg = cents / 100
      const result = warmup.platesFor(kg, bar)
      const sum = Math.round(result.perSide.reduce((total, plate) => total + plate * 100, 0)) * 2 + bar * 100
      if (!result.exact || sum !== cents) return false
    }
  }
  return true
})())
check('20 kg na barra de 20: só a barra', plates(20, 20) === 'só a barra de 20 kg')
check('sem barra: "sem barra: 10 de cada lado"', plates(20, 0) === 'sem barra: 10 de cada lado', plates(20, 0))

const notExact = warmup.platesFor(61, 20)
check('61 kg não fecha: mostra a mais próxima (60 kg)', !notExact.exact && notExact.total === 60 && same(notExact.perSide, [20]), JSON.stringify(notExact))
const tie = warmup.platesFor(61.25, 20)
check('empate (61,25 kg): fica com a carga menor (60 kg)', !tie.exact && tie.total === 60, JSON.stringify(tie))
const up = warmup.platesFor(62, 20)
check('62 kg não fecha: mais próxima é 62,5 kg', !up.exact && up.total === 62.5, JSON.stringify(up))
const below = warmup.platesFor(15, 20)
check('carga menor que a barra: avisa e mostra só a barra', below.belowBar && !below.exact && below.total === 20)

// ------------------------------------------------ quando mostrar o botão
const entry = (type, targetWeight, previous) => ({ type, targetWeight, previous: previous === null ? null : { weight: previous, reps: 10 } })
check('carga de trabalho: carga-alvo do treinador', warmup.workingLoadOf([entry('working', 62.5, 50)]) === 62.5)
check('carga de trabalho: sem alvo, a da última vez', warmup.workingLoadOf([entry('working', null, 50)]) === 50)
check('carga de trabalho: pula as séries de aquecimento', warmup.workingLoadOf([entry('warmup', 20, null), entry('working', null, 80)]) === 80)
check('peso do corpo (sem carga): sem botão', !warmup.canSuggestWarmup([entry('working', null, null), entry('working', null, 0)]))
check('treino já tem aquecimento: sem botão', !warmup.canSuggestWarmup([entry('warmup', null, 20), entry('working', 60, 60)]))
check('treino já tem feeder (aproximação): sem botão', !warmup.canSuggestWarmup([entry('feeder', null, 40), entry('top', 70, 70)]))
check('com carga e sem aquecimento: com botão', warmup.canSuggestWarmup([entry('working', null, 50)]))
check('barra guardada no aparelho só aceita 20, 15, 10 ou 0', warmup.isBarWeight(15) && warmup.isBarWeight(0) && !warmup.isBarWeight(12) && !warmup.isBarWeight('20'))

// ------------------------------------------------------------- WhatsApp
const now = new Date(2026, 9, 24, 10, 0)
const nineDaysAgo = new Date(2026, 9, 15, 22, 30)
const message = whatsapp.comebackMessage('Maria Souza', whatsapp.daysSince(nineDaysAgo, now))
check(
  'mensagem acolhedora com o primeiro nome, sem contar dias',
  message === 'Oi, Maria! Sentimos sua falta por aqui. Quando quiser, um treino leve de 20 minutos já vale. Posso te ajudar a escolher? 💪',
  message,
)
check('dias contados por dia do calendário', whatsapp.daysSince(new Date(2026, 9, 23, 23, 59), now) === 1)
check('mensagem não cobra nem conta dias', !/\bdias?\b|\bfaltou\b|\bfalta de\b/i.test(whatsapp.comebackMessage('João', 9).replace('Sentimos sua falta', '')))
check('sem data do último treino: mesma mensagem acolhedora', whatsapp.comebackMessage('Ana Lima', null).startsWith('Oi, Ana! Sentimos sua falta por aqui. Quando quiser'))
check('depois de 14 dias: "Sem pressa."', whatsapp.comebackMessage('Ana', 15).includes('por aqui. Sem pressa. Quando quiser'))
check('menos de 14 dias: sem "Sem pressa."', !whatsapp.comebackMessage('Ana', 13).includes('Sem pressa'))
check('sem nome: "Oi!"', whatsapp.comebackMessage('   ', 9).startsWith('Oi! Sentimos sua falta'))

const link = whatsapp.comebackWhatsappLink('Conceição Ávila', nineDaysAgo, now)
check('link do WhatsApp sem telefone (wa.me/?text=)', link.startsWith('https://wa.me/?text=') && !/wa\.me\/\d/.test(link) && !/phone=/.test(link), link)
check('link codifica acentos e emoji', link.includes('Concei%C3%A7%C3%A3o') && link.includes('j%C3%A1') && link.includes('%F0%9F%92%AA') && !/[^\x21-\x7e]/.test(link), link)
check('link decodifica de volta para a mensagem', decodeURIComponent(link.split('?text=')[1]) === whatsapp.comebackMessage('Conceição Ávila', 9))
check('mensagem leva só o primeiro nome (sem sobrenome)', !decodeURIComponent(link).includes('Ávila'))

console.log(results.join('\n'))
const failed = results.filter((line) => line.startsWith('FAIL')).length
console.log(`\n${results.length - failed} de ${results.length} verificações OK`)
if (failed > 0) process.exitCode = 1
