// Auditoria axe (WCAG 2.1 A/AA) da Comunidade e do Perfil novo.
const path = require('path')
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:3200'
const AXE = require.resolve('axe-core/axe.min.js')

;(async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  let total = 0
  const audit = async (label) => {
    await page.waitForTimeout(900)
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

  await login('maria')
  await page.goto(BASE + '/student/community', { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Ranking da semana')
  await audit('/student/community')
  await page.locator('article', { hasText: 'Bem-vindos' }).locator('button', { hasText: 'Comentar' }).click()
  await audit('campo de comentário aberto')
  await page.click('button:has-text("Compartilhe um treino")')
  await page.fill('[role=dialog] textarea', 'Teste de acessibilidade')
  await page.setInputFiles('[role=dialog] input[type=file]', [path.join(__dirname, '..', 'fixtures', 'upload-1.jpg')])
  await audit('editor de post com foto')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.locator('article', { hasText: 'Costas destruídas' }).locator('button[aria-label^="Abrir foto"]').first().click()
  await page.waitForSelector('[role=dialog] img[alt="Foto do post"]')
  await audit('visualizador de foto')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.locator('article', { hasText: 'Costas destruídas' }).locator('button[aria-label^="Opções do post"]').click()
  await audit('opções do post')
  await page.click('[role=dialog] button:has-text("Apagar post")')
  await audit('confirmação de apagar post')
  await page.keyboard.press('Escape')

  await page.goto(BASE + '/student/profile', { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Conquistas')
  await audit('/student/profile (nível)')
  await page.click('button:has-text("Primeiro passo")')
  await page.waitForSelector('[role=dialog] >> text=Compartilhar na comunidade')
  await audit('conquista com compartilhar')
  await page.click('[role=dialog] button:has-text("Compartilhar na comunidade")')
  await page.waitForSelector('[role=dialog] >> text=Conquista desbloqueada')
  await audit('editor com conquista')
  await page.keyboard.press('Escape')

  await context.clearCookies()
  await login('jean')
  await page.goto(BASE + '/admin/community', { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Ranking da semana')
  await audit('/admin/community')
  await page.click('button:has-text("Escreva um recado")')
  await audit('editor do treinador (fixar)')
  await page.keyboard.press('Escape')

  await browser.close()
  console.log(`\nTOTAL: ${total}`)
  if (total > 0) process.exitCode = 1
})().catch((e) => {
  console.error('ERRO', e.message)
  process.exit(1)
})
