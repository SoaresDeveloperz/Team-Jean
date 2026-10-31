// Contas puras do plano da semana (src/lib/week-plan.ts): semana que começa na
// segunda, reinício na virada, dia marcado, ordem e descanso. Roda direto no Node.
// Uso: node tests/contas-semana.mjs (também roda no roteiro "rotina").
process.removeAllListeners('warning')
const plan = await import('../src/lib/week-plan.ts')

const results = []
const check = (name, condition, detail = '') => results.push(`${condition ? 'OK  ' : 'FAIL'} ${name}${condition || !detail ? '' : ` → ${detail}`}`)

// 2026-10-26 é segunda-feira.
const at = (day, hour = 12) => new Date(2026, 9, 26 + day, hour, 0, 0)
const MON = 0, TUE = 1, WED = 2, THU = 3, FRI = 4, SAT = 5, SUN = 6
const done = (...entries) => new Map(entries.map(([id, day]) => [id, at(day, 9).toISOString()]))
const w = (id, name, weekday = null, position = null) => ({ id, name, weekday, position })
const A = w('a', 'Treino A'), B = w('b', 'Treino B'), C = w('c', 'Treino C')

// ------------------------------------------------ semana e "feito nesta semana"
check('a semana começa na segunda 00:00 (quarta → segunda)', plan.weekStart(at(WED)).getDay() === 1 && plan.weekStart(at(WED)).getDate() === 26)
check('domingo ainda é da semana que começou na segunda anterior', plan.weekStart(at(SUN)).getDate() === 26)
check('treino de ontem conta como feito nesta semana', plan.doneThisWeek(at(TUE, 9).toISOString(), at(WED)))
check('treino do domingo passado não conta (virada na segunda)', !plan.doneThisWeek(at(-1, 20).toISOString(), at(MON, 8)))
check('sem data ou data inválida: não feito', !plan.doneThisWeek(undefined, at(WED)) && !plan.doneThisWeek('xx', at(WED)))

check('conclusão com data um pouco no futuro (relógio mudado) ainda conta na semana', plan.doneThisWeek(at(WED, 18).toISOString(), at(WED, 12)))
check('conclusão da semana que vem não conta nesta', !plan.doneThisWeek(at(MON + 7, 9).toISOString(), at(WED)))

// ------------------------------------------------ ordem
check('sem posição, a ordem é a do nome', plan.orderWorkouts([C, A, B]).map((x) => x.id).join('') === 'abc')
check('com posição, vale a do treinador (nulos por último)', plan.orderWorkouts([w('a', 'Treino A', null, 2), w('b', 'Treino B', null, 1), w('c', 'Treino C')]).map((x) => x.id).join('') === 'bac')
check('"Treino 10" vem depois de "Treino 2"', plan.orderWorkouts([w('x', 'Treino 10'), w('y', 'Treino 2')]).map((x) => x.id).join('') === 'yx')

// ------------------------------------------------ sem dias marcados: rotação com reinício semanal
check('semana nova: começa pelo primeiro (A)', plan.planWeek([A, B, C], new Map(), at(MON))?.workout.id === 'a')
check('fez A e B: vem o C', plan.planWeek([A, B, C], done(['a', MON], ['b', TUE]), at(WED))?.workout.id === 'c')
check('não fez o C na semana passada: na segunda volta ao A (não ao C)', plan.planWeek([A, B, C], done(['a', -7], ['b', -6]), at(MON, 8))?.workout.id === 'a')
check('fez só o B (pulou o A): sugere o A (primeiro da ordem ainda não feito)', plan.planWeek([A, B, C], done(['b', MON]), at(TUE))?.workout.id === 'a')
const allDone = plan.planWeek([A, B], done(['a', MON], ['b', TUE]), at(WED))
check('tudo feito na semana: "week-done" e deixa repetir o primeiro', allDone?.kind === 'week-done' && allDone.workout.id === 'a')
check('ordem do treinador manda na rotação', plan.planWeek([w('a', 'Treino A', null, 2), w('b', 'Treino B', null, 1)], new Map(), at(MON))?.workout.id === 'b')

// ------------------------------------------------ em andamento
check('o treino em andamento vem sempre primeiro', plan.planWeek([A, B], done(['a', MON]), at(WED), 'a')?.kind === 'in-progress')
check('em andamento que não existe mais é ignorado', plan.planWeek([A, B], new Map(), at(WED), 'zzz')?.kind === 'next')
check('sem treinos: null', plan.planWeek([], new Map(), at(WED)) === null)

// ------------------------------------------------ dia marcado
const SEG = w('seg', 'Treino A', 1), QUA = w('qua', 'Treino B', 3), SEX = w('sex', 'Treino C', 5)
check('no dia marcado: treino de hoje', plan.planWeek([SEG, QUA, SEX], new Map(), at(WED))?.kind === 'today' && plan.planWeek([SEG, QUA, SEX], new Map(), at(WED))?.workout.id === 'qua')
const rest = plan.planWeek([SEG, QUA, SEX], done(['seg', MON]), at(TUE))
check('dia sem treino marcado: descanso e sugere o próximo dia (quarta)', rest?.kind === 'rest' && rest.suggestion.id === 'qua')
const restFri = plan.planWeek([SEG, QUA, SEX], done(['seg', MON], ['qua', WED]), at(THU))
check('quinta, A e B feitos: sugere a sexta', restFri?.kind === 'rest' && restFri.suggestion.id === 'sex')
const missedMon = plan.planWeek([SEG, QUA, SEX], new Map(), at(TUE))
check('perdeu a segunda: terça é descanso e sugere a quarta, não a segunda', missedMon?.kind === 'rest' && missedMon.suggestion.id === 'qua')
const onlyMissed = plan.planWeek([SEG, QUA, SEX], done(['qua', WED], ['sex', FRI]), at(SAT))
check('sábado só com a segunda pendente: sugere a segunda ("ainda dá tempo")', onlyMissed?.kind === 'rest' && onlyMissed.suggestion.id === 'seg')
check('na segunda seguinte a semana recomeça (hoje = treino de segunda)', plan.planWeek([SEG, QUA, SEX], done(['seg', MON], ['qua', WED], ['sex', FRI]), at(MON + 7, 8))?.kind === 'today')
const todayDone = plan.planWeek([SEG, QUA, SEX], done(['seg', MON]), at(MON, 20))
check('treino de hoje já feito: descanso com "doneToday"', todayDone?.kind === 'rest' && todayDone.doneToday === true)
check('todos feitos com dias marcados: week-done', plan.planWeek([SEG, QUA], done(['seg', MON], ['qua', WED]), at(THU))?.kind === 'week-done')
const mixed = plan.planWeek([SEG, w('livre', 'Treino L')], done(['seg', MON]), at(TUE))
check('treino sem dia convive: em dia sem treino marcado sugere o sem dia', mixed?.kind === 'rest' && mixed.suggestion.id === 'livre')
check('dois treinos no mesmo dia: o primeiro da ordem, depois o outro', plan.planWeek([w('x', 'Treino X', 1, 1), w('y', 'Treino Y', 1, 2)], new Map(), at(MON))?.workout.id === 'x' && plan.planWeek([w('x', 'Treino X', 1, 1), w('y', 'Treino Y', 1, 2)], done(['x', MON]), at(MON, 15))?.workout.id === 'y')
check('weekday inválido (7) é tratado como sem dia', plan.planWeek([w('a', 'A', 7)], new Map(), at(MON))?.kind === 'next')

// ------------------------------------------------ id novo, nome igual; fila do aparelho
const refeito = w('novo-a', 'Treino A')
const byName = plan.buildLastDone([{ workoutId: 'velho-a', completedAt: at(MON, 9).toISOString(), workoutName: 'treino  a ' }])
check('o treinador refez o "Treino A" (id novo): a segunda continua valendo (por nome)', plan.planWeek([refeito, B], byName, at(WED))?.workout.id === 'b')
check('nome com acento/maiúscula/espaço extra também casa', plan.completionOf(w('x', 'Tréino   Ç'), plan.buildLastDone([{ workoutId: 'q', completedAt: at(MON, 9).toISOString(), workoutName: 'treino c' }])) !== undefined && plan.completionOf(w('x', 'Perna Útil'), plan.buildLastDone([{ workoutId: 'q', completedAt: at(MON, 9).toISOString(), workoutName: 'perna util' }])) !== undefined)
const merged = plan.buildLastDone([
  { workoutId: 'a', completedAt: at(MON, 9).toISOString(), workoutName: 'Treino A' },
  { workoutId: 'b', completedAt: at(TUE, 9).toISOString(), workoutName: 'Treino B' }, // veio da fila do aparelho
])
check('treino concluído só na fila do aparelho conta como feito na semana', plan.planWeek([A, B, C], merged, at(WED))?.workout.id === 'c')
check('vale a conclusão mais recente de cada treino', plan.buildLastDone([{ workoutId: 'a', completedAt: at(MON, 9).toISOString() }, { workoutId: 'a', completedAt: at(TUE, 9).toISOString() }]).get('a') === at(TUE, 9).toISOString())
check('domingo 23:59 e segunda 00:01 são semanas diferentes', plan.doneThisWeek(new Date(2026, 9, 25, 23, 59).toISOString(), new Date(2026, 9, 26, 0, 1)) === false && plan.doneThisWeek(new Date(2026, 9, 26, 0, 0).toISOString(), new Date(2026, 9, 26, 0, 1)) === true)

// ------------------------------------------------ descanso rotativo (os dias andam 1 por semana)
const weekN = plan.weekNumber(at(WED))
const rot = (id, name, weekday) => ({ id, name, weekday, rotate_days: true })
const shift = weekN % 7
check('o número da semana anda 1 por semana', plan.weekNumber(at(WED + 7)) === weekN + 1 && plan.weekNumber(at(MON)) === weekN && plan.weekNumber(at(SUN)) === weekN)
check('semana 0 é a de 01/01/2024 (segunda); 08/01 é a 1; 30/12/2024 é a 52', plan.weekNumber(new Date(2024, 0, 1, 10)) === 0 && plan.weekNumber(new Date(2024, 0, 7, 22)) === 0 && plan.weekNumber(new Date(2024, 0, 8, 1)) === 1 && plan.weekNumber(new Date(2024, 11, 30, 12)) === 52)
check('antes da âncora a semana é negativa e o dia nunca sai de 0 a 6', plan.weekNumber(new Date(2023, 11, 25, 12)) === -1 && [0, 1, 2, 3, 4, 5, 6].every((d) => { const x = plan.weekdayThisWeek(rot('r', 'R', d), new Date(2023, 11, 25, 12)); return x >= 0 && x <= 6 }))
check('29/02 e a virada de domingo para segunda não bagunçam a semana', plan.weekNumber(new Date(2024, 1, 29, 12)) === 8 && plan.weekNumber(new Date(2024, 2, 3, 23, 59)) === 8 && plan.weekNumber(new Date(2024, 2, 4, 0, 1)) === 9)
check('sem rotativo o dia não muda', plan.weekdayThisWeek(SEG, at(WED)) === 1 && plan.weekdayThisWeek(SEG, at(WED + 35)) === 1)
check('com rotativo o dia anda um por semana (e volta em 7)', plan.weekdayThisWeek(rot('r', 'R', 1), at(WED)) === (1 + shift) % 7 && plan.weekdayThisWeek(rot('r', 'R', 1), at(WED + 7)) === (1 + shift + 1) % 7 && plan.weekdayThisWeek(rot('r', 'R', 1), at(WED + 49)) === (1 + shift) % 7)
check('rotativo sem dia fixo continua sem dia', plan.weekdayThisWeek(rot('r', 'R', null), at(WED)) === null)
// Treino marcado para a segunda que, nesta semana, cai no dia de hoje: vira "hoje".
const hojeDia = at(WED).getDay()
const diaBase = (hojeDia - shift + 7 * 8) % 7
check('rotativo: o treino cujo dia andou até hoje é o treino de hoje', plan.planWeek([rot('r', 'Treino R', diaBase)], new Map(), at(WED))?.kind === 'today')
check('rotativo: o mesmo treino, uma semana depois, já não cai em "hoje"', plan.planWeek([rot('r', 'Treino R', diaBase)], new Map(), at(WED + 7))?.kind === 'rest')
check('rotativo: a lista mostra o estado do dia desta semana', plan.workoutWeekState(rot('r', 'Treino R', diaBase), new Map(), at(WED)) === 'today')

// ------------------------------------------------ estado na lista
check('estado: feito', plan.workoutWeekState(SEG, done(['seg', MON]), at(WED), ) === 'done')
check('estado: hoje', plan.workoutWeekState(QUA, new Map(), at(WED)) === 'today')
check('estado: dia que passou sem fazer = "missed" (nunca chamado de atrasado na tela)', plan.workoutWeekState(SEG, new Map(), at(WED)) === 'missed')
check('estado: dia que vem = pending', plan.workoutWeekState(SEX, new Map(), at(WED)) === 'pending')
check('estado: sem dia = pending', plan.workoutWeekState(A, new Map(), at(WED)) === 'pending')

console.log(results.join('\n'))
const failed = results.filter((line) => line.startsWith('FAIL')).length
console.log(`\n${results.length - failed} de ${results.length} verificações OK`)
if (failed > 0) process.exitCode = 1
