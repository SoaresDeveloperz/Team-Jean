// Auditoria axe (WCAG 2.1 A/AA) do "Tenho pouco tempo" e da tela Hoje enxuta:
// Hoje com o resto do dia recolhido e aberto, o painel "Sai hoje", o treino na
// versão curta (com a faixa "Desfazer"), o cronômetro de descanso de 44 px e o
// histórico do aluno com o selo.
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
  await login('maria')

  await page.goto(BASE + '/student/today')
  await page.waitForSelector('text=Treino D - Longo')
  await audit('Hoje enxuta (resto do dia recolhido)')
  await page.locator('details summary', { hasText: 'Ver mais do seu dia' }).click()
  await page.waitForSelector('text=Recuperação muscular')
  await audit('Hoje com "Ver mais do seu dia" aberto')

  await page.goto(BASE + '/student/workout/w-d?curto=1')
  await page.waitForSelector('[role=dialog] >> text=Fazer versão curta')
  await audit('painel "Versão de cerca de N min só para hoje"')
  await page.locator('[role=dialog] label', { hasText: 'Puxada Frontal' }).click()
  await audit('painel com um exercício mantido')
  await page.locator('[role=dialog] label', { hasText: 'Puxada Frontal' }).click()
  await page.locator('[role=dialog] button', { hasText: 'Fazer versão curta' }).click()
  await page.waitForSelector('[role=status]:has-text("Versão curta de hoje")')
  await audit('treino na versão curta (faixa "Desfazer")')

  await page.fill('#set-awd1-0-weight', '50')
  await page.fill('#set-awd1-0-reps', '10')
  await page.click('section#exercise-awd1 button[aria-label="Marcar série 1 como concluída"]')
  await page.waitForSelector('section#exercise-awd1 button[aria-label="Desmarcar série 1"]')
  await audit('treino curto com série concluída e cronômetro de descanso')

  await page.click('button:has-text("Concluir")')
  await page.waitForSelector('[role=dialog]')
  await audit('finalizar o treino curto')
  await page.click('[role=dialog] button:has-text("Salvar treino")')
  await page.waitForSelector('text=Músculos trabalhados', { timeout: 30000 })

  await page.goto(BASE + '/student/history')
  await page.waitForSelector('text=Versão curta')
  await audit('histórico do aluno com o selo "Versão curta"')

  await browser.close()
  console.log('\nTOTAL:', total)
  process.exit(total ? 1 : 0)
})().catch((error) => {
  console.error('ERRO NA AUDITORIA:', error.message)
  process.exit(1)
})
