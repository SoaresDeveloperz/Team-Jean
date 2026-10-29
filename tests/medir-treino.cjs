// Medição (não é teste de regra) da tela de treino num "celular fraco": CPU 4x mais
// lenta e rede com latência de 4G ruim. Imprime números: tempo até o primeiro
// exercício aparecer e, ao digitar carga e repetições, a pior interação (INP) e o
// tempo bloqueado (long tasks). Serve para comparar antes e depois de mudanças.
// Uso: node tests/run.mjs medir   (a latência vem do CDP; o mock responde em ~0 ms)
const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://localhost:3200'
const RUNS = Number(process.env.RUNS || 3)

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

;(async () => {
  const browser = await chromium.launch()
  const rows = []
  for (let run = 0; run < RUNS; run += 1) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    await page.goto(`${BASE}/login`)
    await page.fill('#email', 'maria@teste.com')
    await page.fill('#password', '123456')
    await page.click('button[type=submit]')
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60000 })

    const client = await context.newCDPSession(page)
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await client.send('Network.enable')
    await client.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })

    const start = Date.now()
    await page.goto(`${BASE}/student/workout/w-a`, { waitUntil: 'commit' })
    await page.waitForSelector('section#exercise-awe1', { timeout: 60000 })
    const toExercise = Date.now() - start

    await page.evaluate(() => {
      window.__perf = { longtasks: [], worst: 0, events: [] }
      new PerformanceObserver((list) => list.getEntries().forEach((entry) => window.__perf.longtasks.push(entry.duration))).observe({ type: 'longtask', buffered: true })
      new PerformanceObserver((list) => list.getEntries().forEach((entry) => { window.__perf.worst = Math.max(window.__perf.worst, entry.duration); window.__perf.events.push(`${entry.name}:${Math.round(entry.duration)}`) })).observe({ type: 'event', durationThreshold: 16, buffered: true })
    })
    for (const id of ['#set-awe1-2-weight', '#set-awe1-2-reps']) {
      await page.click(id)
      await page.keyboard.type('12345678', { delay: 40 })
    }
    await page.click('section#exercise-awe1 button[aria-label="Marcar série 3 como concluída"]')
    await page.waitForTimeout(600)
    const perf = await page.evaluate(() => window.__perf)
    const blocked = perf.longtasks.reduce((sum, duration) => sum + Math.max(0, duration - 50), 0)
    rows.push({ events: perf.events.join(' '), toExercise, worst: Math.round(perf.worst), blocked: Math.round(blocked), longtasks: perf.longtasks.length })
    await context.close()
  }
  await browser.close()
  console.log(`MEDIÇÃO (CPU 4x, latência 300 ms, ${RUNS} execuções; mediana)`)
  console.log(`  até o primeiro exercício aparecer: ${median(rows.map((row) => row.toExercise))} ms`)
  console.log(`  pior interação ao digitar/marcar (INP): ${median(rows.map((row) => row.worst))} ms`)
  console.log(`  tempo bloqueado em long tasks: ${median(rows.map((row) => row.blocked))} ms`)
  console.log(`  long tasks: ${median(rows.map((row) => row.longtasks))}`)
  console.log('  execuções:', JSON.stringify(rows))
})().catch((error) => {
  console.error('ERRO NA MEDIÇÃO:', error.message)
  process.exit(1)
})
