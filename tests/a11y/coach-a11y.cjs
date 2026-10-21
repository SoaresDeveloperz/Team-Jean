// Auditoria axe (WCAG 2.1 A/AA) das mecânicas do treinador e do corpo 3D.
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:3200'
const AXE = require.resolve('axe-core/axe.min.js')

;(async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  let total = 0
  const audit = async (label) => {
    await page.waitForTimeout(1000)
    await page.addScriptTag({ path: AXE })
    const result = await page.evaluate(async () => {
      const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })
      return res.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.slice(0, 4).map((n) => `${n.target.join(' ')} :: ${(n.failureSummary || '').split('\n').slice(1, 2).join(' ')}`),
        count: v.nodes.length,
      }))
    })
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

  await login('jean')
  await page.goto(BASE + '/admin', { waitUntil: 'networkidle' })
  const radar = page.locator('section', { hasText: 'Radar do treinador' })
  await radar.locator('[role=tabpanel]').waitFor({ timeout: 30000 })
  await audit('/admin com radar')
  await radar.locator('[role=tab]', { hasText: 'Progressão' }).click()
  await audit('radar: progressão')
  await radar.locator('[role=tab]', { hasText: 'Cansaço' }).click()
  await audit('radar: cansaço')
  await page.click('button[aria-label="Atalhos do treinador"]')
  await page.waitForSelector('nav[aria-label="Atalhos do treinador"]')
  await audit('atalhos do treinador abertos')
  await page.keyboard.press('Escape')

  await page.goto(BASE + '/admin/students?aluno=u-student', { waitUntil: 'networkidle' })
  await page.waitForSelector('[role=tablist]')
  await audit('ficha: resumo')
  await page.click('[role=dialog] [role=tab]:has-text("Corpo 3D")')
  await page.waitForSelector('[role=dialog] canvas', { timeout: 30000 })
  await page.waitForTimeout(1500)
  await audit('ficha: corpo 3D da semana')
  await page.click('[role=dialog] ul[aria-label="Músculos em destaque"] button >> nth=0')
  await audit('ficha: músculo em foco')
  await page.click('[role=dialog] [role=tab]:has-text("Medidas")')
  await page.waitForSelector('[role=dialog] >> text=Medidas e evolução')
  await audit('ficha: medidas')
  await page.click('[role=dialog] [role=tab]:has-text("Notas")')
  await page.waitForSelector('[role=dialog] textarea')
  await audit('ficha: notas')
  await page.keyboard.press('Escape')

  await page.goto(BASE + '/admin/exercises', { waitUntil: 'networkidle' })
  await page.click('button:has-text("Supino Reto com Barra")')
  await page.waitForSelector('[role=dialog] canvas', { timeout: 30000 })
  await page.waitForTimeout(1500)
  await audit('modelo 3D do exercício')
  await page.click('[role=dialog] button:has-text("Editar exercício")')
  await page.waitForSelector('#exercise-name')
  await page.waitForTimeout(1500)
  await audit('editor com prévia 3D')
  await page.keyboard.press('Escape')

  await page.goto(BASE + '/admin/community', { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Outubro sem falta')
  await audit('/admin/community com desafios')
  await page.click('button:has-text("Novo desafio")')
  await page.waitForSelector('#challenge-title')
  await audit('formulário de desafio')
  await page.keyboard.press('Escape')

  await context.clearCookies()
  await page.evaluate(() => localStorage.clear())
  await login('maria')
  await page.goto(BASE + '/student/community', { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Outubro sem falta')
  await audit('/student/community com desafio')

  console.log(`\nTOTAL DE VIOLAÇÕES: ${total}`)
  if (total > 0) process.exitCode = 1
  await browser.close()
})().catch((error) => {
  console.error('FALHOU:', error)
  process.exit(1)
})
