// Auditoria axe (WCAG 2.1 A/AA) do Perfil novo (aluno) e da ficha/painel (treinador).
const path = require('path')
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:3200'
const MOCK = 'http://localhost:54321'
const { runAxe } = require('./run-axe.cjs')
const fixture = (name) => path.join(__dirname, '..', 'fixtures', name)

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
  const pickInSheet = async (file) => {
    await page.setInputFiles('label:has-text("Escolher da galeria") input[type=file]', fixture(file))
    await page.waitForSelector('img[alt="Foto sendo recortada"]', { timeout: 30000 })
  }

  await login('maria')
  await page.goto(BASE + '/student/profile', { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Medidas e evolução')
  await audit('/student/profile')

  const avatarButton = page.locator('button[aria-label$="foto de perfil"]')
  await avatarButton.click()
  await page.waitForSelector('text=Escolher da galeria')
  await audit('ações da foto')
  await pickInSheet('upload-1.jpg')
  await audit('recorte da foto (círculo)')
  await page.click('button:has-text("Usar foto")')
  await page.waitForSelector('text=Foto atualizada', { timeout: 30000 })

  await page.click('button:has-text("capa")')
  await pickInSheet('upload-2.jpg')
  await audit('recorte da capa')
  await page.click('button:has-text("Usar foto")')
  await page.waitForSelector('text=Capa atualizada', { timeout: 30000 })
  await page.waitForTimeout(800)
  await audit('perfil com foto e capa')

  await page.click('button:has-text("Editar perfil")')
  await page.fill('#profile-instagram', 'nome inválido!')
  await page.click('button:has-text("Salvar perfil")')
  await page.waitForSelector('[role=dialog] >> text=Instagram inválido')
  await audit('editar perfil com erro')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  await page.click('button:has-text("Toque para ver a trilha")')
  await page.waitForSelector('[role=dialog] [aria-current=step]')
  await audit('trilha de níveis')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  await page.click('button:has-text("Registrar")')
  await page.fill('#measure-weight', '1000')
  await page.setInputFiles('[role=dialog] input[type=file][multiple]', fixture('progress-after.jpg'))
  await page.click('button:has-text("Salvar medidas")')
  await page.waitForSelector('[role=dialog] >> text=entre 20 e 400')
  await audit('registrar medidas com erro e foto')
  await page.fill('#measure-weight', '66,2')
  await page.click('button:has-text("Salvar medidas")')
  await page.waitForSelector('text=Medidas salvas', { timeout: 30000 })
  await page.waitForTimeout(1200)
  await audit('medidas com gráfico e fotos')

  await page.click('button:has-text("Antes e depois")')
  await page.waitForSelector('[role=slider][aria-label="Posição da comparação"]')
  await audit('antes e depois')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.click('button[aria-label^="Ver fotos de"] >> nth=0')
  await page.waitForTimeout(600)
  await audit('foto de evolução ampliada')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.click('button[aria-label^="Apagar registro de"] >> nth=0')
  await audit('confirmar apagar medida')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  // Sem o profile.sql
  await fetch(MOCK + '/__profile/off')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('text=O registro de medidas ainda não foi ativado')
  await audit('perfil sem o profile.sql')
  await avatarButton.click()
  await pickInSheet('upload-1.jpg')
  await page.click('button:has-text("Usar foto")')
  await page.waitForSelector('[role=dialog] >> text=ainda não foi ativado')
  await audit('recorte com erro de ativação')
  await page.click('[role=dialog] button:has-text("Cancelar")')
  await fetch(MOCK + '/__profile/on')

  // Treinador
  await context.clearCookies()
  await page.evaluate(() => localStorage.clear())
  await login('jean')
  await page.goto(BASE + '/admin', { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Adesão')
  await audit('/admin com foto do treinador')
  await page.goto(BASE + '/admin/students?aluno=u-student', { waitUntil: 'networkidle' })
  await page.click('[role=dialog] [role=tab]:has-text("Medidas")')
  await page.waitForSelector('[role=dialog] >> text=Medidas e evolução')
  await page.waitForTimeout(1200)
  await audit('ficha da aluna com perfil e medidas')
  await page.click('[role=dialog] button:has-text("Registrar")')
  await page.waitForSelector('text=Avaliação de Maria Souza')
  await audit('treinador registrando medidas')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await fetch(MOCK + '/__profile/off')
  await page.goto(BASE + '/admin/students?aluno=u-student', { waitUntil: 'networkidle' })
  await page.click('[role=dialog] [role=tab]:has-text("Medidas")')
  await page.waitForSelector('[role=dialog] >> text=rode o arquivo supabase/profile.sql')
  await audit('ficha sem o profile.sql')
  await fetch(MOCK + '/__profile/on')

  console.log(`\nTOTAL DE VIOLAÇÕES: ${total}`)
  if (total > 0) process.exitCode = 1
  await browser.close()
})().catch((error) => {
  console.error('FALHOU:', error)
  process.exit(1)
})
