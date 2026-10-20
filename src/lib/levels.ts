// Níveis do atleta pelo total de treinos concluídos. Aparecem no Perfil e ao
// lado do nome na Comunidade.
export type Level = { level: number; name: string; min: number }

export const LEVELS: Level[] = [
  { level: 1, name: 'Novato', min: 0 },
  { level: 2, name: 'Focado', min: 5 },
  { level: 3, name: 'Constante', min: 15 },
  { level: 4, name: 'Atleta', min: 30 },
  { level: 5, name: 'Elite', min: 60 },
  { level: 6, name: 'Lenda', min: 100 },
]

export function levelFor(workouts: number) {
  const total = Math.max(0, Math.floor(Number(workouts) || 0))
  let index = 0
  for (let position = 0; position < LEVELS.length; position += 1) {
    if (total >= LEVELS[position].min) index = position
  }
  const current = LEVELS[index]
  const next = LEVELS[index + 1] ?? null
  return {
    ...current,
    total,
    next,
    // Progresso até o próximo nível (1 no último).
    progress: next ? (total - current.min) / (next.min - current.min) : 1,
    remaining: next ? next.min - total : 0,
  }
}

// Cor do selo: cinza no começo, esmeralda no meio, dourado no topo.
export function levelTone(level: number) {
  if (level >= 5) return 'gold' as const
  if (level >= 3) return 'brand' as const
  return 'zinc' as const
}
