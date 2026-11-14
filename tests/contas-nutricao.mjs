// Contas da aba de nutrição (src/lib/nutrition.ts) e integridade dos dados da TACO em
// supabase/nutricao-taco.sql: 597 alimentos, números sem buraco, vazios por nutriente
// (só célula em branco e "*" da TACO ficam sem dado; NA = não aplicável = 0) e energia coerente com proteína, gordura e carboidrato.
// Roda direto no Node. Uso: node tests/contas-nutricao.mjs (também roda no roteiro "nutricao").
import { readFileSync } from 'node:fs'
process.removeAllListeners('warning')
const nutrition = await import('../src/lib/nutrition.ts')

const results = []
const check = (name, condition, detail = '') => results.push(`${condition ? 'OK  ' : 'FAIL'} ${name}${condition || !detail ? '' : ` → ${detail}`}`)
const near = (a, b, tolerance = 1e-9) => Math.abs(a - b) <= tolerance

// ------------------------------------------------ dados da TACO (lidos do SQL que o dono roda)
const sql = readFileSync(new URL('../supabase/nutricao-taco.sql', import.meta.url), 'utf8')
const num = (text) => (text === 'null' ? null : Number(text))
const rowRe = /^ {2}\((\d+), '((?:[^']|'')*)', '((?:[^']|'')*)', (null|[\d.]+), (null|[\d.]+), (null|[\d.]+), (null|[\d.]+), (null|[\d.]+), (null|[\d.]+), (null|[\d.]+), '(\{.*\})'\),?$/
const foods = sql.split('\n').flatMap((line) => {
  const m = rowRe.exec(line)
  if (!m) return []
  return [{ n: Number(m[1]), name: m[2].replace(/''/g, "'"), group_name: m[3], kcal: num(m[4]), protein_g: num(m[5]), fat_g: num(m[6]), carb_g: num(m[7]), fiber_g: num(m[8]), sodium_mg: num(m[9]), cholesterol_mg: num(m[10]), micros: JSON.parse(m[11]) }]
})
const byName = (name) => foods.find((food) => food.name === name)

check('597 alimentos no arquivo', foods.length === 597, String(foods.length))
check('números de 1 a 597, sem repetir', new Set(foods.map((food) => food.n)).size === 597 && foods.every((food) => food.n >= 1 && food.n <= 597))
check('15 grupos da TACO', new Set(foods.map((food) => food.group_name)).size === 15, [...new Set(foods.map((food) => food.group_name))].join(' | '))
check('cita a fonte no cabeçalho do arquivo', /Tabela Brasileira de Composição de Alimentos \(TACO\)/.test(sql) && /NEPA\/UNICAMP/.test(sql))

const arroz = byName('Arroz, tipo 1, cozido')
check('arroz tipo 1 cozido: 128 kcal, 2,5 P, 0,2 G, 28,1 C, 1,6 fibra', arroz && arroz.kcal === 128 && arroz.protein_g === 2.5 && arroz.fat_g === 0.2 && arroz.carb_g === 28.1 && arroz.fiber_g === 1.6)
const arrozCru = byName('Arroz, tipo 1, cru')
check('cru e cozido são alimentos diferentes (cru ≈ 358 kcal, cozido ≈ 128)', arrozCru && arrozCru.kcal === 358 && arroz.kcal === 128)
const laranja = byName('Laranja, pêra, crua')
check('micros: laranja-pera tem 53,7 mg de vitamina C e 163 mg de potássio', laranja && laranja.micros.c_mg === 53.7 && laranja.micros.k_mg === 163)
const acerola = byName('Acerola, crua')
check('micros: acerola tem 941,4 mg de vitamina C', acerola && acerola.micros.c_mg === 941.4)
const salGrosso = byName('Sal, grosso')
check('sal grosso: sódio 39943 mg e energia 0 (NA = não aplicável, o sal não tem energia)', salGrosso && salGrosso.sodium_mg === 39943 && salGrosso.kcal === 0)
const oleo = byName('Óleo, de soja')
check('óleo de soja: 884 kcal, proteína 0 (NA) e gordura 100', oleo && oleo.kcal === 884 && oleo.protein_g === 0 && oleo.fat_g === 100)
check('frango: fibra 0 (NA, carne não tem fibra), não "sem dado"', byName('Frango, peito, sem pele, grelhado').fiber_g === 0)
check('arroz: colesterol 0 (NA, vegetal não tem colesterol)', byName('Arroz, integral, cozido').cholesterol_mg === 0)
check('traço (Tr) vira 0: sódio da banana-prata', byName('Banana, prata, crua').sodium_mg === 0)
const leite = byName('Leite, de vaca, integral')
check('leite integral: a TACO marca "*" (análises em reavaliação), então fica sem dado (null), não 0', leite && leite.kcal === null && leite.protein_g === null && leite.carb_g === null)
check('sem energia na TACO: só leite integral, leite desnatado, iogurte abacaxi e coco verde', JSON.stringify(foods.filter((item) => item.kcal === null).map((item) => item.n)) === '[450,457,458,591]')
check('vitamina A: nos vegetais (sem retinol pronto), RAE é metade do RE (cenoura, abóbora...)', (() => { const com = foods.filter((item) => item.micros.retinol_ug === 0 && item.micros.re_ug > 0 && item.micros.rae_ug !== undefined); return com.length > 40 && com.every((item) => Math.abs(item.micros.rae_ug - item.micros.re_ug / 2) <= 1) })())

// Vazios por nutriente: fixa o que a TACO deixou sem dado, para uma mudança futura não passar batida.
const nulls = Object.fromEntries(nutrition.NUTRIENTS.map((nutrient) => [nutrient, foods.filter((food) => food[nutrient] === null).length]))
console.log('vazios por nutriente:', JSON.stringify(nulls))
check('vazios por nutriente (esperado)', JSON.stringify(nulls) === JSON.stringify({ kcal: 4, protein_g: 5, fat_g: 5, carb_g: 5, fiber_g: 14, sodium_mg: 10, cholesterol_mg: 1 }), JSON.stringify(nulls))

// Energia ≈ 4×proteína + 9×gordura + 4×carboidrato (a fibra e o álcool explicam as exceções conhecidas).
const KNOWN = new Set([114, 474, 513, 539]) // coentro desidratado, cerveja pilsen 2, fermento químico, feijão tropeiro
const off = foods.filter((food) => [food.kcal, food.protein_g, food.fat_g, food.carb_g].every((value) => value !== null) && food.kcal > 0).filter((food) => {
  const estimate = 4 * food.protein_g + 9 * food.fat_g + 4 * food.carb_g
  return Math.abs(estimate - food.kcal) > Math.max(25, 0.15 * food.kcal)
})
check('energia coerente com os macros (só 4 exceções conhecidas)', off.length === 4 && off.every((food) => KNOWN.has(food.n)), off.map((food) => `${food.n} ${food.name}`).join('; '))

// ------------------------------------------------ contas
const food = (over = {}) => ({ id: 'x', name: 'Teste', group_name: null, kcal: 100, protein_g: 10, fat_g: 5, carb_g: 20, fiber_g: 2, sodium_mg: 50, cholesterol_mg: 0, ...over })
check('150 g de arroz cozido: 192 kcal e 4,2 g de carboidrato por 15 g', near(nutrition.nutrientIn(arroz, 'kcal', 150), 192) && near(nutrition.nutrientIn(arroz, 'carb_g', 15), 4.215))
check('alimento sem o dado devolve null (não zero)', nutrition.nutrientIn(food({ sodium_mg: null }), 'sodium_mg', 100) === null)
check('gramas negativas ou inválidas devolvem null', nutrition.nutrientIn(food(), 'kcal', -5) === null && nutrition.nutrientIn(food(), 'kcal', Number.NaN) === null)

const soma = nutrition.sumItems([{ food: food(), grams: 200 }, { food: food({ kcal: 50, sodium_mg: null }), grams: 100 }])
check('soma dos itens: 250 kcal, 30 g de proteína', near(soma.values.kcal, 250) && near(soma.values.protein_g, 30))
check('item sem sódio: entra em "incompleto" e não soma', soma.incomplete.length === 1 && soma.incomplete[0] === 'sodium_mg' && near(soma.values.sodium_mg, 100))
check('plano vazio: tudo 0 e nada incompleto', (() => { const t = nutrition.sumItems([]); return t.incomplete.length === 0 && nutrition.NUTRIENTS.every((nutrient) => t.values[nutrient] === 0) })())
check('leite sem energia na TACO: kcal fica incompleto', nutrition.sumItems([{ food: leite, grams: 200 }]).incomplete.includes('kcal'))
check('sal tem energia 0 de verdade: kcal não fica incompleto', !nutrition.sumItems([{ food: salGrosso, grams: 2 }]).incomplete.includes('kcal'))

check('formato: kcal inteira, gramas com uma casa, vírgula brasileira', nutrition.formatNutrient('kcal', 191.6) === '192' && nutrition.formatNutrient('protein_g', 4.26) === '4,3' && nutrition.formatNutrient('sodium_mg', 1234.4) === '1.234')

check('números digitados: vírgula e ponto valem; letras, "1e3", "0x10", negativo e vazio não', nutrition.parseAmount('12,5') === 12.5 && nutrition.parseAmount(' 150 ') === 150 && nutrition.parseAmount('12.5') === 12.5 && ['abc', '1e3', '0x10', '-5', '', '  ', '1,2,3', '12 g'].every((text) => nutrition.parseAmount(text) === null))

const nomes = foods.map((item) => ({ name: item.name, n: item.n }))
check('busca sem acento e sem maiúscula: "pao frances" acha "Pão, trigo, francês"', nutrition.searchFoods(nomes, 'pao frances').some((item) => /Pão, trigo, francês/.test(item.name)), JSON.stringify(nutrition.searchFoods(nomes, 'pao frances')))
check('busca: quem começa com o texto vem primeiro', nutrition.searchFoods(nomes, 'arroz')[0].name.startsWith('Arroz'))
check('busca: no máximo 30 resultados e texto vazio não devolve nada', nutrition.searchFoods(nomes, 'a').length === 30 && nutrition.searchFoods(nomes, '   ').length === 0)
check('busca por duas palavras: "arroz cozido" só traz arroz cozido', (() => { const r = nutrition.searchFoods(nomes, 'arroz cozido'); return r.length > 0 && r.every((item) => /arroz/i.test(item.name) && /cozido/i.test(item.name)) })())

console.log(results.join('\n'))
const failed = results.filter((line) => line.startsWith('FAIL')).length
console.log(`\n${results.length - failed} de ${results.length} verificações OK`)
if (failed > 0) process.exitCode = 1
