// Roteiro de ponta a ponta das ferramentas de gestão: esqueci minha senha,
// push de verdade (cifrado e entregue no serviço falso), treino offline com
// recado, resposta do treinador, carga-alvo, anamnese, avaliação física,
// financeiro com PIX, cron de lembretes e o layout do treinador no computador.
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright')
const { createDevice, decrypt, fakePushScript } = require('./push-decrypt.cjs')

const BASE = process.env.BASE || 'http://localhost:3200'
const MOCK = 'http://localhost:54321'
const OUT = path.join(__dirname, '.output', 'shots')
const results = []
const problems = []
let gestaoOff = false

const check = (name, condition) => results.push(`${condition ? 'OK  ' : 'FAIL'} ${name}`)
const state = async () => (await fetch(`${MOCK}/__state`)).json()
const pushes = async () => (await fetch(`${MOCK}/__pushes`)).json()
async function waitForState(predicate, timeout = 15000) {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    const current = await state()
    if (predicate(current)) return current
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return state()
}
async function waitForPushes(count, timeout = 15000) {
  const until = Date.now() + timeout
  const list = []
  while (Date.now() < until && list.length < count) {
    list.push(...(await pushes()))
    if (list.length >= count) break
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return list
}
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
async function logout(page, context) {
  await context.clearCookies()
  await page.evaluate(() => localStorage.clear())
}

// CRC16 do PIX (mesma regra do app) para conferir o código copiado.
function crc16(text) {
  let crc = 0xffff
  for (let index = 0; index < text.length; index += 1) {
    crc ^= text.charCodeAt(index) << 8
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// % de gordura esperado (Pollock 3, mulher, + Siri) para a data de hoje.
function expectedFat(sum, birth) {
  const now = new Date()
  const [year, month, day] = birth.split('-').map(Number)
  let age = now.getFullYear() - year
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age -= 1
  const density = 1.0994921 - 0.0009929 * sum + 0.0000023 * sum ** 2 - 0.0001392 * age
  return Math.round((495 / density - 450) * 10) / 10
}
const ptBR = (value) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)
const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const maria = createDevice()
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  await context.grantPermissions(['notifications', 'clipboard-read', 'clipboard-write'], { origin: BASE })
  await context.addInitScript(fakePushScript({ endpoint: `${MOCK}/__push/maria-celular`, p256dh: maria.p256dh, auth: maria.authKey }))
  const page = await context.newPage()
  page.on('pageerror', (error) => problems.push(`pageerror @ ${page.url()}: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    // Esperados: login/senha recusados (400/403/422/429), requisições sem internet e o banco sem o gestao.sql (404).
    const expected = /\b(400|401|403|404|422|429)\b/.test(text) || /ERR_INTERNET_DISCONNECTED|Failed to fetch|net::ERR/i.test(text) || gestaoOff
    if (!expected) problems.push(`console @ ${page.url()}: ${text}`)
  })

  // ------------------------------------------------ esqueci minha senha
  await page.goto(`${BASE}/login`)
  await page.click('a:has-text("Esqueci minha senha")')
  await page.waitForURL('**/esqueci-senha')
  await page.fill('#reset-email', 'maria@teste.com')
  await page.click('button:has-text("Enviar link")')
  await page.waitForSelector('text=Confira seu e-mail')
  check('esqueci a senha: confirmação sem revelar se a conta existe', (await page.textContent('main')).includes('Se existir uma conta'))
  const recoveries = await (await fetch(`${MOCK}/__recoveries`)).json()
  check(
    'pedido de nova senha leva o link de volta para /auth/confirm',
    recoveries[0]?.email === 'maria@teste.com' && String(recoveries[0]?.redirectTo).includes('/auth/confirm?next=/redefinir-senha'),
  )
  await shot(page, 'g01-esqueci-enviado')
  await page.click('button:has-text("Usar outro e-mail")')
  await page.fill('#reset-email', 'maria@teste.com')
  await page.click('button:has-text("Enviar link")')
  await page.waitForSelector('[role=alert]')
  check('pedido repetido explica o limite de 1 minuto', (await page.textContent('[role=alert]')).includes('Aguarde um minuto'))
  await page.goto(`${BASE}/auth/confirm?token_hash=vencido&type=recovery&next=/redefinir-senha`)
  await page.waitForURL('**/login?erro=link')
  check('link vencido volta ao login com aviso', (await page.textContent('main')).includes('expirou'))
  await page.goto(`${BASE}/redefinir-senha`)
  await page.waitForSelector('text=Link expirado')
  check('nova senha sem o link mostra "Link expirado"', true)
  await page.goto(`${BASE}/auth/confirm?token_hash=recovery-u-student&type=recovery&next=/redefinir-senha`)
  await page.waitForURL('**/redefinir-senha')
  await page.waitForSelector('text=Crie sua senha nova')
  check('link do e-mail entra logado na tela de nova senha', (await page.textContent('main')).includes('maria@teste.com'))
  await page.fill('#new-password', 'NovaSenha2026')
  await page.fill('#confirm-password', 'outra-coisa')
  await page.click('button:has-text("Salvar e entrar")')
  await page.waitForSelector('[role=alert]')
  check('senhas diferentes mostram erro', (await page.textContent('[role=alert]')).includes('não conferem'))
  await page.fill('#confirm-password', 'NovaSenha2026')
  await page.click('button:has-text("Salvar e entrar")')
  await page.waitForURL('**/student/today', { timeout: 30000 })
  check('senha nova salva e a aluna entra no app', (await state()).passwords['u-student'] === 'NovaSenha2026')

  // ------------------------------------------------------- push (aluna)
  await page.goto(`${BASE}/student/profile`)
  await page.waitForSelector('button[role=switch][aria-label="Notificações no celular"]', { timeout: 30000 })
  await page.click('button[role=switch][aria-label="Notificações no celular"]')
  await page.waitForSelector('text=Notificações ativadas')
  let current = await waitForState((value) => value.push_subscriptions.length > 0)
  const subscription = current.push_subscriptions[0]
  check('aparelho salvo no servidor com as chaves', subscription?.user_id === 'u-student' && subscription?.p256dh === maria.p256dh && subscription?.auth === maria.authKey)
  await page.click('button:has-text("Enviar notificação de teste")')
  await page.waitForSelector('text=Teste enviado')
  let delivered = await waitForPushes(1)
  let message = delivered[0] ? decrypt(maria, delivered[0].body) : null
  check('push de teste chega cifrado (aes128gcm) e assinado (VAPID)', delivered[0]?.headers.encoding === 'aes128gcm' && /^vapid t=/.test(delivered[0]?.headers.authorization ?? ''))
  check('push decifrado tem o título certo', message?.title === 'Notificações ativadas ✅' && message?.url === '/student/today')

  // ---------------------------------------------------- anamnese (aluna)
  await page.goto(`${BASE}/student/today`)
  await page.waitForSelector('text=Responda sua ficha de saúde')
  check('Hoje lembra de responder a ficha de saúde', true)
  await page.click('a:has-text("Responda sua ficha de saúde")')
  await page.waitForSelector('[role=dialog] >> text=PAR-Q')
  check('link abre a ficha direto no Perfil', page.url().includes('/student/profile'))
  await page.click('[role=dialog] button:has-text("Salvar ficha")')
  await page.waitForSelector('[role=dialog] [role=alert]')
  check('ficha incompleta pede todas as respostas do PAR-Q', (await page.textContent('[role=dialog] [role=alert]')).includes('Responda todas'))
  const groups = page.locator('[role=dialog] [role=radiogroup]')
  check('PAR-Q com 7 perguntas', (await groups.count()) === 7)
  for (let index = 0; index < 7; index += 1) await groups.nth(index).locator('label', { hasText: index === 4 ? 'Sim' : 'Não' }).click()
  await page.waitForSelector('[role=dialog] >> text=conversar com um médico')
  check('um "sim" mostra a recomendação médica', true)
  await page.fill('#anamnese-injuries', 'Dor no joelho direito ao agachar')
  await page.click('[role=dialog] label:has-text("Pressão alta")')
  await page.click('[role=dialog] label:has-text("3–4x")')
  await page.selectOption('#anamnese-sleep', '7')
  await shot(page, 'g02-anamnese')
  await page.click('[role=dialog] button:has-text("Salvar ficha")')
  await page.waitForSelector('text=Ficha de saúde salva')
  current = await state()
  const anamnese = current.anamneses.find((row) => row.student_id === 'u-student')
  check('ficha salva com PAR-Q positivo calculado no banco', anamnese?.parq_positive === true && anamnese?.answers.injuries.includes('joelho'))
  check('condições e hábitos salvos', anamnese?.answers.conditions.includes('hipertensao') && anamnese?.answers.activity === 'moderado' && anamnese?.answers.sleep === 7)
  check('treinador recebe o alerta do PAR-Q', current.notifications.some((note) => note.recipient_id === 'u-admin' && note.title === 'PAR-Q com alerta: Maria Souza'))
  await page.waitForSelector('text=Com alerta')
  check('Perfil mostra a ficha com alerta', true)

  // ---------------------------------------------- mensalidade e PIX (aluna)
  const billingCard = page.locator('section', { hasText: 'Mensalidade' }).first()
  await billingCard.waitFor()
  check('Perfil mostra a mensalidade a vencer', (await billingCard.textContent()).includes('Vence dia') && (await billingCard.textContent()).includes('150,00'))
  await page.click('button:has-text("Copiar PIX copia e cola")')
  await page.waitForSelector('text=PIX copiado')
  const pix = await page.evaluate(() => navigator.clipboard.readText())
  check('PIX copia e cola no padrão do Banco Central', pix.startsWith('000201') && pix.includes('br.gov.bcb.pix') && pix.includes('jean@teamjean.app') && pix.includes('5406150.00'))
  check('PIX com CRC16 válido', crc16(pix.slice(0, -4)) === pix.slice(-4))
  await shot(page, 'g03-perfil-pix')

  // ------------------------------------------- avaliação completa (aluna)
  const measures = page.locator('section', { hasText: 'Medidas e evolução' }).first()
  await measures.locator('button:has-text("Registrar")').click()
  await page.waitForSelector('#measure-weight')
  await page.fill('#measure-weight', '66')
  await page.click('[role=dialog] button:has-text("Avaliação completa")')
  await page.click('[role=dialog] label:has-text("Feminino")')
  await page.fill('[role=dialog] input[id$="-birth"]', '1995-04-12')
  await page.fill('[role=dialog] input[id$="-height"]', '165')
  await page.click('[role=dialog] label:has-text("Pollock 3")')
  await page.fill('[role=dialog] input[id$="-fold-triceps"]', '18')
  await page.fill('[role=dialog] input[id$="-fold-suprailiac"]', '16')
  await page.fill('[role=dialog] input[id$="-fold-thigh"]', '24')
  const fat = expectedFat(58, '1995-04-12')
  check('% de gordura calculado ao vivo (Pollock 3 + Siri)', (await page.inputValue('#measure-fat')) === ptBR(fat))
  check('IMC aparece com peso e altura', (await page.textContent('[role=dialog]')).includes('IMC') && (await page.textContent('[role=dialog]')).includes(ptBR(Math.round((66 / 1.65 ** 2) * 10) / 10)))
  await page.fill('[role=dialog] input[id$="-round-hip"]', '98')
  await page.fill('[role=dialog] input[id$="-round-arm_right"]', '29,5')
  await shot(page, 'g04-avaliacao')
  await page.click('[role=dialog] button:has-text("Salvar medidas")')
  await page.waitForSelector('text=Medidas salvas')
  current = await state()
  const assessment = current.body_measurements.find((row) => row.protocol === 'pollock3')
  check(
    'avaliação salva com dobras, perímetros e % calculado',
    assessment?.skinfolds?.triceps === 18 && assessment?.perimeters?.hip === 98 && assessment?.perimeters?.arm_right === 29.5 && Number(assessment?.body_fat) === fat,
  )
  const mariaProfile = current.profiles.find((profile) => profile.id === 'u-student')
  check('sexo, nascimento e altura ficam no perfil', mariaProfile.sex === 'F' && mariaProfile.birth_date === '1995-04-12' && Number(mariaProfile.height_cm) === 165)
  await page.waitForSelector('text=Massa magra')
  check('cartão mostra IMC e composição corporal', (await measures.textContent()).includes('IMC'))
  await measures.locator('button[aria-label^="Ver avaliação completa de"]').first().click()
  await page.waitForSelector('text=Pollock 3')
  check('histórico abre os perímetros e as dobras', (await measures.textContent()).includes('Quadril'))

  // -------------------------------------------- treino offline com recado
  await page.goto(`${BASE}/student/workout/w-b`)
  await page.waitForSelector('text=Anterior')
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30000 })
  await page.waitForTimeout(1200)
  await context.setOffline(true)
  await page.fill('#set-awe4-0-weight', '57,5')
  await page.fill('#set-awe4-0-reps', '10')
  await page.click('button[aria-label="Marcar série 1 como concluída"] >> nth=0')
  await page.waitForSelector('text=Sem internet: pode treinar normalmente')
  check('sem internet, a série é marcada e fica na fila', (await page.$('button[aria-label="Desmarcar série 1"]')) !== null)
  check('cabeçalho mostra "Offline"', (await page.textContent('[role=status] >> text=Offline')) !== null)
  await page.click('button[aria-label="Marcar série 2 como concluída"] >> nth=0')
  await page.waitForSelector('button[aria-label="Desmarcar série 2"]')
  check('série na fila mostra o selo de envio pendente', (await page.locator('button[aria-label="Desmarcar série 2"][aria-describedby]').count()) === 1)
  await page.reload()
  await page.waitForSelector('button[aria-label="Desmarcar série 2"]', { timeout: 30000 })
  check('sem internet, recarregar abre o treino guardado e mantém as séries', (await page.inputValue('#set-awe4-0-weight')) === '57.5')
  current = await state()
  check('nada chegou ao servidor enquanto offline', !current.workout_sessions.some((session) => session.assigned_workout_id === 'w-b' && session.id.length === 36))
  await page.click('button:has-text("Concluir")')
  await page.waitForSelector('[role=dialog] >> text=Como foi?')
  check('finalizar sem internet avisa que o treino fica no aparelho', (await page.textContent('[role=dialog]')).includes('Sem internet agora'))
  await page.click('[role=dialog] button:has-text("Senti dor")')
  await page.fill('[role=dialog] textarea', 'Senti o ombro na puxada, mas terminei.')
  await shot(page, 'g05-finalizar-offline')
  await page.click('[role=dialog] button:has-text("Salvar treino")')
  await page.waitForSelector('text=Treino salvo no aparelho')
  check('resumo aparece mesmo sem internet', (await page.textContent('body')).includes('Músculos trabalhados'))
  await shot(page, 'g06-resumo-offline')
  await context.setOffline(false)
  await page.waitForSelector('text=Conexão de volta', { timeout: 30000 })
  current = await waitForState((value) => value.workout_sessions.some((session) => session.assigned_workout_id === 'w-b' && session.feedback))
  const offlineSession = current.workout_sessions.find((session) => session.assigned_workout_id === 'w-b' && session.feedback)
  check(
    'conexão voltou: sessão, séries e recado sobem sozinhos',
    offlineSession?.status === 'completed' &&
      offlineSession.feedback_tags?.includes('Senti dor') &&
      current.session_sets.filter((set) => set.session_id === offlineSession.id).map((set) => Number(set.weight_kg)).sort().join() === '52.5,57.5',
  )
  check(
    'treinador recebe o recado no sino',
    current.notifications.some((note) => note.recipient_id === 'u-admin' && note.title === 'Recado de Maria Souza' && note.message.includes('Senti dor')),
  )

  // ----------------------------------------------------------- treinador
  await logout(page, context)
  await login(page, 'jean@teste.com')
  await page.goto(`${BASE}/admin`)
  await page.click('header button[aria-label^="Notificações"]')
  await page.waitForSelector('[role=dialog] >> text=Recado de Maria Souza')
  check('sino do treinador lista recados e alertas de saúde', (await page.textContent('[role=dialog]')).includes('PAR-Q com alerta: Maria Souza'))
  check('aviso de recado leva ao radar', (await page.locator('[role=dialog] a:has-text("Responder no radar")').count()) > 0)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const radar = page.locator('section', { hasText: 'Radar do treinador' })
  await radar.locator('[role=tab][aria-selected=true]').waitFor({ timeout: 30000 })
  await page.waitForSelector('text=Senti o ombro na puxada')
  check('radar abre nos recados sem resposta', (await radar.locator('[role=tab][aria-selected=true]').textContent()).includes('Recados'))
  check('recado mostra as marcações do aluno', (await radar.textContent()).includes('Senti dor'))
  await radar.locator('button:has-text("Responder")').first().click()
  await radar.locator('button:has-text("Vou ajustar seu treino.")').click()
  await radar.locator('button:has-text("Enviar resposta")').click()
  await page.waitForSelector('text=Resposta enviada')
  current = await state()
  check('resposta salva no treino', current.workout_sessions.find((session) => session.id === offlineSession?.id)?.coach_reply === 'Vou ajustar seu treino.')
  check('aluna avisada da resposta', current.notifications.some((note) => note.recipient_id === 'u-student' && note.title === 'Resposta do treinador 💬'))
  delivered = await waitForPushes(1)
  message = delivered.map((item) => decrypt(maria, item.body)).find((item) => item.title === 'Resposta do treinador 💬')
  check('resposta chega no celular da aluna por push', Boolean(message) && message.url === '/student/today?avisos=1')

  await radar.locator('[role=tab]', { hasText: 'Progressão' }).click()
  await radar.locator('button:has-text("Aplicar 16,5 kg")').click()
  await page.waitForSelector('text=Carga aplicada no treino')
  current = await state()
  const carlosPrescription = current.assigned_workout_exercises.find((row) => row.id === 'awe5')
  check('progressão grava a carga-alvo nas séries do treino', carlosPrescription.planned_sets?.length === 3 && carlosPrescription.planned_sets.every((set) => set.weight === 16.5))
  check('aluno avisado da carga nova', current.notifications.some((note) => note.recipient_id === 'c0ffee00-0000-4000-8000-00000000c2c2' && note.title.startsWith('Carga nova')))

  await page.goto(`${BASE}/admin/students`)
  await page.waitForSelector('text=Carlos Lima')
  check('lista de alunos marca PAR-Q com alerta', (await page.locator('button', { hasText: 'Carlos Lima' }).textContent()).includes('PAR-Q'))
  await page.goto(`${BASE}/admin/students?aluno=u-student`)
  await page.waitForSelector('[role=dialog] >> text=Vou ajustar seu treino.')
  check('ficha mostra o recado e a resposta', (await page.textContent('[role=dialog]')).includes('Senti o ombro na puxada'))
  await page.click('[role=dialog] [role=tab]:has-text("Saúde")')
  await page.waitForSelector('[role=dialog] >> text=PAR-Q com alerta')
  check('aba Saúde mostra a anamnese', (await page.textContent('[role=dialog]')).includes('Dor no joelho direito') && (await page.textContent('[role=dialog]')).includes('Pressão alta'))
  await shot(page, 'g07-ficha-saude')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  await page.goto(`${BASE}/admin/students?aluno=c0ffee00-0000-4000-8000-00000000c2c2`)
  await page.waitForSelector('[role=dialog] button:has-text("Gerar senha nova")')
  await page.click('[role=dialog] button:has-text("Gerar senha nova")')
  await page.click('button:text-is("Gerar senha")')
  await page.waitForSelector('text=a antiga não funciona mais')
  const newPassword = (await page.locator('p.font-mono').textContent()).trim()
  current = await state()
  check('treinador gera senha nova para o aluno', /^[a-z2-9]{8}$/.test(newPassword) && current.passwords['c0ffee00-0000-4000-8000-00000000c2c2'] === newPassword)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // Carga-alvo pelo construtor.
  await page.goto(`${BASE}/admin/workouts`)
  await page.click('text=Maria Souza')
  await page.click('button[aria-label="Editar Treino A - Peito e Tríceps"]')
  await page.waitForSelector('text=Editar treino')
  await page.fill('[role=dialog] input[aria-label="Carga-alvo da série 2 em kg (opcional)"] >> nth=0', '62,5')
  await page.click('[role=dialog] button[type=submit]')
  await page.waitForSelector('text=Treino salvo')
  current = await state()
  check('construtor salva a carga-alvo da série', current.assigned_workout_exercises.find((row) => row.id === 'awe1')?.planned_sets?.[1]?.weight === 62.5)

  // ---------------------------------------------------------- financeiro
  await page.goto(`${BASE}/admin/finance`)
  await page.waitForSelector('h1:has-text("Financeiro")')
  await page.waitForSelector('article[aria-label="Maria Souza"]')
  const mariaRow = page.locator('article[aria-label="Maria Souza"]')
  const carlosRow = page.locator('article[aria-label="Carlos Lima"]')
  check('Maria aparece a vencer', (await mariaRow.textContent()).includes('Vence'))
  if (Number(todayIso().slice(8, 10)) > 1) check('Carlos aparece em atraso', (await carlosRow.textContent()).includes('Atrasado'))
  await shot(page, 'g08-financeiro')
  await mariaRow.locator('button:has-text("Receber")').click()
  await page.waitForSelector('#payment-amount')
  check('pagamento já vem com o valor da mensalidade', (await page.inputValue('#payment-amount')) === '150,00')
  await page.click('[role=dialog] button:has-text("Confirmar recebimento")')
  await page.waitForSelector('text=Pagamento registrado')
  await page.waitForSelector('article[aria-label="Maria Souza"] >> text=Pago')
  const month = `${todayIso().slice(0, 7)}-01`
  current = await state()
  check('pagamento salvo no mês', current.payments.some((payment) => payment.student_id === 'u-student' && payment.reference_month === month && Number(payment.amount) === 150 && payment.method === 'pix'))
  await carlosRow.locator('button:has-text("Lembrar")').click()
  await page.waitForSelector('text=Lembrete enviado')
  current = await state()
  check('lembrete da mensalidade chega no sino do aluno', current.notifications.some((note) => note.recipient_id === 'c0ffee00-0000-4000-8000-00000000c2c2' && note.type === 'billing'))
  await carlosRow.locator('button:has-text("Plano")').click()
  await page.waitForSelector('#plan-fee')
  await page.fill('#plan-fee', '130')
  await page.selectOption('#plan-due', String(Number(todayIso().slice(8, 10))))
  await page.click('[role=dialog] button:has-text("Salvar plano")')
  await page.waitForSelector('text=Plano salvo')
  current = await state()
  const carlosPlan = current.student_billing.find((row) => row.student_id === 'c0ffee00-0000-4000-8000-00000000c2c2')
  check('plano do aluno atualizado', Number(carlosPlan.monthly_fee) === 130 && carlosPlan.due_day === Number(todayIso().slice(8, 10)))
  await page.click('label:has-text("CPF")')
  await page.fill('#pix-key', '123')
  await page.click('button:has-text("Salvar recebimento")')
  await page.waitForSelector('text=Chave PIX inválida')
  check('chave PIX inválida é recusada', true)
  await page.click('label:has-text("E-mail")')
  await page.fill('#pix-key', 'Jean@TeamJean.app')
  await page.click('button[role=switch][aria-label="Lembrete automático da mensalidade"]')
  await page.click('button:has-text("Salvar recebimento")')
  await page.waitForSelector('text=PIX salvo')
  current = await state()
  check('PIX e lembrete automático salvos', current.coach_settings[0].pix_key === 'jean@teamjean.app' && current.coach_settings[0].billing_reminders === true)
  await mariaRow.locator('button:has-text("Desfazer")').click()
  await page.click('[role=dialog] button:has-text("Desfazer")')
  await page.waitForSelector('text=Pagamento desfeito')
  check('desfazer pagamento volta a mensalidade para aberta', !(await state()).payments.some((payment) => payment.student_id === 'u-student' && payment.reference_month === month))

  // Cron diário da Vercel.
  check('cron sem o segredo é recusado', (await fetch(`${BASE}/api/cron/billing`)).status === 401)
  const cron = await (await fetch(`${BASE}/api/cron/billing`, { headers: { Authorization: 'Bearer cron-teste' } })).json()
  check('cron lembra quem vence hoje (Carlos)', cron.ok === true && cron.reminders === 1)
  const again = await (await fetch(`${BASE}/api/cron/billing`, { headers: { Authorization: 'Bearer cron-teste' } })).json()
  check('cron não repete o lembrete no mesmo dia', again.reminders === 0)

  // ------------------------------------------------ treinador no computador
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/admin`)
  await page.waitForSelector('text=Radar do treinador')
  check('computador: menu lateral visível', await page.isVisible('aside nav[aria-label="Menu do treinador"]'))
  check('computador: menu inferior escondido', !(await page.locator('nav[aria-label="Menu do treinador"]').last().isVisible()) || (await page.locator('nav[aria-label="Menu do treinador"]:visible').count()) === 1)
  await page.waitForTimeout(1500)
  const kpis = await page.locator('main section.tile-spotlight').evaluateAll((tiles) => tiles.slice(0, 4).map((tile) => tile.getBoundingClientRect().top))
  check('computador: indicadores em uma linha só', kpis.length === 4 && Math.max(...kpis) - Math.min(...kpis) < 2)
  check('computador: sem o botão flutuante (o menu lateral já tem tudo)', !(await page.isVisible('button[aria-label="Atalhos do treinador"]')))
  await shot(page, 'g09-painel-desktop')
  await page.goto(`${BASE}/admin/finance`)
  await page.waitForSelector('text=Recebimento por PIX')
  const listBox = await page.locator('ul[aria-label^="Mensalidades de"]').boundingBox()
  const pixBox = await page.locator('section', { hasText: 'Recebimento por PIX' }).last().boundingBox()
  check('computador: financeiro em duas colunas', Boolean(listBox && pixBox && pixBox.x > listBox.x + listBox.width - 4))
  await shot(page, 'g10-financeiro-desktop')
  await page.goto(`${BASE}/admin/students`)
  await page.waitForSelector('text=Carlos Lima')
  await page.waitForTimeout(1200)
  const cards = await page.locator('main button:has(span:text("na semana"))').evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top))
  check('computador: alunos em grade', cards.length >= 2 && Math.abs(cards[0] - cards[1]) < 2)
  await shot(page, 'g11-alunos-desktop')
  await page.setViewportSize({ width: 390, height: 844 })

  // -------------------------------------- aluno com a senha nova e a carga-alvo
  await logout(page, context)
  await login(page, 'carlos@teste.com', newPassword)
  await page.waitForURL('**/student/**', { timeout: 30000 })
  check('aluno entra com a senha gerada pelo treinador', page.url().includes('/student'))
  await page.goto(`${BASE}/student/workout/w-c`)
  await page.waitForSelector('text=Anterior')
  check('treino mostra a carga-alvo como sugestão', (await page.getAttribute('#set-awe5-0-weight', 'placeholder')) === '16,5')
  check('exercício mostra o selo de carga-alvo', (await page.textContent('main')).includes('Carga-alvo'))
  await shot(page, 'g12-carga-alvo')
  await page.goto(`${BASE}/student/profile`)
  const carlosBilling = page.locator('section', { hasText: 'Mensalidade' }).first()
  await carlosBilling.waitFor()
  check('mensalidade de quem vence hoje', (await carlosBilling.textContent()).includes('Vence hoje') && (await carlosBilling.textContent()).includes('130,00'))

  // ----------------------------------------------- histórico com a resposta
  await logout(page, context)
  await login(page, 'maria@teste.com', 'NovaSenha2026')
  await page.goto(`${BASE}/student/history`)
  await page.waitForSelector('text=Treinador respondeu')
  await page.click('button:has(span:text("Treinador respondeu"))')
  await page.waitForSelector('text=Vou ajustar seu treino.')
  check('histórico mostra o recado e a resposta do treinador', (await page.textContent('main')).includes('Senti o ombro na puxada'))
  await shot(page, 'g13-historico-resposta')

  // -------------------------------------------------- banco sem o gestao.sql
  gestaoOff = true
  await fetch(`${MOCK}/__gestao/off`)
  await page.goto(`${BASE}/student/profile`)
  await page.waitForSelector('text=Ainda não ativada pelo treinador')
  check('sem o gestao.sql, a ficha de saúde avisa e a mensalidade some', (await page.locator('section', { hasText: 'Mensalidade' }).count()) === 0)
  await page.goto(`${BASE}/student/workout/w-a`)
  await page.waitForSelector('text=Anterior')
  await page.click('button[aria-label="Marcar série 3 como concluída"] >> nth=0')
  await page.click('button:has-text("Concluir")')
  await page.click('[role=dialog] button:has-text("Treino top")')
  await page.click('[role=dialog] button:has-text("Salvar treino")')
  await page.waitForSelector('text=Músculos trabalhados', { timeout: 30000 })
  current = await state()
  check('sem o gestao.sql, o treino é salvo sem o recado', current.workout_sessions.some((session) => session.assigned_workout_id === 'w-a' && session.status === 'completed' && session.id.length === 36 && !session.feedback_tags))
  await logout(page, context)
  await login(page, 'jean@teste.com')
  await page.goto(`${BASE}/admin/finance`)
  await page.waitForSelector('text=Ative o financeiro')
  check('sem o gestao.sql, o financeiro explica como ativar', (await page.textContent('main')).includes('supabase/gestao.sql'))
  await page.goto(`${BASE}/admin/students?aluno=u-student`)
  await page.click('[role=dialog] [role=tab]:has-text("Saúde")')
  await page.waitForSelector('[role=dialog] >> text=rode o arquivo supabase/gestao.sql')
  check('sem o gestao.sql, a aba Saúde explica como ativar', true)
  await fetch(`${MOCK}/__gestao/on`)
  gestaoOff = false

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
