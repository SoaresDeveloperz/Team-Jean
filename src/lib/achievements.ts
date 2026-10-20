import { bestWeekStreak } from './stats'

// Ícones por nome (e não o componente) para a conquista poder ser salva num
// post da comunidade e desenhada de novo em qualquer tela.
export type AchievementIconKey =
  | 'footprints'
  | 'flame'
  | 'medal'
  | 'award'
  | 'crown'
  | 'trophy'
  | 'calendar'
  | 'sunrise'
  | 'star'

export type Achievement = {
  title: string
  description: string
  icon: AchievementIconKey
  value: number
  goal: number
}

export function buildAchievements(total: number, dates: Date[]): Achievement[] {
  const early = dates.filter((date) => date.getHours() < 8).length
  const weekend = dates.filter((date) => date.getDay() === 0 || date.getDay() === 6).length
  return [
    { title: 'Primeiro passo', description: 'Concluir o primeiro treino no app.', icon: 'footprints', value: total, goal: 1 },
    { title: 'Ritmo forte', description: 'Concluir 5 treinos.', icon: 'flame', value: total, goal: 5 },
    { title: 'Elite', description: 'Concluir 10 treinos.', icon: 'medal', value: total, goal: 10 },
    { title: 'Lenda do foco', description: 'Concluir 25 treinos.', icon: 'award', value: total, goal: 25 },
    { title: 'Meio século', description: 'Concluir 50 treinos.', icon: 'crown', value: total, goal: 50 },
    { title: 'Centurião', description: 'Concluir 100 treinos.', icon: 'trophy', value: total, goal: 100 },
    {
      title: 'Constância',
      description: 'Treinar 4 semanas seguidas, sem pular nenhuma.',
      icon: 'calendar',
      value: bestWeekStreak(dates),
      goal: 4,
    },
    { title: 'Madrugador', description: 'Concluir um treino antes das 8h.', icon: 'sunrise', value: early, goal: 1 },
    { title: 'Fim de semana', description: 'Concluir 4 treinos em sábados ou domingos.', icon: 'star', value: weekend, goal: 4 },
  ]
}
