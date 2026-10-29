// Roteiro do menu do aluno com 5 abas, do painel do treinador no celular (o que pede
// ação vem primeiro, filtros do radar sem se sobrepor) e da lista de alunos em
// linhas com colunas no computador.
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://localhost:3200'
const OUT = path.join(__dirname, '.output', 'shots')
const results = []
const problems = []
const check = (name, condition) => results.push(`${condition ? 'OK  ' : 'FAIL'} ${name}`)

async function login(page, who) {
  await page.goto(`${BASE}/login`)
  await page.fill('#email', `${who}@teste.com`)
  await page.fill('#password', '123456')
  await page.click('button[type=submit]')
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60000 })
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const watch = (page) => {
    page.on('pageerror', (error) => problems.push(`pageerror @ ${page.url()}: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      const text = message.text()
      if (!/\b(400|401|403|404|422|429)\b/.test(text) && !/ERR_INTERNET_DISCONNECTED|Failed to fetch|net::ERR/i.test(text)) problems.push(`console @ ${page.url()}: ${text}`)
    })
  }

  // ------------------------------------------------ aluno no celular
  const phone = await browser.newContext({ viewport: { width: 360, height: 740 } })
  const student = await phone.newPage()
  watch(student)
  await login(student, 'maria')
  await student.goto(`${BASE}/student/today`)
  await student.waitForSelector('h1:has-text("Fala,")')
  const links = student.locator('nav[aria-label="Menu do aluno"] a')
  check('menu do aluno tem 5 abas', (await links.count()) === 5)
  check('menu do aluno não tem mais "Semana" (abre pelo Hoje)', (await student.locator('nav[aria-label="Menu do aluno"] a[href="/student/week"]').count()) === 0)
  const week = student.locator('a', { hasText: 'Ver minha semana' })
  check('Hoje tem "Ver minha semana" de 44 px ou mais', (await week.count()) === 1 && ((await week.boundingBox())?.height ?? 0) >= 43.5)
  const clipped = await student.evaluate(() => [...document.querySelectorAll('nav[aria-label="Menu do aluno"] a span:last-child')].filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.textContent))
  check('nenhum nome de aba do aluno é cortado em 360 px', clipped.length === 0)
  await week.click()
  await student.waitForURL('**/student/week')
  check('"Ver minha semana" abre a tela da semana', true)

  // ------------------------------------------------ treinador no celular
  const coach = await phone.newPage()
  watch(coach)
  await phone.clearCookies()
  await login(coach, 'jean')
  await coach.goto(`${BASE}/admin`)
  await coach.waitForSelector('text=Radar do treinador')
  await coach.waitForTimeout(800)
  const order = await coach.evaluate(() => {
    const top = (text) => {
      const element = [...document.querySelectorAll('h2, p, span, div')].find((node) => node.children.length === 0 && node.textContent?.trim() === text)
      return element ? element.getBoundingClientRect().top + window.scrollY : Infinity
    }
    return { finance: top('Financeiro'), radar: top('Radar do treinador') }
  })
  check('no celular o Financeiro vem antes do Radar', order.finance < order.radar)
  const adminLinks = coach.locator('nav[aria-label="Menu do treinador"]:visible a')
  check('menu do treinador no celular tem 5 abas com nome inteiro', (await adminLinks.count()) === 5)
  const adminClipped = await coach.evaluate(() => [...document.querySelectorAll('nav[aria-label="Menu do treinador"].fixed a span:last-child')].filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.textContent))
  check('nenhum nome de aba do treinador é cortado em 360 px', adminClipped.length === 0)
  const overlap = await coach.evaluate(() => {
    const tabs = [...document.querySelectorAll('[role=tablist] [role=tab]')].slice(0, 4).map((tab) => tab.getBoundingClientRect())
    let bad = 0
    for (let index = 1; index < tabs.length; index += 1) if (tabs[index].left < tabs[index - 1].right - 0.5) bad += 1
    return bad
  })
  check('filtros do radar não se sobrepõem', overlap === 0)
  check('filtros do radar têm 44 px ou mais', await coach.evaluate(() => [...document.querySelectorAll('[role=tablist] [role=tab]')].every((tab) => tab.getBoundingClientRect().height >= 43.5)))
  await coach.screenshot({ path: path.join(OUT, 'p01-painel-celular.png') })

  // ------------------------------------------------ treinador no computador
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const wide = await desktop.newPage()
  watch(wide)
  await login(wide, 'jean')
  await wide.goto(`${BASE}/admin/students`)
  await wide.waitForSelector('text=Maria Souza')
  await wide.waitForTimeout(800)
  const row = wide.locator('button', { hasText: 'Maria Souza' }).first()
  check('lista de alunos no computador ocupa a largura (linha larga)', ((await row.boundingBox())?.width ?? 0) > 900)
  check('há cabeçalho de colunas (Aluno, Na semana, Último treino, Saúde, Prontidão)', await wide.evaluate(() => ['Aluno', 'Na semana', 'Último treino', 'Saúde', 'Prontidão'].every((label) => document.body.innerText.toLowerCase().includes(label.toLowerCase()))))
  check('os filtros da lista têm 44 px', ((await wide.locator('[role=radiogroup][aria-label="Filtrar alunos"] button').first().boundingBox())?.height ?? 0) >= 43.5)
  await wide.screenshot({ path: path.join(OUT, 'p02-alunos-computador.png') })
  await row.click()
  await wide.waitForSelector('[role=dialog]')
  check('clicar na linha abre a ficha do aluno', true)

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
