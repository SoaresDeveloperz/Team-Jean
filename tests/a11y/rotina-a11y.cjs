// Auditoria axe (WCAG 2.1 A/AA) da rotina da semana: Hoje no dia marcado, em dia de
// descanso e na semana nova, a tela Semana com os dias e, para o treinador, os
// treinos do aluno com o seletor de dia e os botões de ordem e o construtor com o dia.
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:3200'
const MOCK = 'http://localhost:54321'
const { runAxe } = require('./run-axe.cjs')
const today = new Date().getDay()
const day = (offset) => (today + offset + 7) % 7

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
  const seed = (params) => fetch(`${MOCK}/__rotina/seed?${new URLSearchParams(params)}`)

  await login('maria')
  await seed({ limpar: '1', a: String(today), b: String(day(1)) })
  await page.goto(BASE + '/student/today')
  await page.waitForSelector('text=Hoje é dia de')
  await audit('Hoje no dia marcado')
  await seed({ limpar: '1', a: String(day(1)), b: String(day(2)) })
  await page.goto(BASE + '/student/today')
  await page.waitForSelector('text=Hoje é dia de descansar')
  await audit('Hoje em dia de descanso ("Adiantar este treino")')
  await seed({ limpar: '1', a: '', b: '' })
  await page.goto(BASE + '/student/today')
  await page.waitForSelector('text=Semana nova!')
  await audit('Hoje com a semana nova')
  await seed({ limpar: '1', a: String(day(1)), b: String(day(2)) })
  await page.goto(BASE + '/student/week')
  await page.waitForSelector('h1:has-text("Seus treinos")')
  await audit('Semana com os dias')

  await context.clearCookies()
  await page.evaluate(() => localStorage.clear())
  await login('jean')
  await page.goto(BASE + '/admin/workouts')
  await page.waitForSelector('text=Maria Souza')
  await page.click('text=Maria Souza')
  await page.waitForSelector('select[id^="day-"]')
  await audit('treinos do aluno com dia e ordem')
  await page.click('button[aria-label^="Editar Treino A"]')
  await page.waitForSelector('#builder-day')
  await audit('construtor com o dia da semana')

  await browser.close()
  console.log('\nTOTAL:', total)
  process.exit(total ? 1 : 0)
})().catch((error) => {
  console.error('ERRO NA AUDITORIA:', error.message)
  process.exit(1)
})
