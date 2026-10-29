// Roteiro do "Trocar exercício" e da marca "Essencial": opções do Jean e do app,
// troca só antes da primeira série, desfazer, dor que vira recado, recarregar,
// finalizar com e sem o SQL, essencial na versão curta e o construtor do Jean.
// As contas puras ficam em contas-trocar.mjs.
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://localhost:3200'
const MOCK = 'http://localhost:54321'
const OUT = path.join(__dirname, '.output', 'shots')
const results = []
const problems = []

const check = (name, condition) => results.push(`${condition ? 'OK  ' : 'FAIL'} ${name}`)
const state = async () => (await fetch(`${MOCK}/__state`)).json()
const mock = (route) => fetch(`${MOCK}${route}`)
async function shot(page, name) {
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
}
async function login(page, email, password = '123456') {
  await page.goto(`${BASE}/login`)
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type=submit]')
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60000 })
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  page.on('pageerror', (error) => problems.push(`pageerror @ ${page.url()}: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    // Esperados: requisições recusadas de propósito (banco sem o SQL).
    const expected = /\b(400|401|403|404|422|429)\b/.test(text) || /ERR_INTERNET_DISCONNECTED|Failed to fetch|net::ERR/i.test(text)
    if (!expected) problems.push(`console @ ${page.url()}: ${text}`)
  })

  const dialog = page.locator('[role=dialog]')
  const block = (id) => page.locator(`section#exercise-${id}`)
  const swapButton = (id) => block(id).locator('button[data-swap-button]')
  const sessions = async (workoutId) => (await state()).workout_sessions.filter((row) => row.student_id === 'u-student' && row.assigned_workout_id === workoutId)
  const open = async (id, firstRow) => {
    await page.goto(`${BASE}/student/workout/${id}`)
    await page.waitForSelector(`section#exercise-${firstRow}`)
    // A biblioteca (opções do "Trocar") carrega logo depois do treino, fora do caminho crítico.
    await page.waitForSelector('[data-swap-button]', { timeout: 10000 }).catch(() => {})
  }
  const finish = async () => {
    await page.click('button:has-text("Concluir")')
    await page.waitForSelector('[role=dialog]')
    await page.click('[role=dialog] button:has-text("Salvar treino")')
    await page.waitForSelector('text=Músculos trabalhados', { timeout: 30000 })
  }
  const markFirstSet = async (rowId, weight = '50') => {
    await page.fill(`#set-${rowId}-0-weight`, weight)
    await page.fill(`#set-${rowId}-0-reps`, '10')
    await page.click(`section#exercise-${rowId} button[aria-label="Marcar série 1 como concluída"]`)
    await page.waitForSelector(`section#exercise-${rowId} button[aria-label="Desmarcar série 1"]`)
  }

  await mock('/__curto/longo')
  await mock('/__trocar/seed')
  await login(page, 'maria@teste.com')

  // ------------------------------------------------ quando o botão aparece
  await open('w-a', 'awe1')
  check('Supino (alternativa do Jean + sugestão do app) mostra "Trocar"', (await swapButton('awe1').count()) === 1)
  check('Crucifixo é "Essencial" e não tem alternativa: sem "Trocar"', (await swapButton('awe2').count()) === 0 && (await block('awe2').textContent()).includes('Essencial'))
  check('Tríceps não tem outro exercício do grupo: sem "Trocar"', (await swapButton('awe3').count()) === 0)
  check('"Trocar" tem 44 px ou mais', ((await swapButton('awe1').boundingBox())?.height ?? 0) >= 44)
  check('nome acessível diz qual exercício será trocado', (await swapButton('awe1').getAttribute('aria-label')) === 'Trocar Supino Reto com Barra')
  await shot(page, 't01-treino-com-trocar')

  // ------------------------------------------------ painel de troca
  await swapButton('awe1').click()
  await dialog.waitFor()
  const options = dialog.locator('ul[aria-label^="Opções"] button')
  check('painel: título e aviso de que vale só para hoje', (await dialog.textContent()).includes('Trocar Supino Reto com Barra') && (await dialog.textContent()).includes('só para hoje'))
  check('painel: 2 opções (a do Jean primeiro, depois a do app)', (await options.count()) === 2)
  check('painel: a primeira é indicada pelo Jean', (await options.nth(0).textContent()).includes('Supino Inclinado com Halteres') && (await options.nth(0).textContent()).includes('Indicado pelo Jean'))
  check('painel: a segunda é sugestão do app e do mesmo grupo', (await options.nth(1).textContent()).includes('Supino Máquina') && (await options.nth(1).textContent()).includes('Sugestão do app'))
  check('painel: nunca oferece exercício que já está no treino (Crucifixo)', !(await dialog.textContent()).includes('Crucifixo'))
  check('painel: cada opção tem 44 px ou mais', ((await options.nth(0).boundingBox())?.height ?? 0) >= 44)
  check('painel: não oferece "Voltar" enquanto não houve troca', (await dialog.locator('button', { hasText: 'Voltar para' }).count()) === 0)
  await shot(page, 't02-painel-trocar')
  await options.nth(0).click()
  await dialog.waitFor({ state: 'detached' })
  check('trocou: o bloco mostra o novo exercício', (await block('awe1').locator('h2').textContent()) === 'Supino Inclinado com Halteres')
  check('trocou: aparece "Trocado hoje"', (await block('awe1').textContent()).includes('Trocado hoje'))
  check('trocou: o "Anterior" do outro exercício não aparece (sem recorde falso)', !(await block('awe1').textContent()).includes('70'))
  check('trocou: o aparelho guarda a troca (treino e dia)', await page.evaluate(() => JSON.parse(localStorage.getItem('team-jean:trocas') ?? 'null')?.swaps?.awe1 === 'e7'))
  check('trocar não mexe na prescrição do Jean', (await state()).assigned_workout_exercises.find((row) => row.id === 'awe1').exercise_id === 'e1')
  await shot(page, 't03-trocado')

  // ------------------------------------------------ recarregar mantém, desfazer volta
  await page.reload()
  await page.waitForSelector('section#exercise-awe1')
  check('recarregar mantém a troca', (await block('awe1').locator('h2').textContent()) === 'Supino Inclinado com Halteres')
  await swapButton('awe1').click()
  await dialog.waitFor()
  check('com troca feita, o painel oferece voltar ao original', (await dialog.locator('button', { hasText: 'Voltar para Supino Reto com Barra' }).count()) === 1)
  check('a opção já escolhida não aparece de novo', !(await dialog.locator('ul[aria-label^="Opções"]').textContent()).includes('Supino Inclinado'))
  await dialog.locator('button', { hasText: 'Voltar para Supino Reto com Barra' }).click()
  await dialog.waitFor({ state: 'detached' })
  check('voltar: o exercício original e o "Anterior" dele voltam', (await block('awe1').locator('h2').textContent()) === 'Supino Reto com Barra' && (await block('awe1').textContent()).includes('70'))
  check('voltar: o aparelho esquece a troca', await page.evaluate(() => localStorage.getItem('team-jean:trocas') === null))

  // ------------------------------------------------ troca por dor + finalizar
  await swapButton('awe1').click()
  await dialog.waitFor()
  await dialog.locator('label', { hasText: 'Estou trocando por causa de dor' }).click()
  await dialog.locator('ul[aria-label^="Opções"] button').nth(1).click()
  await dialog.waitFor({ state: 'detached' })
  check('trocou por Supino Máquina', (await block('awe1').locator('h2').textContent()) === 'Supino Máquina')
  await markFirstSet('awe1', '40')
  check('depois da primeira série, o "Trocar" some', (await swapButton('awe1').count()) === 0)
  check('troca não gera "Novo recorde pessoal" sem histórico do exercício novo', (await page.locator('text=Novo recorde pessoal').count()) === 0)
  await finish()
  const [done] = (await sessions('w-a')).filter((row) => row.status === 'completed').slice(-1)
  const sets = (await state()).session_sets.filter((row) => row.session_id === done.id)
  check('série gravada no exercício que foi feito (Supino Máquina)', sets.length === 1 && sets[0].exercise_id === 'e8' && sets[0].assigned_exercise_id === 'awe1')
  check('a sessão guarda swaps = 1', done.swaps === 1)
  check('troca por dor deixa o recado "Senti dor" marcado', Array.isArray(done.feedback_tags) && done.feedback_tags.includes('Senti dor'))
  const recados = (await state()).notifications.filter((row) => row.type === 'feedback')
  check('o aviso de dor chega ao treinador pelo recado (tag "Senti dor")', recados.length === 1 && recados[0].message.includes('Senti dor'))
  check('o recado não leva o nome do exercício trocado', recados.every((row) => !/Supino/i.test(`${row.title} ${row.message}`)))
  check('depois de finalizar, o aparelho esquece a troca', await page.evaluate(() => localStorage.getItem('team-jean:trocas') === null))

  await page.goto(`${BASE}/student/history`)
  await page.waitForSelector('text=Treino A - Peito e Tríceps')
  check('histórico do aluno mostra "1 troca"', (await page.textContent('main')).includes('1 troca'))

  // ------------------------------------------------ banco sem o trocar-exercicio.sql
  const completedBefore = (await sessions('w-a')).filter((row) => row.status === 'completed').length
  await mock('/__trocar/off')
  await open('w-a', 'awe1')
  check('sem o SQL: ainda sugere do mesmo grupo (sem alternativas do Jean)', (await swapButton('awe1').count()) === 1)
  check('sem o SQL: a marca "Essencial" não aparece', !(await block('awe2').textContent()).includes('Essencial'))
  await swapButton('awe1').click()
  await dialog.waitFor()
  check('sem o SQL: só sugestões do app', (await dialog.locator('text=Indicado pelo Jean').count()) === 0 && (await dialog.locator('text=Sugestão do app').count()) >= 1)
  await dialog.locator('ul[aria-label^="Opções"] button').first().click()
  await dialog.waitFor({ state: 'detached' })
  await markFirstSet('awe1', '30')
  await finish()
  const noSql = (await sessions('w-a')).filter((row) => row.status === 'completed')
  check('sem o SQL: o treino é salvo mesmo assim, sem erro', noSql.length === completedBefore + 1)
  const saved1 = noSql[noSql.length - 1]
  check('sem o SQL: a série foi gravada e a coluna swaps não', (await state()).session_sets.some((row) => row.session_id === saved1.id) && saved1.swaps === undefined)
  check('sem o SQL: nada fica preso na fila', !(await page.textContent('body')).includes('salvo no aparelho'))
  await mock('/__trocar/on')

  // ------------------------------------------------ essencial na versão curta
  await mock('/__trocar/seed')
  await page.goto(`${BASE}/student/workout/w-d?curto=1`)
  await dialog.waitFor()
  const boxes = dialog.locator('input[type=checkbox]')
  check('versão curta: 6 exercícios na lista', (await boxes.count()) === 6)
  const last = dialog.locator('label', { hasText: 'Remada Baixa' })
  check('versão curta: o essencial vem marcado e travado', (await last.locator('input').isChecked()) && (await last.locator('input').isDisabled()))
  check('versão curta: o painel explica que o Jean pediu para manter', (await last.textContent()).includes('Essencial: o Jean pediu para manter'))
  check('versão curta: o resumo não diz que o essencial sai', !(await dialog.textContent()).includes('Sai hoje: Puxada Frontal, Prancha, Remada Baixa'))
  await shot(page, 't04-curto-essencial')
  await dialog.locator('button', { hasText: 'Fazer versão curta' }).click()
  await page.locator('[role=status]', { hasText: 'Versão curta de hoje' }).waitFor()
  check('versão curta: o exercício essencial continua na tela', (await block('awd6').count()) === 1)
  check('versão curta: "Essencial" aparece no cartão', (await block('awd6').textContent()).includes('Essencial'))

  // ------------------------------------------------ construtor do Jean
  await context.clearCookies()
  await page.evaluate(() => localStorage.clear())
  await login(page, 'jean@teste.com')
  await page.goto(`${BASE}/admin/workouts`)
  await page.waitForSelector('text=Maria Souza')
  await page.click('text=Maria Souza')
  await page.waitForSelector('text=Treino A - Peito e Tríceps')
  await page.click('button[aria-label="Editar Treino A - Peito e Tríceps"]')
  await page.waitForSelector('text=Editar treino')
  const editor = page.locator('[role=dialog]').first()
  const essentialBoxes = editor.locator('label', { hasText: 'Essencial' }).locator('input')
  check('construtor: cada exercício tem "Essencial"', (await essentialBoxes.count()) === 3)
  check('construtor: o Crucifixo já vem marcado como essencial', await essentialBoxes.nth(1).isChecked())
  check('construtor: o Supino mostra a alternativa já escolhida', (await editor.locator('ul[aria-label="Alternativas de Supino Reto com Barra"]').textContent()).includes('Supino Inclinado com Halteres'))
  check('construtor: botões de alternativa e de tirar têm nome claro', (await editor.locator('button[aria-label="Tirar Supino Inclinado com Halteres das alternativas"]').count()) === 1)
  await shot(page, 't05-construtor-essencial')
  await essentialBoxes.nth(2).check()
  await editor.locator('button', { hasText: 'Alternativa' }).nth(2).click()
  await page.waitForSelector('text=Alternativas de troca')
  await page.fill('input[aria-label="Buscar exercício"]', 'máquina')
  await page.locator('ul[aria-label="Biblioteca de exercícios"] button', { hasText: 'Supino Máquina' }).click()
  await page.click('button:has-text("Usar como alternativa")')
  await page.waitForSelector('ul[aria-label="Alternativas de Tríceps na Polia com Corda"]')
  check('construtor: a alternativa escolhida aparece no cartão', (await editor.locator('ul[aria-label="Alternativas de Tríceps na Polia com Corda"]').textContent()).includes('Supino Máquina'))
  await editor.locator('button[type=submit]').click()
  await page.waitForSelector('text=Treino salvo')
  const saved = (await state()).assigned_workout_exercises.find((row) => row.id === 'awe3')
  check('construtor: salvou essencial e alternativas', saved.essential === true && JSON.stringify(saved.alternatives) === JSON.stringify(['e8']))
  const unchanged = (await state()).assigned_workout_exercises.find((row) => row.id === 'awe1')
  check('construtor: as alternativas que já existiam foram mantidas', JSON.stringify(unchanged.alternatives) === JSON.stringify(['e7']))

  // ------------------------------------------------ construtor sem o SQL
  await mock('/__trocar/off')
  await page.goto(`${BASE}/admin/workouts`)
  await page.waitForSelector('text=Maria Souza')
  await page.click('text=Maria Souza')
  await page.waitForSelector('text=Treino A - Peito e Tríceps')
  await page.click('button[aria-label="Editar Treino A - Peito e Tríceps"]')
  await page.waitForSelector('text=Editar treino')
  check('construtor sem o SQL: os campos novos não aparecem', (await page.locator('[role=dialog] label', { hasText: 'Essencial' }).count()) === 0)
  await page.locator('[role=dialog] button[type=submit]').click()
  await page.waitForSelector('text=Treino salvo')
  check('construtor sem o SQL: salva o treino normalmente', true)
  await mock('/__trocar/on')

  await browser.close()
  console.log(results.join('\n'))
  console.log('\nPROBLEMAS DE CONSOLE/PÁGINA:', problems.length ? '\n' + problems.join('\n') : 'nenhum')
  const failed = results.filter((line) => line.startsWith('FAIL')).length
  console.log(`\n${results.length - failed} de ${results.length} verificações OK`)
  if (failed > 0 || problems.length > 0) process.exitCode = 1
})().catch((error) => {
  console.log(results.join('\n'))
  console.log('\nPROBLEMAS:', problems.join('\n'))
  console.error('ERRO NO ROTEIRO:', error.message)
  process.exit(1)
})
