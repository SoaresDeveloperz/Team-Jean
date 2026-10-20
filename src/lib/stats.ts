// Cálculos de calendário e consistência a partir das datas de conclusão dos
// treinos (workout_sessions.completed_at). Semanas começam na segunda-feira.

export function startOfDay(date: Date) {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day
}

export function startOfWeek(date: Date) {
  const day = startOfDay(date)
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7))
  return day
}

export function isSameDay(first: Date, second: Date) {
  return startOfDay(first).getTime() === startOfDay(second).getTime()
}

function weekKey(date: Date) {
  return startOfWeek(date).getTime()
}

// Semanas seguidas com pelo menos um treino. A semana atual só quebra a
// sequência quando termina: se ainda não treinou, conta a partir da passada.
export function weekStreak(dates: Date[], now = new Date()) {
  const weeks = new Set(dates.map(weekKey))
  const cursor = startOfWeek(now)
  if (!weeks.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 7)

  let streak = 0
  while (weeks.has(cursor.getTime())) {
    streak += 1
    cursor.setDate(cursor.getDate() - 7)
  }
  return streak
}

// Segunda a domingo da semana atual: quantos treinos em cada dia.
export function weekDayCounts(dates: Date[], now = new Date()) {
  const start = startOfWeek(now).getTime()
  const counts = [0, 0, 0, 0, 0, 0, 0]
  for (const date of dates) {
    const index = Math.floor((startOfDay(date).getTime() - start) / 86_400_000)
    if (index >= 0 && index < 7) counts[index] += 1
  }
  return counts
}

export function countInWeek(dates: Date[], now = new Date()) {
  return weekDayCounts(dates, now).reduce((total, count) => total + count, 0)
}

export function countInMonth(dates: Date[], now = new Date()) {
  return dates.filter((date) => date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()).length
}

export const WEEKDAY_INITIALS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
export const WEEKDAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

export function relativeDay(date: Date, now = new Date()) {
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000)
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'ontem'
  if (diff < 7) return `há ${diff} dias`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// Maior sequência de semanas seguidas com treino em todo o histórico.
export function bestWeekStreak(dates: Date[]) {
  const weeks = [...new Set(dates.map((date) => startOfWeek(date).getTime()))].sort((first, second) => first - second)
  let best = 0
  let run = 0
  let previous: number | null = null
  for (const week of weeks) {
    // Arredonda para tolerar a hora a mais/menos do horário de verão.
    run = previous !== null && Math.round((week - previous) / (7 * 86_400_000)) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    previous = week
  }
  return best
}
