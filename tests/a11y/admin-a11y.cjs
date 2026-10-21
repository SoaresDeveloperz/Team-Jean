// Auditoria axe (WCAG 2.1 A/AA) das telas do admin, com modais abertos.
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:3200'
const { runAxe } = require('./run-axe.cjs')

;(async () => {
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
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

  await login('jean')
  await page.waitForSelector('text=Foco muscular')
  await audit('/admin')

  await page.goto(BASE + '/admin/students', { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Maria Souza')
  await audit('/admin/students')
  await page.click('button:has-text("Maria Souza")')
  await page.waitForSelector('text=Últimos treinos')
  await audit('ficha do aluno')
  await page.click('[role=dialog] button:has-text("Editar nome")')
  await audit('ficha: editar nome')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.click('text=Cadastrar')
  await page.waitForSelector('#student-name')
  await audit('cadastro de aluno')
  await page.keyboard.press('Escape')

  await page.goto(BASE + '/admin/workouts', { waitUntil: 'networkidle' })
  await page.click('button:has-text("Maria Souza")')
  await page.waitForSelector('text=Treino A - Peito e Tríceps')
  await audit('/admin/workouts (acordeão aberto)')
  await page.click('button[aria-label="Editar Treino A - Peito e Tríceps"]')
  await page.waitForSelector('text=Editar treino')
  await audit('construtor')
  await page.click('[role=dialog] button:has-text("Reordenar")')
  await audit('construtor: reordenar')
  await page.click('[role=dialog] button:text-is("Adicionar")')
  await page.waitForSelector('text=Toque para marcar')
  await page.click('[role=dialog] button[aria-pressed]:has-text("Prancha")')
  await audit('seletor de exercícios')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.click('text=Ver cargas registradas >> nth=0')
  await page.waitForSelector('text=Sessão concluída')
  await audit('histórico de cargas')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.click('[role=radio]:has-text("Pastinha")')
  await audit('pastinha')
  await page.click('button:has-text("Atribuir a um aluno")')
  await page.click('[role=dialog] label:has-text("Carlos Lima")')
  await audit('lançar treino')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.click('button[aria-label="Apagar modelo Full body iniciante"]')
  await audit('confirmação de apagar')
  await page.keyboard.press('Escape')

  await page.goto(BASE + '/admin/exercises', { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Supino Reto com Barra')
  await audit('/admin/exercises')
  await page.click('button:has-text("Crucifixo com Halteres")')
  // O cartão abre o modelo 3D; o editor vem pelo botão "Editar exercício".
  await page.waitForSelector('[role=dialog] button:has-text("Editar exercício")')
  await page.click('[role=dialog] button:has-text("Editar exercício")')
  await page.waitForSelector('#exercise-name')
  await audit('editor de exercício')
  await page.keyboard.press('Escape')

  await page.goto(BASE + '/admin/announcements', { waitUntil: 'networkidle' })
  await page.click('button:has-text("Lembrete")')
  await audit('/admin/announcements')

  await page.goto(BASE + '/student/profile').catch(() => {})
  await page.context().clearCookies()
  await login('maria')
  await page.goto(BASE + '/student/profile', { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Conquistas')
  await audit('/student/profile')
  await page.click('button:has-text("Trocar senha")')
  await page.fill('#new-password', 'abc')
  await page.fill('#confirm-password', 'abd')
  await audit('trocar senha')

  await browser.close()
  console.log(`\nTOTAL: ${total}`)
  if (total > 0) process.exitCode = 1
})().catch((e) => {
  console.error('ERRO', e.message)
  process.exit(1)
})
