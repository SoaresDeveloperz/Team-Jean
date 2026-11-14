// Roteiro da nutrição: o treinador cria o plano pela ficha do aluno (responsável, metas, refeições,
// alimentos da TACO e um cadastrado à mão), a aluna vê "Alimentação" (inclusive sem internet), os
// créditos da TACO ficam só no Perfil, o banco sem o SQL e a auditoria axe nas telas novas.
// As contas puras ficam em contas-nutricao.mjs.
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright')
const { runAxe } = require('./a11y/run-axe.cjs')

const BASE = process.env.BASE || 'http://localhost:3200'
const MOCK = 'http://localhost:54321'
const OUT = path.join(__dirname, '.output', 'shots')
const results = []
const problems = []
const check = (name, condition, detail = '') => results.push(`${condition ? 'OK  ' : 'FAIL'} ${name}${condition || !detail ? '' : ` → ${detail}`}`)
const mock = (route) => fetch(`${MOCK}${route}`)

// Menor altura (em px) entre os elementos que casam com o seletor.
const minHeight = (page, selector) =>
  page.evaluate((sel) => {
    const heights = [...document.querySelectorAll(sel)].map((el) => el.getBoundingClientRect().height)
    return heights.length ? Math.min(...heights) : 0
  }, selector)

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
      if (!/\b(400|401|403|404|409|422|429)\b/.test(text) && !/ERR_INTERNET_DISCONNECTED|Failed to fetch|net::ERR/i.test(text)) problems.push(`console @ ${page.url()}: ${text}`)
    })
  }

  // ------------------------------------------------ o treinador monta o plano
  const jeanContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const jean = await jeanContext.newPage()
  watch(jean)
  await login(jean, 'jean')
  const dialog = '[role=dialog]'
  const top = () => jean.locator(dialog).last()
  const sheet = jean.locator('section[aria-label="Resumo do plano"]')

  // Banco sem o SQL: a aba pede para rodar os arquivos.
  await mock('/__nutricao/off')
  await jean.goto(`${BASE}/admin/students?aluno=u-student`)
  await jean.click(`${dialog} [role=tab]:has-text("Nutrição")`)
  await jean.waitForSelector(`${dialog} >> text=nutricao-plano.sql`)
  check('sem o SQL: a aba pede para rodar os arquivos de nutrição', (await jean.textContent(dialog)).includes('supabase/nutricao.sql'))
  await mock('/__nutricao/on')

  await jean.goto(`${BASE}/admin/students?aluno=u-student`)
  await jean.click(`${dialog} [role=tab]:has-text("Nutrição")`)
  await jean.waitForSelector(`${dialog} >> text=ainda não tem plano de alimentação`)
  check('aluno sem plano: convite para criar', (await jean.textContent(dialog)).includes('Maria ainda não tem plano'))

  await jean.click(`${dialog} button:has-text("Criar plano")`)
  await jean.fill('#plan-resp-name', 'Jean Souza')
  await top().getByRole('button', { name: 'Criar plano' }).click()
  await jean.waitForSelector('text=Informe o nome e o CRN')
  check('plano sem CRN é recusado com aviso (e o plano não foi criado)', (await jean.locator('section[aria-label="Resumo do plano"]').count()) === 0)
  await jean.fill('#plan-resp-crn', 'CRN-3 12345')
  await jean.fill('#plan-kcal', '1800')
  await jean.fill('#plan-protein', '110')
  await jean.fill('#plan-carb', '200')
  await jean.fill('#plan-fat', '55')
  await top().getByRole('button', { name: 'Criar plano' }).click()
  await sheet.waitFor()
  check('plano criado: responsável e metas aparecem', (await sheet.textContent()).includes('Jean Souza') && (await sheet.textContent()).includes('1.800'))

  await jean.click('button:has-text("+ Almoço")')
  await jean.waitForSelector('section[aria-label="Almoço"]')
  const lunch = jean.locator('section[aria-label="Almoço"]')
  const addFood = async (query, optionText, grams, portion) => {
    await lunch.getByRole('button', { name: 'Adicionar alimento' }).click()
    await jean.fill('input[aria-label="Buscar alimento"]', query)
    await jean.getByRole('button', { name: optionText }).first().click()
    await jean.fill('#food-grams', grams)
    if (portion) await jean.fill('#food-portion', portion)
    await jean.getByRole('button', { name: 'Adicionar à refeição' }).click()
    await jean.waitForSelector('#food-grams', { state: 'detached' })
  }
  await addFood('arroz cozido', /Arroz, tipo 1, cozido/, '150', '4 colheres de servir')
  await jean.waitForSelector('input[aria-label="Gramas de Arroz, tipo 1, cozido"]')
  check('arroz 150 g = 192 kcal no total', (await sheet.textContent()).includes('192'), await sheet.textContent())
  await addFood('feijao carioca', /Feijão, carioca, cozido/, '100', '')
  check('com o feijão: 268 kcal', (await sheet.textContent()).includes('268'), await sheet.textContent())

  // Leite integral da TACO vem sem calorias: o total avisa que é parcial.
  await addFood('leite de vaca integral', /Leite, de vaca, integral/, '100', '')
  const partial = await sheet.textContent()
  check('alimento sem calorias na tabela: total marcado como parcial (e não some)', partial.includes('Total parcial') && partial.includes('268'), partial)

  // Cadastra à mão o que a tabela não tem.
  await lunch.getByRole('button', { name: 'Adicionar alimento' }).click()
  await jean.fill('input[aria-label="Buscar alimento"]', 'leite integral')
  await jean.getByRole('button', { name: 'Não achou? Cadastrar alimento' }).click()
  await jean.fill('#new-food-name', 'Leite integral (rótulo)')
  await jean.fill('#new-food-kcal', '61')
  await jean.fill('#new-food-protein', '3')
  await jean.fill('#new-food-carb', '4,6')
  await jean.fill('#new-food-fat', '3,3')
  await jean.getByRole('button', { name: 'Cadastrar e escolher' }).click()
  await jean.fill('#food-grams', '0')
  await jean.getByRole('button', { name: 'Adicionar à refeição' }).click()
  await jean.waitForSelector('text=Informe as gramas, entre 1 e 5000.')
  check('0 g no seletor é recusado com aviso (e o seletor continua aberto)', (await jean.locator('#food-grams').count()) === 1)
  await jean.fill('#food-grams', '200')
  await jean.getByRole('button', { name: 'Adicionar à refeição' }).click()
  await jean.waitForSelector('input[aria-label="Gramas de Leite integral (rótulo)"]')
  check('alimento cadastrado à mão entra no plano (200 g = 122 kcal, total 390)', (await sheet.textContent()).includes('390'), await sheet.textContent())

  // Edita as gramas direto na linha.
  const grams = jean.locator('input[aria-label="Gramas de Arroz, tipo 1, cozido"]')
  await grams.fill('200')
  await grams.blur()
  await jean.waitForFunction(() => document.querySelector('section[aria-label="Resumo do plano"]')?.textContent?.includes('454'))
  check('mudar 150 g para 200 g de arroz atualiza o total (454 kcal)', (await sheet.textContent()).includes('454'), await sheet.textContent())

  // Gramas inválidas voltam ao valor salvo (nada de "abc" nem 0 no plano).
  await grams.fill('abc')
  await grams.blur()
  check('gramas inválidas ("abc") voltam ao valor salvo', (await grams.inputValue()) === '200', await grams.inputValue())
  await grams.fill('0')
  await grams.blur()
  check('0 g volta ao valor salvo', (await grams.inputValue()) === '200', await grams.inputValue())

  // Regressão: editar as gramas e tocar logo na medida caseira não pode perder o foco nem o texto digitado.
  const beansGrams = jean.locator('input[aria-label="Gramas de Feijão, carioca, cozido"]')
  const beansPortion = jean.locator('input[aria-label="Medida caseira de Feijão, carioca, cozido"]')
  await beansGrams.fill('120')
  await beansPortion.click()
  await beansPortion.pressSequentially('1 concha', { delay: 40 })
  check('o campo da medida mantém o foco e o texto enquanto as gramas salvam', (await beansPortion.inputValue()) === '1 concha' && (await beansPortion.evaluate((el) => el === document.activeElement)))
  await beansGrams.click()
  await jean.waitForTimeout(900)
  check('as duas edições (gramas e medida) foram salvas', (await beansGrams.inputValue()) === '120' && (await beansPortion.inputValue()) === '1 concha')

  // Toque duplo numa sugestão cria uma refeição só.
  await jean.locator('button:has-text("+ Jantar")').dblclick()
  await jean.waitForSelector('section[aria-label="Jantar"]')
  await jean.waitForTimeout(900)
  check('toque duplo em "+ Jantar" cria uma refeição só', (await jean.locator('section[aria-label="Jantar"]').count()) === 1)
  const sameName = jean.locator('input[aria-label="Nome de outra refeição"]')
  await sameName.fill('almoço')
  await sameName.press('Enter')
  await jean.waitForTimeout(900)
  check('"Outra refeição" com nome que já existe não duplica', (await jean.locator('section[aria-label="Almoço"]').count()) === 1)

  // Alvos de toque do treinador: pelo menos 44 px.
  const coachTargets = Math.min(
    await minHeight(jean, 'button[aria-label^="Tirar"]'),
    await minHeight(jean, 'section[aria-label="Almoço"] button'),
    await minHeight(jean, 'section[aria-label="Almoço"] input'),
  )
  check('alvos de toque da aba do treinador têm 44 px ou mais', coachTargets >= 43.5, String(coachTargets))

  await jean.waitForTimeout(900)
  await jean.screenshot({ path: path.join(OUT, 'nu01-treinador-plano.png') })
  const axeCoach = await runAxe(jean)
  check('axe: aba Nutrição do treinador sem violações', axeCoach.length === 0, JSON.stringify(axeCoach).slice(0, 700))

  await lunch.getByRole('button', { name: 'Adicionar alimento' }).click()
  await jean.fill('input[aria-label="Buscar alimento"]', 'pao')
  await jean.waitForSelector(`${dialog} >> text=Pão, trigo, francês`)
  await jean.waitForTimeout(500)
  const axePicker = await runAxe(jean)
  check('axe: busca de alimentos sem violações', axePicker.length === 0, JSON.stringify(axePicker).slice(0, 700))
  await jean.keyboard.press('Escape')

  // ------------------------------------------------ a aluna vê "Alimentação"
  const mariaContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const maria = await mariaContext.newPage()
  watch(maria)
  await login(maria, 'maria')
  await maria.goto(`${BASE}/student/today`)
  await maria.waitForSelector('h1:has-text("Fala,")')
  const todayLink = maria.getByRole('link', { name: 'Ver minha alimentação' })
  const linkHeight = await todayLink.evaluate((el) => el.getBoundingClientRect().height)
  check('o link "Ver minha alimentação" da Hoje tem 44 px ou mais de altura', linkHeight >= 43.5, String(linkHeight))
  await todayLink.click()
  await maria.waitForSelector('h1:has-text("Alimentação")')
  await maria.waitForSelector('section[aria-labelledby]')
  let text = await maria.textContent('main')
  check('a aluna vê o plano: refeição, medida caseira e gramas', text.includes('Almoço') && text.includes('4 colheres de servir') && text.includes('200 g') && text.includes('Arroz, tipo 1, cozido'))
  check('mostra o responsável técnico com o CRN', text.includes('Jean Souza') && text.includes('CRN-3 12345'))
  check('aviso de que não substitui nutricionista ou médico', text.includes('não substitui a orientação do seu nutricionista ou médico'))
  const mealTexts = await maria.locator('section[aria-labelledby]').allTextContents()
  check('por refeição só aparecem calorias (nada de carboidrato, proteína ou gordura)', mealTexts.length >= 2 && mealTexts.every((meal) => !/carboidrato|proteína|gordura/i.test(meal)), mealTexts.join(' || ').slice(0, 300))
  check('refeição vazia mostra "Nada nesta refeição ainda."', mealTexts.some((meal) => meal.includes('Jantar') && meal.includes('Nada nesta refeição ainda.')))
  check('responsável técnico em letra legível, perto do topo', (await maria.locator('p:has-text("Plano elaborado por")').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))) >= 14)
  check('metas do dia com barras (calorias, proteína, carboidrato, gordura)', (await maria.locator('[role=progressbar]').count()) === 4 && text.includes('469') && text.includes('1.800'), text.slice(0, 400))
  check('total parcial avisado ao aluno (leite sem calorias na TACO), só de calorias e macros', text.includes('Total parcial') && !/fibra|sódio|colesterol/i.test(text.slice(text.indexOf('Total parcial'), text.indexOf('Total parcial') + 160)))
  check('créditos da TACO NÃO ficam nas telas de nutrição', !/TACO|Tabela Brasileira/i.test(text))
  await maria.waitForTimeout(1200)
  await maria.screenshot({ path: path.join(OUT, 'nu02-aluna-alimentacao.png'), fullPage: true })
  const axeStudent = await runAxe(maria)
  check('axe: tela Alimentação sem violações', axeStudent.length === 0, JSON.stringify(axeStudent).slice(0, 700))

  // 320 px: nada estoura para o lado e os alvos de toque têm 44 px.
  await maria.setViewportSize({ width: 320, height: 640 })
  await maria.waitForTimeout(300)
  const narrow = await maria.evaluate(() => ({ overflow: document.documentElement.scrollWidth > window.innerWidth + 1 }))
  check('320 px: sem rolagem para o lado', !narrow.overflow)
  await maria.setViewportSize({ width: 390, height: 844 })

  // Sem internet (o servidor some): abre pela cópia do aparelho.
  await maria.route('**/rest/v1/nutrition_**', (route) => route.abort())
  await maria.reload()
  await maria.waitForSelector('text=Mostrando a cópia deste aparelho')
  text = await maria.textContent('main')
  check('sem internet: abre pela cópia do aparelho e avisa', text.includes('4 colheres de servir') && text.includes('Mostrando a cópia deste aparelho'))
  await maria.unroute('**/rest/v1/nutrition_**')

  // Créditos da TACO: no fim do Perfil.
  await maria.goto(`${BASE}/student/profile`)
  await maria.waitForSelector('text=Valores nutricionais')
  check('créditos da TACO no fim do Perfil', (await maria.textContent('main')).includes('Tabela Brasileira de Composição de Alimentos (TACO), 4ª edição revisada e ampliada, NEPA/UNICAMP, 2011'))

  // Sair da conta apaga a cópia do plano deste aparelho.
  const before = await maria.evaluate(() => Object.keys(window.localStorage).filter((key) => key.startsWith('team-jean:alimentacao:')).length)
  await maria.click('[aria-label="Sair da conta"]')
  await maria.waitForURL(/\/login/)
  const after = await maria.evaluate(() => Object.keys(window.localStorage).filter((key) => key.startsWith('team-jean:alimentacao:')).length)
  check('sair da conta apaga a cópia do plano do aparelho', before === 1 && after === 0, `${before} → ${after}`)

  // ------------------------------------------------ o treinador apaga o plano
  await jean.goto(`${BASE}/admin/students?aluno=u-student`)
  await jean.click(`${dialog} [role=tab]:has-text("Nutrição")`)
  await jean.getByRole('button', { name: 'Apagar plano de Maria' }).click()
  await top().getByRole('button', { name: 'Apagar', exact: true }).click()
  await jean.waitForSelector(`${dialog} >> text=ainda não tem plano de alimentação`)
  check('treinador apaga o plano e volta ao convite', (await jean.textContent(dialog)).includes('Maria ainda não tem plano') && (await jean.locator('section[aria-label="Resumo do plano"]').count()) === 0)
  await login(maria, 'maria')
  await maria.goto(`${BASE}/student/nutrition`)
  await maria.waitForSelector('text=ainda não foi montado')
  check('sem plano, a aluna vê "ainda não foi montado" e nenhuma refeição', (await maria.textContent('main')).includes('ainda não foi montado') && (await maria.locator('section[aria-labelledby]').count()) === 0)
  await maria.goto(`${BASE}/student/today`)
  await maria.waitForSelector('h1:has-text("Fala,")')
  check('sem plano, o link da Hoje some', (await maria.getByRole('link', { name: 'Ver minha alimentação' }).count()) === 0)

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
