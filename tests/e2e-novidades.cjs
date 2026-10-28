// Roteiro das novidades: aquecimento sugerido com anilhas (treino do aluno,
// inclusive sem internet) e o botão de WhatsApp para quem sumiu (painel e
// lista de alunos do treinador). As contas puras ficam em contas-novidades.mjs.
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://localhost:3200'
const MOCK = 'http://localhost:54321'
const OUT = path.join(__dirname, '.output', 'shots')
const results = []
const problems = []

const check = (name, condition) => results.push(`${condition ? 'OK  ' : 'FAIL'} ${name}`)
const state = async () => (await fetch(`${MOCK}/__state`)).json()
async function shot(page, name) {
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
}
async function login(page, email, password = '123456') {
  await page.goto(`${BASE}/login`)
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type=submit]')
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60000 })
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  page.on('pageerror', (error) => problems.push(`pageerror @ ${page.url()}: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    // Esperados: requisições sem internet.
    const expected = /\b(400|401|403|404|422|429)\b/.test(text) || /ERR_INTERNET_DISCONNECTED|Failed to fetch|net::ERR/i.test(text)
    if (!expected) problems.push(`console @ ${page.url()}: ${text}`)
  })
  const section = (name) => page.locator('section[aria-label]', { has: page.locator('h2', { hasText: name }) })
  const warmupButton = (name) => section(name).locator('button', { hasText: 'Aquecer' })

  // ------------------------------------------------ quando aparece o botão
  await login(page, 'maria@teste.com')
  await page.goto(`${BASE}/student/workout/w-a`)
  await page.waitForSelector('text=Anterior')
  check('exercício com aquecimento prescrito pelo treinador: sem "Aquecer"', (await warmupButton('Supino Reto com Barra').count()) === 0)
  check('exercício sem carga (sem alvo e sem histórico): sem "Aquecer"', (await warmupButton('Crucifixo com Halteres').count()) === 0)
  check('exercício com carga da última vez: com "Aquecer"', (await warmupButton('Tríceps na Polia com Corda').count()) === 1)

  // --------------------------------------------- painel sem internet
  await page.goto(`${BASE}/student/workout/w-b`)
  await page.waitForSelector('text=Anterior')
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30000 })
  await page.waitForTimeout(1200)
  const before = await state()
  await context.setOffline(true)
  const button = warmupButton('Puxada Frontal')
  check('botão "Aquecer" tem 44 px de altura', ((await button.boundingBox())?.height ?? 0) >= 44)
  check('botão começa fechado (aria-expanded=false)', (await button.getAttribute('aria-expanded')) === 'false')
  await button.click()
  const panel = page.locator('section#warmup-awe4')
  await panel.waitFor({ timeout: 10000 })
  check('sem internet, o painel "Sugestão de aquecimento" abre', (await panel.textContent()).includes('Sugestão de aquecimento'))
  check('botão aberto aponta para o painel', (await button.getAttribute('aria-expanded')) === 'true' && (await button.getAttribute('aria-controls')) === 'warmup-awe4')
  const items = async () => (await panel.locator('ol li').allTextContents()).map((text) => text.replace(/\s+/g, ' '))
  let list = await items()
  check(
    '50 kg da última vez → 20 kg × 10, 30 kg × 6, 40 kg × 3',
    list.length === 3 && list[0].includes('20 kg × 10 repetições') && list[1].includes('30 kg × 6 repetições') && list[2].includes('40 kg × 3 repetições'),
  )
  check(
    'anilhas por lado na barra de 20 kg',
    list[0].includes('Só a barra de 20 kg') && list[1].includes('Na barra de 20 kg: 5 de cada lado') && list[2].includes('Na barra de 20 kg: 10 de cada lado'),
  )
  check('carga de trabalho com as anilhas: 15 de cada lado', (await panel.textContent()).includes('Carga de trabalho: 50 kg') && (await panel.textContent()).includes('Na barra de 20 kg: 15 de cada lado'))
  check('barra de 20 kg marcada por padrão', await panel.locator('input[type=radio][value="20"]').isChecked())
  await shot(page, 'n01-aquecimento-offline')

  await panel.locator('label', { hasText: '15 kg' }).click()
  list = await items()
  check(
    'trocar para a barra de 15 kg refaz as anilhas (20 → 2,5 · 30 → 5 + 2,5 · 40 → 10 + 2,5)',
    list[0].includes('Na barra de 15 kg: 2,5 de cada lado') && list[1].includes('5 + 2,5 de cada lado') && list[2].includes('10 + 2,5 de cada lado'),
  )
  check('carga de trabalho na barra de 15: 15 + 2,5 de cada lado', (await panel.textContent()).includes('Na barra de 15 kg: 15 + 2,5 de cada lado'))
  await panel.locator('input[type=radio][value="15"]').focus()
  await page.keyboard.press('ArrowRight')
  check('teclado: setas trocam a barra (15 → 10 kg)', await panel.locator('input[type=radio][value="10"]').isChecked())
  await page.keyboard.press('ArrowLeft')
  check('opções da barra com 44 px de altura', ((await panel.locator('label', { hasText: 'Sem barra' }).boundingBox())?.height ?? 0) >= 44)

  await page.reload()
  await page.waitForSelector('text=Anterior', { timeout: 30000 })
  await warmupButton('Puxada Frontal').click()
  await panel.waitFor({ timeout: 10000 })
  check('a barra escolhida fica guardada no aparelho (sem internet, depois de recarregar)', await panel.locator('input[type=radio][value="15"]').isChecked())
  await warmupButton('Puxada Frontal').focus()
  await page.keyboard.press('Enter')
  await panel.waitFor({ state: 'detached', timeout: 10000 })
  check('teclado: Enter no "Aquecer" fecha o painel', (await warmupButton('Puxada Frontal').getAttribute('aria-expanded')) === 'false')

  await context.setOffline(false)
  await page.waitForTimeout(2500)
  const after = await state()
  check(
    'o painel não grava nada (nenhuma série nova no servidor)',
    after.session_sets.length === before.session_sets.length && after.workout_sessions.length === before.workout_sessions.length,
  )

  // ------------------------------------- movimento reduzido: abre direto
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await page.waitForSelector('text=Anterior')
  await warmupButton('Puxada Frontal').click()
  // Mede a caixa que anima a altura (o painel por dentro já tem a altura final).
  const wrapper = panel.locator('xpath=../..')
  await wrapper.waitFor()
  const early = (await wrapper.boundingBox())?.height ?? 0
  await page.waitForTimeout(800)
  const final = (await wrapper.boundingBox())?.height ?? 0
  check('com movimento reduzido, o painel abre sem animação', final > 200 && early >= final - 1)
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  // ------------------------------------------------------ WhatsApp
  await context.clearCookies()
  await page.evaluate(() => localStorage.clear())
  await login(page, 'jean@teste.com')
  await page.goto(`${BASE}/admin`)
  await page.waitForSelector('text=Sem treinar há mais de 7 dias', { timeout: 30000 })
  const carlosLink = page.locator('a[aria-label="Chamar Carlos no WhatsApp"]')
  check('painel: botão WhatsApp ao lado de "Avisar" para quem sumiu', (await carlosLink.count()) === 1 && (await carlosLink.textContent()).includes('WhatsApp'))
  const href = (await carlosLink.getAttribute('href')) ?? ''
  check('link abre em outra aba com noopener', (await carlosLink.getAttribute('target')) === '_blank' && /noopener/.test((await carlosLink.getAttribute('rel')) ?? ''))
  check('link do WhatsApp sem telefone', href.startsWith('https://wa.me/?text=') && !/wa\.me\/\d/.test(href) && !/phone=/i.test(href))
  const text = decodeURIComponent(href.split('?text=')[1] ?? '')
  check('mensagem: "Oi, Carlos! Sentimos sua falta por aqui..." com emoji', text === 'Oi, Carlos! Sentimos sua falta por aqui. Quando quiser, um treino leve de 20 minutos já vale. Posso te ajudar a escolher? 💪')
  check('link codifica acento e emoji', href.includes('j%C3%A1') && href.includes('%F0%9F%92%AA'))
  check('mensagem sem sobrenome, objetivo ou dados de saúde', !/Lima|objetivo|PAR-Q|peso|medida/i.test(text))
  check('quem treinou na semana não ganha WhatsApp', (await page.locator('a[aria-label="Chamar Maria no WhatsApp"]').count()) === 0)
  await shot(page, 'n02-painel-whatsapp')

  await page.goto(`${BASE}/admin/students`)
  await page.waitForSelector('text=Carlos Lima')
  check('lista de alunos: sem o filtro, nenhum WhatsApp', (await page.locator('a[aria-label$="no WhatsApp"]').count()) === 0)
  await page.click('[role=radio]:has-text("Sem treinar")')
  await page.waitForSelector('a[aria-label="Chamar Carlos no WhatsApp"]')
  const listHref = (await page.getAttribute('a[aria-label="Chamar Carlos no WhatsApp"]', 'href')) ?? ''
  check('filtro "Sem treinar": WhatsApp do Carlos com a mesma mensagem', listHref === href)
  check('o cartão continua abrindo a ficha', (await page.locator('button', { hasText: 'Carlos Lima' }).count()) === 1)
  await shot(page, 'n03-alunos-sem-treinar')

  await browser.close()
  console.log(results.join('\n'))
  console.log('\nPROBLEMAS DE CONSOLE/PÁGINA:', problems.length ? '\n' + problems.join('\n') : 'nenhum')
  const failed = results.filter((line) => line.startsWith('FAIL')).length
  console.log(`\n${results.length - failed} de ${results.length} verificações OK`)
  if (failed > 0 || problems.length > 0) process.exitCode = 1
})().catch((error) => {
  console.log(results.join('\n'))
  console.log('\nPROBLEMAS:', problems.join('\n'))
  console.error('ERRO NO ROTEIRO:', error.message)
  process.exit(1)
})
