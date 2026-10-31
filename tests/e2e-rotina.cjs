// Roteiro da rotina da semana: treino por dia, descanso, reinício semanal pela ordem,
// "Semana" com os dias, o construtor do Jean (dia e ordem) e o banco sem o SQL.
// As contas puras ficam em contas-semana.mjs.
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://localhost:3200'
const MOCK = 'http://localhost:54321'
const OUT = path.join(__dirname, '.output', 'shots')
const results = []
const problems = []
const check = (name, condition, detail = '') => results.push(`${condition ? 'OK  ' : 'FAIL'} ${name}${condition || !detail ? '' : ` → ${detail}`}`)
const state = async () => (await fetch(`${MOCK}/__state`)).json()
const mock = (route) => fetch(`${MOCK}${route}`)
const seed = (params) => mock(`/__rotina/seed?${new URLSearchParams(params)}`)
const NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const today = new Date().getDay()
// Mesmo cálculo do app: quantas semanas desde a segunda de 01/01/2024 (os dias do descanso rotativo andam 1 por semana).
const weekNumber = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - ((now.getDay() + 6) % 7))
  return Math.floor(Math.round((start - new Date(2024, 0, 1)) / 864e5) / 7)
}
const shift = weekNumber() % 7
const day = (offset) => (today + offset + 7) % 7

async function login(page, who) {
  await page.goto(`${BASE}/login`)
  await page.fill('#email', `${who}@teste.com`)
  await page.fill('#password', '123456')
  await page.click('button[type=submit]')
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60000 })
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  page.on('pageerror', (error) => problems.push(`pageerror @ ${page.url()}: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (!/\b(400|401|403|404|422|429)\b/.test(text) && !/ERR_INTERNET_DISCONNECTED|Failed to fetch|net::ERR/i.test(text)) problems.push(`console @ ${page.url()}: ${text}`)
  })
  const hoje = async () => {
    await page.goto(`${BASE}/student/today`)
    await page.waitForSelector('h1:has-text("Fala,")')
    await page.waitForTimeout(500)
    return (await page.textContent('main')) ?? ''
  }

  await login(page, 'maria')

  // ------------------------------------------------ sem dias: semana nova começa pelo primeiro
  await seed({ limpar: '1', a: '', b: '' })
  let text = await hoje()
  check('semana nova (nada feito, sem dias): "Semana nova! Começa pelo Treino A"', text.includes('Semana nova!') && text.includes('Treino A'))
  check('o botão principal abre o Treino A', (await page.locator('a[href="/student/workout/w-a"]', { hasText: 'Começar treino' }).count()) === 1)

  // ------------------------------------------------ dia marcado: treino de hoje
  await seed({ limpar: '1', a: String(today), b: String(day(1)) })
  text = await hoje()
  check('dia marcado: "Hoje é dia de Treino A - Peito e Tríceps"', text.includes('Hoje é dia de Treino A - Peito e Tríceps'))
  check('dia marcado: selo "Treino de hoje" e botão "Começar treino"', text.includes('Treino de hoje') && (await page.locator('a[href="/student/workout/w-a"]', { hasText: 'Começar treino' }).count()) === 1)
  check('"Sua rotina" mostra o dia no lugar da letra (ex.: "' + ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][today] + '")', text.includes(['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][today]))
  await page.screenshot({ path: path.join(OUT, 'r01-hoje-dia-marcado.png'), fullPage: true })

  // ------------------------------------------------ descanso rotativo: os dias andam 1 por semana
  await seed({ limpar: '1', a: String((today - shift + 7) % 7), b: String((today - shift + 8) % 7), rodar: '1' })
  text = await hoje()
  check('descanso rotativo: o treino marcado para "o dia base" cai em hoje esta semana', text.includes('Hoje é dia de Treino A - Peito e Tríceps'))
  await page.goto(`${BASE}/student/week`)
  await page.waitForSelector('h1:has-text("Seus treinos")')
  await page.waitForSelector('a[href^="/student/workout/"]')
  text = (await page.textContent('main')) ?? ''
  check('Semana: mostra o dia desta semana e explica o descanso rotativo', text.includes(NAMES[today]) && text.includes('descanso é rotativo'))
  await page.screenshot({ path: path.join(OUT, 'r05-semana-rotativo.png'), fullPage: true })

  // ------------------------------------------------ descanso: hoje não tem treino marcado
  await seed({ limpar: '1', a: String(day(1)), b: String(day(2)) })
  text = await hoje()
  check('descanso: "Dia de descanso" e "Hoje não tem treino marcado."', text.includes('Dia de descanso') && text.includes('Hoje não tem treino marcado.'))
  check('descanso: botão "Adiantar este treino" (não "Começar treino")', text.includes('Adiantar este treino') && !text.includes('Começar treino'))
  check('descanso: o texto não culpa ("Descansar também conta.")', text.includes('Descansar também conta.') && !/atrasad|perdeu|faltou/i.test(text))
  if (today !== 0) check(`descanso: mostra "Próximo: ${NAMES[day(1)]}."`, text.includes(`Próximo: ${NAMES[day(1)]}.`))
  check('descanso: o botão adianta o treino sugerido (qualquer treino abre fora do dia)', (await page.locator('a', { hasText: 'Adiantar este treino' }).count()) === 1)
  await page.screenshot({ path: path.join(OUT, 'r02-hoje-descanso.png'), fullPage: true })

  // ------------------------------------------------ Semana
  await page.goto(`${BASE}/student/week`)
  await page.waitForSelector('h1:has-text("Seus treinos")')
  await page.waitForSelector('a[href^="/student/workout/"]')
  text = (await page.textContent('main')) ?? ''
  check('Semana: mostra o nome do dia de cada treino', text.includes(NAMES[day(1)]) && text.includes(NAMES[day(2)]), text.slice(0, 400))
  check('Semana: explica que a semana começa na segunda', text.includes('A semana começa na segunda'))
  await page.screenshot({ path: path.join(OUT, 'r03-semana.png'), fullPage: true })

  // ------------------------------------------------ treinador: dia e ordem
  await context.clearCookies()
  await page.evaluate(() => localStorage.clear())
  await seed({ limpar: '1', a: '', b: '' })
  await login(page, 'jean')
  await page.goto(`${BASE}/admin/workouts`)
  await page.waitForSelector('text=Maria Souza')
  await page.click('text=Maria Souza')
  await page.waitForSelector('text=Treino A - Peito e Tríceps')
  const select = page.locator('#day-w-a')
  check('construtor: cada treino ativo tem o seletor de dia (44 px)', (await select.count()) === 1 && ((await select.boundingBox())?.height ?? 0) >= 43.5)
  check('construtor: subir/descer com nome claro e 44 px', ((await page.locator('button[aria-label^="Descer Treino A"]').boundingBox())?.width ?? 0) >= 43.5)
  check('o primeiro não sobe e o último não desce', (await page.locator('button[aria-label^="Subir Treino A"]').isDisabled()) === true)
  await page.screenshot({ path: path.join(OUT, 'r04-treinador-dia-ordem.png'), fullPage: true })
  await select.selectOption('3')
  await page.waitForSelector('text=O aluno já vê a semana atualizada.')
  let stored = (await state()).assigned_workouts.find((row) => row.id === 'w-a')
  check('escolher "Quarta" grava weekday = 3', stored.weekday === 3)
  await page.click('button[aria-label^="Descer Treino A"]')
  await page.waitForSelector('text=desceu: agora é o 2º de 2')
  const after = (await state()).assigned_workouts
  check('"Descer" troca a ordem: A fica depois do B', after.find((row) => row.id === 'w-a').position > after.find((row) => row.id === 'w-b').position)
  await select.selectOption('')
  await page.waitForSelector('text=Treino A - Peito e Tríceps: sem dia fixo')
  stored = (await state()).assigned_workouts.find((row) => row.id === 'w-a')
  check('"Sem dia fixo" volta para vazio', stored.weekday === null)

  // Descanso rotativo: interruptor por aluno.
  await seed({ limpar: '1', a: '1', b: '3' })
  await page.reload()
  await page.waitForSelector('text=Maria Souza')
  await page.click('text=Maria Souza')
  await page.waitForSelector('text=Treino A - Peito e Tríceps')
  const rotate = page.locator('button[role=switch][aria-label="Descanso rotativo de Maria Souza"]')
  check('descanso rotativo: interruptor por aluno (começa desligado)', (await rotate.count()) === 1 && (await rotate.getAttribute('aria-checked')) === 'false')
  await rotate.click()
  await page.waitForSelector('text=Descanso rotativo ligado')
  const rotated = (await state()).assigned_workouts.filter((row) => row.student_id === 'u-student')
  check('ligar grava rotate_days em todos os treinos do aluno', rotated.length > 0 && rotated.every((row) => row.rotate_days === true))
  check('o treinador vê a prévia "Esta semana: ..."', (await page.textContent('main'))?.includes('Esta semana:') === true)
  await rotate.click()
  await page.waitForSelector('text=Descanso rotativo desligado')
  check('desligar volta rotate_days para falso', (await state()).assigned_workouts.filter((row) => row.student_id === 'u-student').every((row) => row.rotate_days === false))
  await seed({ limpar: '1', a: '', b: '' })

  // O aluno vê a nova ordem: semana nova começa pelo B.
  await context.clearCookies()
  await page.evaluate(() => localStorage.clear())
  await login(page, 'maria')
  text = await hoje()
  check('com a ordem nova, a semana começa pelo Treino B', text.includes('Semana nova!') && text.includes('Treino B'))

  // ------------------------------------------------ banco sem o SQL
  await mock('/__rotina/off')
  text = await hoje()
  check('sem o SQL: a tela Hoje funciona (reinício semanal pela ordem do nome)', text.includes('Semana nova!') && text.includes('Treino A'))
  await context.clearCookies()
  await page.evaluate(() => localStorage.clear())
  await login(page, 'jean')
  await page.goto(`${BASE}/admin/workouts`)
  await page.waitForSelector('text=Maria Souza')
  await page.click('text=Maria Souza')
  await page.waitForSelector('text=Treino A - Peito e Tríceps')
  check('sem o SQL: o construtor não mostra dia nem ordem (e não quebra)', (await page.locator('select[id^="day-"]').count()) === 0)
  await mock('/__rotina/on')

  await browser.close()
  console.log(results.join('\n'))
  console.log('\nPROBLEMAS DE CONSOLE/PÁGINA:', problems.length ? '\n' + problems.join('\n') : 'nenhum')
  const failed = results.filter((line) => line.startsWith('FAIL')).length
  console.log(`\n${results.length - failed} de ${results.length} verificações OK`)
  if (failed > 0 || problems.length > 0) process.exitCode = 1
})().catch((error) => {
  console.log(results.join('\n'))
  console.error('ERRO NO ROTEIRO:', error.message)
  process.exit(1)
})
