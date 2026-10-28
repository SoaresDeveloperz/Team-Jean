// Roteiro do "Tenho pouco tempo" (versão curta do treino): botão na tela Hoje e
// no treino, painel que lista o que sai, desfazer, corte só na tela, recarregar,
// finalizar com e sem o SQL, finalizar sem internet e o selo "Versão curta" para
// o aluno e o treinador. As contas puras ficam em contas-curto.mjs.
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
    // Esperados: requisições recusadas de propósito (banco sem o SQL) e sem internet.
    const expected = /\b(400|401|403|404|422|429)\b/.test(text) || /ERR_INTERNET_DISCONNECTED|Failed to fetch|net::ERR/i.test(text)
    if (!expected) problems.push(`console @ ${page.url()}: ${text}`)
  })

  const blocks = () => page.locator('section[id^="exercise-"]')
  const rowsOf = (id) => page.locator(`section#exercise-${id} [role=rowgroup] > [role=row]`)
  const dialog = page.locator('[role=dialog]')
  const strip = page.locator('[role=status]', { hasText: 'Versão curta de hoje' })
  const mariaSessions = async () => (await state()).workout_sessions.filter((row) => row.student_id === 'u-student' && row.assigned_workout_id === 'w-d')
  // Abre o treino longo, deixa a tela carregar e liga a versão curta pelo painel.
  const openLong = async (suffix = '') => {
    await page.goto(`${BASE}/student/workout/w-d${suffix}`)
    await page.waitForSelector('section#exercise-awd1')
  }
  const applyShort = async () => {
    await dialog.waitFor()
    await dialog.locator('button', { hasText: 'Fazer versão curta' }).click()
    await strip.waitFor()
  }
  const markFirstSet = async () => {
    await page.fill('#set-awd1-0-weight', '50')
    await page.fill('#set-awd1-0-reps', '10')
    await page.click('section#exercise-awd1 button[aria-label="Marcar série 1 como concluída"]')
    await page.waitForSelector('section#exercise-awd1 button[aria-label="Desmarcar série 1"]')
  }
  const finish = async () => {
    await page.click('button:has-text("Concluir")')
    await page.waitForSelector('[role=dialog]')
    await page.click('[role=dialog] button:has-text("Salvar treino")')
    await page.waitForSelector('text=Músculos trabalhados', { timeout: 30000 })
  }

  await mock('/__curto/longo')
  await login(page, 'maria@teste.com')

  // ------------------------------------------------ só quando o treino passa do tempo
  await page.goto(`${BASE}/student/workout/w-a`)
  await page.waitForSelector('text=Anterior')
  check('treino de ~20 min não oferece "Tenho pouco tempo"', (await page.locator('button', { hasText: 'Tenho pouco tempo' }).count()) === 0)

  // ------------------------------------------------ tela Hoje
  await page.goto(`${BASE}/student/today`)
  await page.waitForSelector('text=Treino D - Longo')
  const shortLink = page.locator('a', { hasText: 'Tenho pouco tempo' })
  check('Hoje: treino longo mostra "Tenho pouco tempo"', (await shortLink.count()) === 1)
  check('Hoje: o botão leva ao treino em modo curto (?curto=1)', (await shortLink.getAttribute('href')) === '/student/workout/w-d?curto=1')
  check('Hoje: o botão tem 44 px ou mais', ((await shortLink.boundingBox())?.height ?? 0) >= 44)
  check('Hoje: "Começar treino" continua sendo a ação principal', (await page.locator('a', { hasText: 'Começar treino' }).count()) === 1)
  const more = page.locator('details', { hasText: 'Ver mais do seu dia' })
  check('Hoje enxuta: "Ver mais do seu dia" começa recolhido', (await more.count()) === 1 && (await more.evaluate((element) => !element.open)))
  check('Hoje enxuta: recuperação muscular não aparece antes de abrir', !(await page.locator('text=Recuperação muscular').first().isVisible()))
  check('Hoje enxuta: "Sua rotina" (jeito de abrir outro treino) fica à vista, fora do bloco recolhido', await page.locator('section[aria-label="Sua rotina"]').isVisible())
  await more.locator('summary').click()
  await page.waitForSelector('text=Recuperação muscular')
  check('Hoje enxuta: ao abrir, aparecem recuperação muscular e "O que vem aí"', (await page.textContent('details')).includes('O que vem aí') && (await page.textContent('details')).includes('Recuperação muscular'))
  check('Hoje enxuta: prontidão e recado continuam fora do bloco recolhido', (await more.locator('text=Como está sua energia hoje').count()) === 0)
  await shot(page, 'c01-hoje-longo')

  // ------------------------------------------------ painel: o que sai
  await shortLink.click()
  await page.waitForURL('**/student/workout/w-d')
  await dialog.waitFor()
  check('o painel abre sozinho vindo da tela Hoje', (await dialog.count()) === 1)
  const title = (await dialog.locator('h2').first().textContent()) ?? ''
  const minutes = Number(title.match(/cerca de (\d+) min/)?.[1] ?? 0)
  check('título promete só uma estimativa ("cerca de N min só para hoje") de até 20 min', minutes > 0 && minutes <= 20 && title.includes('só para hoje'))
  check('o painel diz que o treino com o Jean continua o mesmo', (await dialog.textContent()).includes('Seu treino com o Jean continua o mesmo'))
  check('o painel não pede motivo nem dado de saúde', (await dialog.locator('textarea, input[type=text]').count()) === 0 && !/dor|lesão|motivo/i.test(await dialog.locator('fieldset').textContent()))
  const boxes = dialog.locator('input[type=checkbox]')
  check('lista os 6 exercícios do treino', (await boxes.count()) === 6)
  check('regra padrão: os 3 primeiros ficam (marcados)', (await boxes.nth(0).isChecked()) && (await boxes.nth(1).isChecked()) && (await boxes.nth(2).isChecked()) && !(await boxes.nth(3).isChecked()) && !(await boxes.nth(5).isChecked()))
  const status = dialog.locator('[role=status]')
  check('resumo diz o que sai hoje', (await dialog.textContent()).includes('Sai hoje: Puxada Frontal, Prancha, Remada Baixa'))
  check('a região viva traz só a contagem (a lista de nomes não é repetida a cada caixa)', !(await status.textContent()).includes('Sai hoje'))
  check('cada exercício é uma área de toque de 44 px ou mais', ((await dialog.locator('label', { hasText: 'Puxada Frontal' }).boundingBox())?.height ?? 0) >= 44)
  await dialog.locator('label', { hasText: 'Puxada Frontal' }).click()
  check('"Manter" um exercício muda o resumo na hora', (await status.textContent()).includes('4 exercícios') && !(await dialog.textContent()).includes('Sai hoje: Puxada Frontal'))
  await dialog.locator('label', { hasText: 'Puxada Frontal' }).click()
  await shot(page, 'c02-painel-curto')
  await applyShort()

  // ------------------------------------------------ corte só na tela
  check('depois de aplicar, só 3 exercícios aparecem', (await blocks().count()) === 3)
  check('cada exercício mostra 2 séries de trabalho', (await rowsOf('awd1').count()) === 2 && (await rowsOf('awd3').count()) === 2)
  check('a série escondida não existe na tela (série 3 do exercício 1)', (await page.locator('section#exercise-awd1 button[aria-label="Marcar série 3 como concluída"]').count()) === 0)
  check('contagem do exercício acompanha o que aparece (0/2 séries)', (await page.textContent('section#exercise-awd1')).includes('0/2 séries'))
  check('faixa mostra "Versão curta de hoje · cerca de N min"', /cerca de \d+ min/.test(await strip.textContent()))
  check('"Desfazer" tem 44 px ou mais', ((await strip.locator('button', { hasText: 'Desfazer' }).boundingBox())?.height ?? 0) >= 44)
  check('o botão "Tenho pouco tempo" some quando a versão curta está ligada', (await page.locator('button', { hasText: 'Tenho pouco tempo' }).count()) === 0)
  check('os chips de exercícios do topo acompanham (3)', (await page.locator('nav[aria-label="Exercícios do treino"] li').count()) === 3)
  check('o progresso conta só o que aparece (0 de 6 séries)', (await page.locator('[role=progressbar]').getAttribute('aria-valuenow')) === '0')
  await shot(page, 'c03-treino-curto')

  // ------------------------------------------------ não mexe na prescrição nem nas séries
  const before = await state()
  const prescribed = before.assigned_workout_exercises.filter((row) => row.assigned_workout_id === 'w-d')
  check('a prescrição do Jean continua com 6 exercícios de 4 séries', prescribed.length === 6 && prescribed.every((row) => row.sets_count === 4))

  await markFirstSet()
  check('marcar série na versão curta cria a sessão normalmente', (await mariaSessions()).length === 1)
  await page.reload()
  await page.waitForSelector('section#exercise-awd1')
  await strip.waitFor()
  check('recarregar mantém a versão curta (3 exercícios)', (await blocks().count()) === 3)
  check('recarregar retoma a série já marcada', (await page.inputValue('#set-awd1-0-weight')) === '50')
  check('o estado fica guardado no aparelho (só deste treino e dia)', await page.evaluate(() => JSON.parse(localStorage.getItem('team-jean:treino-curto') ?? 'null')?.workoutId === 'w-d'))

  // ------------------------------------------------ finalizar na versão curta
  await finish()
  const done = await mariaSessions()
  check('treino finalizado e salvo como concluído', done.length === 1 && done[0].status === 'completed')
  check('a sessão guarda short_mode = true', done[0].short_mode === true)
  check('só 1 série foi gravada (a que foi feita)', (await state()).session_sets.filter((row) => row.session_id === done[0].id).length === 1)
  check('a marca da versão curta não gera aviso nem recado para o treinador', (await state()).notifications.filter((row) => row.type === 'feedback').length === 0)
  check('depois de finalizar, o aparelho esquece a versão curta', await page.evaluate(() => localStorage.getItem('team-jean:treino-curto') === null))

  // ------------------------------------------------ selo para o aluno e para o treinador
  await page.goto(`${BASE}/student/history`)
  await page.waitForSelector('text=Treino D - Longo')
  check('histórico do aluno mostra "Versão curta"', (await page.textContent('main')).includes('Versão curta'))
  await shot(page, 'c04-historico-curto')

  // ------------------------------------------------ desfazer
  await openLong()
  check('treino novo (sem séries feitas) volta a oferecer "Tenho pouco tempo"', (await page.locator('button', { hasText: 'Tenho pouco tempo' }).count()) === 1)
  await page.click('button:has-text("Tenho pouco tempo")')
  await applyShort()
  check('versão curta ligada de novo pelo botão do treino (3 exercícios)', (await blocks().count()) === 3)
  await strip.locator('button', { hasText: 'Desfazer' }).click()
  await page.waitForFunction(() => document.querySelectorAll('section[id^="exercise-"]').length === 6)
  check('desfazer traz o treino completo de volta (6 exercícios, 4 séries cada)', (await blocks().count()) === 6 && (await rowsOf('awd1').count()) === 4)
  check('desfazer apaga o estado do aparelho', await page.evaluate(() => localStorage.getItem('team-jean:treino-curto') === null))

  // ------------------------------------------------ outro dia: não vale
  await page.evaluate(() => localStorage.setItem('team-jean:treino-curto', JSON.stringify({ workoutId: 'w-d', day: '2020-01-01', hidden: ['awd4'], cap: 2 })))
  await page.reload()
  await page.waitForSelector('section#exercise-awd1')
  check('estado de outro dia é ignorado (treino completo)', (await blocks().count()) === 6)

  // ------------------------------------------------ banco sem o treino-curto.sql
  await mock('/__curto/off')
  await openLong()
  await page.click('button:has-text("Tenho pouco tempo")')
  await applyShort()
  await markFirstSet()
  await finish()
  const noSql = (await mariaSessions()).filter((row) => row.status === 'completed')
  check('sem o SQL: o treino curto é salvo mesmo assim (sem erro)', noSql.length === 2 && noSql[1].status === 'completed')
  check('sem o SQL: a marca não é gravada, e a série foi', noSql[1].short_mode !== true && (await state()).session_sets.some((row) => row.session_id === noSql[1].id))
  check('sem o SQL: nada fica preso na fila', (await page.textContent('body')).includes('Músculos trabalhados') && !(await page.textContent('body')).includes('salvo no aparelho'))
  await mock('/__curto/on')

  // ------------------------------------------------ sem internet: finalizar e sincronizar
  await openLong()
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30000 }).catch(() => {})
  await page.click('button:has-text("Tenho pouco tempo")')
  await applyShort()
  await markFirstSet()
  await context.setOffline(true)
  await page.click('button:has-text("Concluir")')
  await page.waitForSelector('[role=dialog]')
  await page.click('[role=dialog] button:has-text("Salvar treino")')
  await page.waitForSelector('text=Treino salvo no aparelho', { timeout: 30000 })
  check('sem internet: o treino curto fica salvo no aparelho', true)
  await context.setOffline(false)
  await page.waitForSelector('text=Conexão de volta', { timeout: 60000 })
  const synced = (await mariaSessions()).filter((row) => row.status === 'completed')
  check('ao voltar a internet: 3 treinos concluídos, sem duplicar', synced.length === 3 && new Set(synced.map((row) => row.id)).size === 3)
  check('ao voltar a internet: o último tem short_mode = true', synced[2].short_mode === true)
  check('a série feita sem internet chegou uma vez só', (await state()).session_sets.filter((row) => row.session_id === synced[2].id).length === 1)

  // ------------------------------------------------ treinador vê o selo
  await context.clearCookies()
  await page.evaluate(() => localStorage.clear())
  await login(page, 'jean@teste.com')
  await page.goto(`${BASE}/admin/students`)
  await page.waitForSelector('text=Maria Souza')
  await page.click('button:has-text("Maria Souza")')
  await page.waitForSelector('[role=dialog] >> text=Treino D - Longo')
  check('ficha do aluno: o treinador vê o selo "Versão curta"', (await page.textContent('[role=dialog]')).includes('Versão curta'))
  await shot(page, 'c05-treinador-selo')

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
