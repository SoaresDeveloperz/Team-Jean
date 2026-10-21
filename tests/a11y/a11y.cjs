// Uso: node a11y.cjs <maria|jean> <rota> [<rota> ...]
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:3200'
const { runAxe } = require('./run-axe.cjs')

;(async () => {
  const [who, ...routes] = process.argv.slice(2)
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  await page.goto(BASE + '/login')
  if (who !== 'anon') {
    await page.fill('#email', who + '@teste.com')
    await page.fill('#password', '123456')
    await page.click('button[type=submit]')
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 })
  }
  let total = 0
  for (const route of routes) {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 90000 })
    await page.waitForTimeout(1800)
    const result = await runAxe(page)
    total += result.length
    console.log(`\n== ${route}: ${result.length} violação(ões)`)
    for (const v of result) {
      console.log(`- [${v.impact}] ${v.id} (${v.count}): ${v.help}`)
      v.nodes.forEach((n) => console.log('    ' + n.slice(0, 220)))
    }
  }
  await browser.close()
  console.log(`\nTOTAL: ${total}`)
  if (total > 0) process.exitCode = 1
})().catch((e) => {
  console.error('ERRO', e.message)
  process.exit(1)
})
