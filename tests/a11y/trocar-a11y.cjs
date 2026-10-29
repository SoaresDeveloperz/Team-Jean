// Auditoria axe (WCAG 2.1 A/AA) do "Trocar exercício" e da marca "Essencial":
// treino com o botão "Trocar", o painel de troca, o exercício trocado, o painel
// da versão curta com exercício essencial e o construtor do Jean com os campos novos.
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

  await fetch(`${MOCK}/__curto/longo`)
  await fetch(`${MOCK}/__trocar/seed`)
  await login('maria')

  await page.goto(BASE + '/student/workout/w-a')
  await page.waitForSelector('section#exercise-awe1')
  await audit('treino com "Trocar" e exercício "Essencial"')
  await page.locator('section#exercise-awe1 button[data-swap-button]').click()
  await page.waitForSelector('[role=dialog] >> text=Estou trocando por causa de dor')
  await audit('painel "Trocar exercício"')
  await page.locator('[role=dialog] label', { hasText: 'Estou trocando por causa de dor' }).click()
  await audit('painel com "por causa de dor" marcado')
  await page.locator('[role=dialog] ul[aria-label^="Opções"] button').first().click()
  await page.waitForSelector('text=Trocado hoje')
  await audit('exercício trocado ("Trocado hoje")')
  await page.locator('section#exercise-awe1 button[data-swap-button]').click()
  await page.waitForSelector('[role=dialog] >> text=Voltar para')
  await audit('painel com "Voltar para o original"')
  await page.keyboard.press('Escape')

  await page.goto(BASE + '/student/workout/w-d?curto=1')
  await page.waitForSelector('[role=dialog] >> text=Essencial: o Jean pediu para manter')
  await audit('versão curta com exercício essencial travado')

  await context.clearCookies()
  await page.evaluate(() => localStorage.clear())
  await login('jean')
  await page.goto(BASE + '/admin/workouts')
  await page.waitForSelector('text=Maria Souza')
  await page.click('text=Maria Souza')
  await page.waitForSelector('text=Treino A - Peito e Tríceps')
  await page.click('button[aria-label="Editar Treino A - Peito e Tríceps"]')
  await page.waitForSelector('text=Editar treino')
  await audit('construtor com "Essencial" e alternativas')
  await page.locator('[role=dialog] button', { hasText: 'Alternativa' }).first().click()
  await page.waitForSelector('text=Alternativas de troca')
  await audit('seletor de alternativas')

  await browser.close()
  console.log('\nTOTAL:', total)
  process.exit(total ? 1 : 0)
})().catch((error) => {
  console.error('ERRO NA AUDITORIA:', error.message)
  process.exit(1)
})
