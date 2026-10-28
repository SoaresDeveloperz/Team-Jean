'use client'

import { m } from 'framer-motion'
import { Crown, Trophy } from 'lucide-react'
import { isAdminRole, type CommunityMember } from '@/lib/community'
import { avatarUrlOf } from '@/lib/profile'
import { startOfWeek } from '@/lib/stats'
import { plural } from '@/lib/text'
import { cn } from '@/lib/cn'
import { Avatar } from '@/components/ui/avatar'
import { Eyebrow, Tile } from '@/components/ui/tile'

// Ordem no DOM é 1º, 2º, 3º (leitores de tela); na tela fica 2º, 1º, 3º.
const PODIUM = [
  { place: 1, order: 'order-2', height: 'h-20', medal: 'bg-gold text-black', ring: 'ring-gold' },
  { place: 2, order: 'order-1', height: 'h-14', medal: 'bg-zinc-300 text-black', ring: 'ring-zinc-300' },
  { place: 3, order: 'order-3', height: 'h-10', medal: 'bg-amber-600 text-black', ring: 'ring-amber-600' },
]

function weekLabel() {
  const start = startOfWeek(new Date())
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const month = (date: Date) => date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} a ${end.getDate()} de ${month(end)}`
    : `${start.getDate()} de ${month(start)} a ${end.getDate()} de ${month(end)}`
}

export function LeaderboardCard({
  members,
  viewerId,
  viewerIsAdmin,
}: {
  members: CommunityMember[]
  viewerId: string | null
  viewerIsAdmin: boolean
}) {
  const students = members.filter((member) => !isAdminRole(member.role))
  const ranked = [...students].sort(
    (a, b) =>
      b.week_workouts - a.week_workouts ||
      b.total_workouts - a.total_workouts ||
      a.full_name.localeCompare(b.full_name, 'pt-BR'),
  )
  const podium = ranked.filter((member) => member.week_workouts > 0).slice(0, 3)
  const myIndex = viewerId ? ranked.findIndex((member) => member.id === viewerId) : -1
  const me = myIndex >= 0 ? ranked[myIndex] : null
  const activeCount = students.filter((member) => member.week_workouts > 0).length

  let footer = ''
  if (viewerIsAdmin)
    footer = `${activeCount} de ${students.length} ${students.length === 1 ? 'aluno treinou' : 'alunos treinaram'} esta semana`
  else if (me && me.week_workouts > 0)
    // Só quem está no pódio vê a posição: quem treinou menos não é exposto.
    footer =
      myIndex < 3
        ? `Você está em ${myIndex + 1}º lugar · ${plural(me.week_workouts, 'treino', 'treinos')} na semana`
        : `${plural(me.week_workouts, 'treino', 'treinos')} na semana. Continue assim!`
  else footer = 'Sua semana começa com um treino. Que tal o de hoje?'

  return (
    <Tile className="p-4" aria-labelledby="leaderboard-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="leaderboard-title">
          <Eyebrow icon={Trophy} className="text-gold/90">
            Ranking da semana
          </Eyebrow>
        </h2>
        <span className="text-xs font-semibold text-zinc-500">{weekLabel()}</span>
      </div>

      {podium.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-400">Ninguém treinou ainda esta semana. Que tal ser o primeiro? 🔥</p>
      ) : (
        <ol className="mt-4 grid grid-cols-3 items-end gap-2">
          {PODIUM.map((slot, index) => {
            const member = podium[index]
            if (!member) {
              // Lugar vago: o pódio mantém o 1º no centro e convida a subir.
              return (
                <li key={slot.place} className={cn('flex min-w-0 flex-col items-center', slot.order)}>
                  <span className="mb-1 h-5" aria-hidden="true" />
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid place-items-center rounded-2xl border border-dashed border-line-strong font-display text-lg font-bold text-zinc-500',
                      slot.place === 1 ? 'h-14 w-14' : 'h-11 w-11',
                    )}
                  >
                    ?
                  </span>
                  <span className="mt-2 text-xs font-bold text-zinc-400">
                    <span className="sr-only">{slot.place}º lugar: </span>Vaga
                  </span>
                  <span className="text-xs text-zinc-500">em aberto</span>
                  <div
                    aria-hidden="true"
                    className={cn('mt-2 grid w-full place-items-start justify-center rounded-t-2xl bg-white/[0.03] pt-1.5', slot.height)}
                  >
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 font-display text-sm font-bold text-zinc-400">
                      {slot.place}
                    </span>
                  </div>
                </li>
              )
            }
            const firstName = member.full_name.split(' ')[0]
            return (
              <li key={member.id} className={cn('flex min-w-0 flex-col items-center', slot.order)}>
                {slot.place === 1 ? (
                  <Crown className="mb-1 h-5 w-5 text-gold" aria-hidden="true" />
                ) : (
                  <span className="mb-1 h-5" aria-hidden="true" />
                )}
                <Avatar
                  name={member.full_name}
                  seed={member.id}
                  src={avatarUrlOf(member)}
                  size={slot.place === 1 ? 'lg' : 'md'}
                  className={cn('ring-2 ring-offset-2 ring-offset-surface', slot.ring)}
                />
                <span className="mt-2 max-w-full truncate text-xs font-bold text-white">
                  <span className="sr-only">{slot.place}º lugar: </span>
                  {firstName}
                  {member.id === viewerId && <span className="text-brand"> (você)</span>}
                </span>
                <span className="text-xs text-zinc-400">{plural(member.week_workouts, 'treino', 'treinos')}</span>
                <m.div
                  aria-hidden="true"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 22, delay: 0.1 + index * 0.08 }}
                  className={cn(
                    'mt-2 grid w-full origin-bottom place-items-start justify-center rounded-t-2xl bg-white/[0.06] pt-1.5',
                    slot.height,
                  )}
                >
                  <span className={cn('grid h-6 w-6 place-items-center rounded-full font-display text-sm font-bold', slot.medal)}>
                    {slot.place}
                  </span>
                </m.div>
              </li>
            )
          })}
        </ol>
      )}

      <p className="mt-3 border-t border-line pt-3 text-center text-xs font-semibold text-zinc-400">{footer}</p>
    </Tile>
  )
}
