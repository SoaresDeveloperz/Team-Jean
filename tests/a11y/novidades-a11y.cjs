// Auditoria axe (WCAG 2.1 A/AA) das novidades: painel de aquecimento com
// anilhas no treino (com e sem internet) e o botão de WhatsApp para quem
// sumiu no painel e na lista de alunos do treinador.
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:3200'
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
  const warmupButton = (name) =>
    page.locator('section[aria-label]', { has: page.locator('h2', { hasText: name }) }).locator('button', { hasText: 'Aquecer' })

  await login('maria')
  await page.goto(BASE + '/student/workout/w-b')
  await page.waitForSelector('text=Anterior')
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30000 })
  await warmupButton('Puxada Frontal').click()
  await page.waitForSelector('#warmup-awe4')
  await audit('treino com o painel de aquecimento aberto')
  await page.click('#warmup-awe4 label:has-text("Sem barra")')
  await audit('aquecimento sem barra')
  await page.goto(BASE + '/student/workout/w-a')
  await page.waitForSelector('text=Anterior')
  await context.setOffline(true)
  await warmupButton('Tríceps na Polia com Corda').click()
  await page.waitForSelector('#warmup-awe3')
  await audit('aquecimento sem internet (carga leve, barra só)')
  await context.setOffline(false)

  await context.clearCookies()
  await page.evaluate(() => localStorage.clear())
  await login('jean')
  await page.goto(BASE + '/admin')
  await page.waitForSelector('a[aria-label="Chamar Carlos no WhatsApp"]', { timeout: 30000 })
  await audit('/admin com WhatsApp para quem sumiu')
  await page.goto(BASE + '/admin/students')
  await page.waitForSelector('text=Carlos Lima')
  await page.click('[role=radio]:has-text("Sem treinar")')
  await page.waitForSelector('a[aria-label="Chamar Carlos no WhatsApp"]')
  await audit('/admin/students no filtro "Sem treinar"')

  await browser.close()
  console.log(`\nTOTAL: ${total}`)
  process.exit(total === 0 ? 0 : 1)
})().catch((error) => {
  console.error('ERRO NA AUDITORIA:', error.message)
  process.exit(1)
})
