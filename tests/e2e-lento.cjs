// Sinal fraco (conecta mas não responde): com a cópia do treino no aparelho, a tela
// abre em poucos segundos em vez de ficar no esqueleto, e dá para treinar.
const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://localhost:3200'
const MOCK = 'http://localhost:54321'
const results = []
const problems = []
const check = (name, condition) => results.push(`${condition ? 'OK  ' : 'FAIL'} ${name}`)

;(async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  page.on('pageerror', (error) => problems.push(`pageerror @ ${page.url()}: ${error.message}`))
  await page.goto(`${BASE}/login`)
  await page.fill('#email', 'maria@teste.com')
  await page.fill('#password', '123456')
  await page.click('button[type=submit]')
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60000 })

  // 1ª abertura (com internet): guarda a cópia do treino no aparelho.
  await page.goto(`${BASE}/student/workout/w-a`)
  await page.waitForSelector('section#exercise-awe1')
  check('com internet o treino abre', true)
  check('a cópia do treino fica no aparelho', await page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith('team-jean:treino-salvo:'))))

  // Servidor pendurado: a tela espera pouco e usa a cópia.
  await fetch(`${MOCK}/__lento/on`)
  const started = Date.now()
  await page.goto(`${BASE}/student/workout/w-a`, { waitUntil: 'commit' })
  await page.waitForSelector('section#exercise-awe1', { timeout: 15000 })
  const elapsed = Date.now() - started
  check(`sinal fraco: o treino abre pela cópia em menos de 12 s (levou ${Math.round(elapsed / 1000)} s)`, elapsed < 12000)
  check('sinal fraco: aparece o aviso de cópia do treino', (await page.locator('text=Conexão lenta').count()) === 1)
  await page.fill('#set-awe1-2-weight', '55')
  check('sinal fraco: dá para digitar a carga', (await page.inputValue('#set-awe1-2-weight')) === '55')
  await fetch(`${MOCK}/__lento/off`)

  await browser.close()
  console.log(results.join('\n'))
  console.log('\nPROBLEMAS DE PÁGINA:', problems.length ? '\n' + problems.join('\n') : 'nenhum')
  const failed = results.filter((line) => line.startsWith('FAIL')).length
  console.log(`\n${results.length - failed} de ${results.length} verificações OK`)
  if (failed > 0 || problems.length > 0) process.exitCode = 1
})().catch((error) => {
  console.log(results.join('\n'))
  console.error('ERRO NO ROTEIRO:', error.message)
  process.exit(1)
})
