// Auditoria axe (WCAG 2.1 A/AA) dos GIFs dos exercícios: o GIF no treino
// (tocando, pausado, com movimento reduzido e sem internet), a busca na
// biblioteca do treinador, o "Vincular GIF" no editor e o aviso do banco
// ainda sem o supabase/exercicios.sql.
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:3200'
const MOCK = 'http://localhost:54321'
const { runAxe } = require('./run-axe.cjs')

;(async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  let total = 0
  const audit = async (label) => {
    await page.waitForTimeout(900)
    const result = await runAxe(page)
    total += result.length
    console.log(`== ${label}: ${result.length}`)
    for (const v of result) {
      console.log(`- [${v.impact}] ${v.id} (${v.count}): ${v.help}`)
      v.nodes.forEach((n) => console.log('    ' + n.slice(0, 240)))
    }
  }
  const login = async (who) => {
    await page.goto(BASE + '/login')
    await page.fill('#email', who + '@teste.com')
    await page.fill('#password', '123456')
    await page.click('button[type=submit]')
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 })
  }
  const mediaButton = (name) =>
    page.locator(`section[aria-label="${name}"] button[aria-label="Ver execução do exercício"]`)
  const gif = (name) => page.locator(`img[alt="Movimento do exercício ${name}"]`)

  await login('maria')
  await page.goto(BASE + '/student/workout/w-a')
  await page.waitForSelector('text=Anterior')
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30000 })
  await mediaButton('Crucifixo com Halteres').click()
  await gif('Crucifixo com Halteres').waitFor()
  await audit('treino com o GIF tocando')
  await page.click('section[aria-label="Crucifixo com Halteres"] button:has-text("Pausar movimento")')
  await audit('treino com o GIF pausado')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await page.waitForSelector('text=Anterior')
  await mediaButton('Crucifixo com Halteres').click()
  await page.waitForSelector('section[aria-label="Crucifixo com Halteres"] figure button:has-text("Ver movimento")')
  await audit('treino com movimento reduzido (antes de "Ver movimento")')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto(BASE + '/student/workout/w-b')
  await page.waitForSelector('text=Anterior')
  await page.waitForTimeout(1200)
  await context.setOffline(true)
  await page.reload()
  await page.waitForSelector('text=Anterior', { timeout: 30000 })
  await mediaButton('Puxada Frontal').click()
  await mediaButton('Puxada Frontal').waitFor({ state: 'detached' })
  await audit('treino sem internet depois do GIF falhar')
  await context.setOffline(false)

  await context.clearCookies()
  await page.evaluate(() => localStorage.clear())
  await login('jean')
  await page.goto(BASE + '/admin/exercises', { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Supino Reto com Barra')
  await audit('/admin/exercises com GIFs')
  await page.click('button:has-text("Buscar na biblioteca")')
  await page.waitForSelector('[role=dialog] ul[aria-label="Resultados da biblioteca"] li')
  await audit('busca na biblioteca (primeira página)')
  await page.fill('[role=dialog] input[type=search]', 'supino')
  await page.waitForSelector('[role=dialog] h3:text-is("Supino Reto com Barra")')
  await audit('busca "supino" com resultado já cadastrado')
  await page.fill('[role=dialog] input[type=search]', 'xyzxyz')
  await page.waitForSelector('[role=dialog] >> text=Nenhum exercício encontrado.')
  await audit('busca sem resultado')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  await page.click('main button:has-text("Crucifixo com Halteres")')
  await page.waitForSelector('[role=dialog] img[alt="Movimento do exercício Crucifixo com Halteres"]')
  await audit('detalhe do exercício com GIF')
  await page.click('[role=dialog] button:has-text("Editar exercício")')
  await page.waitForSelector('#exercise-name')
  await audit('editor com o GIF vinculado')
  await page.click('[role=dialog] button:has-text("Trocar GIF")')
  await page.waitForSelector('[role=dialog] ul[aria-label="Resultados da biblioteca"] li')
  await audit('"Trocar GIF" (biblioteca por cima do editor)')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  await fetch(`${MOCK}/__exercicios/off`)
  await page.goto(BASE + '/admin/exercises', { waitUntil: 'networkidle' })
  await page.waitForSelector('text=supabase/exercicios.sql')
  await audit('/admin/exercises sem o exercicios.sql (aviso)')
  await page.click('main button:has-text("Prancha")')
  await page.click('[role=dialog] button:has-text("Editar exercício")')
  await page.waitForSelector('#exercise-name')
  await audit('editor sem o exercicios.sql (aviso)')
  await fetch(`${MOCK}/__exercicios/on`)

  await browser.close()
  console.log(`\nTOTAL: ${total}`)
  process.exit(total === 0 ? 0 : 1)
})().catch((error) => {
  console.error('ERRO NA AUDITORIA:', error.message)
  process.exit(1)
})
