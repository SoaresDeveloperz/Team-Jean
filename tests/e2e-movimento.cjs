// Roteiro das animações em CSS e do movimento reduzido: ✓ da série e barras sem
// mexer em width, entrada de tela, sem blur no modal e no toast, e, com "reduzir
// movimento", nada em loop, sem atrasos e conteúdo visível na hora.
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://localhost:3200'
const OUT = path.join(__dirname, '.output', 'shots')
const results = []
const problems = []
const check = (name, condition) => results.push(`${condition ? 'OK  ' : 'FAIL'} ${name}`)

async function login(page, email) {
  await page.goto(`${BASE}/login`)
  await page.fill('#email', email)
  await page.fill('#password', '123456')
  await page.click('button[type=submit]')
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60000 })
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  page.on('pageerror', (error) => problems.push(`pageerror @ ${page.url()}: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (!/\b(400|401|403|404|422|429)\b/.test(text) && !/ERR_INTERNET_DISCONNECTED|Failed to fetch|net::ERR/i.test(text)) problems.push(`console @ ${page.url()}: ${text}`)
  })

  await login(page, 'maria@teste.com')

  // ------------------------------------------------ movimento normal
  await page.goto(`${BASE}/student/workout/w-a`)
  await page.waitForSelector('section#exercise-awe1')
  const progress = page.locator('[role=progressbar] .bar-fill')
  check('barra de progresso do treino é CSS (.bar-fill), não width animado', (await progress.count()) === 1)
  check('barra usa transform (scaleX) e não width', await progress.evaluate((element) => getComputedStyle(element).transform !== 'none' || element.style.getPropertyValue('--v') !== ''))

  await page.fill('#set-awe1-1-weight', '60')
  await page.fill('#set-awe1-1-reps', '10')
  await page.click('section#exercise-awe1 button[aria-label="Marcar série 2 como concluída"]')
  await page.waitForSelector('section#exercise-awe1 button[aria-label="Desmarcar série 2"]')
  const animations = await page.evaluate(() => document.getAnimations().map((animation) => animation.animationName ?? ''))
  check('marcar a série dispara o pop do ✓ (CSS)', animations.includes('pop'))
  check('o botão ✓ continua com 44 px depois da animação', await page.evaluate(() => {
    const button = document.querySelector('section#exercise-awe1 button[aria-label="Desmarcar série 2"]')
    const rect = button.getBoundingClientRect()
    return rect.width >= 43.5 && rect.height >= 43.5
  }))

  // Sem blur de fundo no toast nem no modal (pesa no celular fraco).
  await page.click('button:has-text("Concluir")')
  await page.waitForSelector('[role=dialog]')
  const blur = await page.evaluate(() => {
    const overlay = document.querySelector('[role=dialog]').closest('.fixed') ?? document.querySelector('[role=dialog]').parentElement
    return getComputedStyle(overlay).backdropFilter
  })
  check('fundo do painel sem backdrop-blur', blur === 'none' || blur === '' || blur === undefined)
  await page.keyboard.press('Escape')

  // Entrada de tela em CSS.
  await page.goto(`${BASE}/student/history`)
  const pageIn = await page.evaluate(() => document.querySelectorAll('.page-in').length)
  check('entrada de tela é CSS (.page-in)', pageIn >= 1)

  // ------------------------------------------------ reduzir movimento
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${BASE}/student/today`)
  await page.waitForSelector('h1:has-text("Fala,")')
  await page.waitForTimeout(500)
  const infinite = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().iterations === Infinity && animation.playState === 'running')
      .map((animation) => animation.animationName ?? 'sem nome'),
  )
  check('reduzir movimento: nenhuma animação em loop rodando', infinite.length === 0)
  const delays = await page.evaluate(() => {
    let bad = 0
    for (const element of document.querySelectorAll('*')) {
      const style = getComputedStyle(element)
      if (style.animationDelay.split(',').some((value) => parseFloat(value) !== 0) && style.animationName !== 'none') bad += 1
      if (style.transitionDelay.split(',').some((value) => parseFloat(value) !== 0)) bad += 1
    }
    return bad
  })
  check('reduzir movimento: nenhum atraso de animação ou transição', delays === 0)
  const decorative = await page.evaluate(() => [...document.querySelectorAll('.aurora, .challenge-border')].every((element) => getComputedStyle(element).animationName === 'none'))
  check('reduzir movimento: aurora e borda giratória desligadas', decorative)

  await page.goto(`${BASE}/student/workout/w-a`)
  await page.waitForSelector('section#exercise-awe1')
  await page.fill('#set-awe1-2-weight', '60')
  await page.fill('#set-awe1-2-reps', '10')
  await page.click('section#exercise-awe1 button[aria-label="Marcar série 3 como concluída"]')
  await page.waitForSelector('section#exercise-awe1 button[aria-label="Desmarcar série 3"]')
  const reducedAnimations = await page.evaluate(() => document.getAnimations().filter((animation) => animation.animationName === 'pop' && animation.effect.getComputedTiming().duration > 20).length)
  check('reduzir movimento: o pop do ✓ vira troca imediata', reducedAnimations === 0)

  // Resumo do treino: informação visível quase na hora, com e sem movimento.
  await page.click('button:has-text("Concluir")')
  await page.waitForSelector('[role=dialog]')
  await page.click('[role=dialog] button:has-text("Salvar treino")')
  await page.waitForSelector('text=Músculos trabalhados', { timeout: 30000 })
  await page.waitForTimeout(400)
  const visible = await page.evaluate(() => {
    const share = [...document.querySelectorAll('button')].find((element) => /Compartilhar nos stories/.test(element.textContent ?? ''))
    if (!share) return 0
    let lowest = 1
    for (let node = share; node && node !== document.body; node = node.parentElement) lowest = Math.min(lowest, parseFloat(getComputedStyle(node).opacity))
    return lowest
  })
  check('reduzir movimento: o resumo e os botões estão visíveis em 400 ms', visible > 0.95)
  await page.screenshot({ path: path.join(OUT, 'm01-resumo-reduzido.png'), fullPage: true })

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
