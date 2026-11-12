// Roteiro da aba "Evolução" da ficha do aluno (pedido do Jean): carga por exercício,
// referência e percentual, troca de período, gráfico de cada exercício e auditoria axe.
// As contas puras ficam em contas-evolucao.mjs.
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright')
const { runAxe } = require('./a11y/run-axe.cjs')

const BASE = process.env.BASE || 'http://localhost:3200'
const OUT = path.join(__dirname, '.output', 'shots')
const results = []
const problems = []
const check = (name, condition, detail = '') => results.push(`${condition ? 'OK  ' : 'FAIL'} ${name}${condition || !detail ? '' : ` → ${detail}`}`)

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  page.on('pageerror', (error) => problems.push(`pageerror @ ${page.url()}: ${error.message}`))

  await page.goto(`${BASE}/login`)
  await page.fill('#email', 'jean@teste.com')
  await page.fill('#password', '123456')
  await page.click('button[type=submit]')
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60000 })

  const dialog = '[role=dialog]'
  await page.goto(`${BASE}/admin/students?aluno=u-student`)
  await page.waitForSelector(`${dialog} [role=tab]:has-text("Evolução")`)
  await page.click(`${dialog} [role=tab]:has-text("Evolução")`)
  await page.waitForSelector(`${dialog} >> text=Puxada Frontal`)
  let text = await page.textContent(dialog)
  check('7 dias: puxada do treino de ontem aparece como 1º registro', text.includes('Puxada Frontal') && text.includes('1º registro'))
  check('7 dias: supino de 7 dias atrás fica de fora', !text.includes('Supino Reto com Barra'))

  await page.click(`${dialog} button:has-text("30 dias")`)
  await page.waitForSelector(`${dialog} >> text=Supino Reto com Barra`)
  text = await page.textContent(dialog)
  check('30 dias: supino 65 kg → 70 kg = +8%', text.includes('65 kg × 7') && text.includes('70 kg × 6') && text.includes('+8%'), text.slice(0, 400))
  check('30 dias: resumo conta quem subiu', text.includes('1 subiu'))

  check('gráfico do supino aparece sem precisar tocar', (await page.locator(`${dialog} [role=img][aria-label*="Supino Reto com Barra"], ${dialog} figure:has-text("Supino")`).count()) > 0)
  check('exercício com um registro só não mostra gráfico', (await page.locator(`${dialog} [role=img]`).count()) === 1)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: path.join(OUT, 'ev01-evolucao-30-dias.png') })

  await page.waitForTimeout(600)
  const violations = await runAxe(page)
  check('axe: aba Evolução sem violações', violations.length === 0, JSON.stringify(violations).slice(0, 600))

  check('sem erro de página', problems.length === 0, problems.join(' | '))
  await browser.close()
  console.log(results.join('\n'))
  const failed = results.filter((line) => line.startsWith('FAIL')).length
  console.log(`\n${results.length - failed} de ${results.length} verificações OK`)
  if (failed > 0) process.exitCode = 1
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
