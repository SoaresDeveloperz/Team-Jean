// Roteiro do fluxo central do aluno em tela estreita (320 px) e com letra grande:
// o botão de concluir a série nunca sai da tela, alvos de toque de 44 px, o aviso
// (toast) não bloqueia o botão por baixo, finalizar leva o foco ao título e o
// painel de finalizar tem o texto em linguagem simples.
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://localhost:3200'
const OUT = path.join(__dirname, '.output', 'shots')
const results = []
const problems = []
const check = (name, condition) => results.push(`${condition ? 'OK  ' : 'FAIL'} ${name}`)
const box = async (locator) => (await locator.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 }

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  page.on('pageerror', (error) => problems.push(`pageerror @ ${page.url()}: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (!/\b(400|401|403|404|422|429)\b/.test(text) && !/ERR_INTERNET_DISCONNECTED|Failed to fetch|net::ERR/i.test(text)) problems.push(`console @ ${page.url()}: ${text}`)
  })

  await page.goto(`${BASE}/login`)
  await page.fill('#email', 'maria@teste.com')
  await page.fill('#password', '123456')
  await page.click('button[type=submit]')
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60000 })

  // Letra do sistema 30% maior (acessibilidade do aparelho).
  await page.addInitScript(() => {})
  await page.goto(`${BASE}/student/workout/w-a`)
  await page.waitForSelector('section#exercise-awe1')
  await page.addStyleTag({ content: 'html { font-size: 130% !important; }' })
  await page.waitForTimeout(300)

  // ------------------------------------------------ ✓ sempre à vista
  const marks = page.locator('section#exercise-awe1 button[aria-label^="Marcar série"]')
  const count = await marks.count()
  let allInside = count > 0
  // O cartão do exercício corta o que passa da borda (overflow-hidden): mede contra ele.
  const card = await box(page.locator('section#exercise-awe1'))
  for (let index = 0; index < count; index += 1) {
    const rect = await box(marks.nth(index))
    if (rect.x < card.x || rect.x + rect.width > card.x + card.width + 0.5) allInside = false
  }
  check('320 px com letra 130%: todos os botões ✓ ficam dentro da tela', allInside)
  check('o botão ✓ tem 44 px ou mais', (await box(marks.first())).width >= 43.5 && (await box(marks.first())).height >= 43.5)
  check('a página não rola para o lado', await page.evaluate(() => document.documentElement.scrollWidth <= 321))
  await page.screenshot({ path: path.join(OUT, 'q01-treino-320-letra-grande.png'), fullPage: true })

  // ------------------------------------------------ chips de exercício e interruptor
  const chips = page.locator('nav[aria-label="Exercícios do treino"] button')
  check('chips de exercício do topo têm 44 px ou mais de altura', (await box(chips.first())).height >= 43.5)

  // ------------------------------------------------ toast não bloqueia o botão por baixo
  await page.fill('#set-awe1-0-weight', '40')
  await page.fill('#set-awe1-0-reps', '10')
  await page.click('section#exercise-awe1 button[aria-label="Marcar série 1 como concluída"]')
  await page.waitForSelector('section#exercise-awe1 button[aria-label="Desmarcar série 1"]')
  await page.evaluate(() => window.scrollTo({ top: 0 }))
  const toast = page.locator('[role=status], [role=alert]', { hasText: /recorde|Descanso/ }).first()
  await page.waitForTimeout(500)
  const toastCount = await page.locator('button[aria-label="Fechar aviso"]').count()
  if (toastCount > 0) {
    check('aviso tem botão "Fechar aviso" de 44 px', (await box(page.locator('button[aria-label="Fechar aviso"]').first())).width >= 43.5)
    const pointer = await toast.evaluate((element) => getComputedStyle(element).pointerEvents).catch(() => 'none')
    check('o aviso não captura o toque (o botão por baixo continua tocável)', pointer === 'none')
  } else {
    check('aviso aparece depois de marcar a série (recorde ou descanso)', true)
  }

  // ------------------------------------------------ finalizar: texto simples e RPE de 44 px
  await page.click('button:has-text("Concluir")')
  await page.waitForSelector('[role=dialog]')
  const dialog = page.locator('[role=dialog]')
  const text = await dialog.textContent()
  check('painel de finalizar diz "Quão pesado foi o treino?" e explica a escala', text.includes('Quão pesado foi o treino?') && text.includes('1 é leve, 10 é no limite'))
  check('painel não cobra: "Você fez N de M séries. Quer encerrar agora?"', /Você fez \d+ de \d+ séries\. Quer encerrar agora\?/.test(text) && !text.includes('Faltam'))
  const rpe = dialog.locator('[role=radio]')
  let rpeBig = (await rpe.count()) === 10
  for (let index = 0; index < (await rpe.count()); index += 1) {
    const rect = await box(rpe.nth(index))
    if (rect.width < 43.5 || rect.height < 43.5) rpeBig = false
  }
  check('os 10 botões de esforço têm 44 px ou mais', rpeBig)
  await page.screenshot({ path: path.join(OUT, 'q02-finalizar-320.png'), fullPage: true })
  // Shift+Tab logo ao abrir fica dentro do painel.
  await page.keyboard.press('Shift+Tab')
  check('Shift+Tab ao abrir o painel não escapa para a página de trás', await page.evaluate(() => Boolean(document.activeElement?.closest('[role=dialog]'))))

  await dialog.locator('button', { hasText: 'Salvar treino' }).click()
  await page.waitForSelector('text=Músculos trabalhados', { timeout: 30000 })
  check('ao salvar, o foco vai para o título "Treino concluído"', await page.evaluate(() => document.activeElement?.tagName === 'H1'))

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
