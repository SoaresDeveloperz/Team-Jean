import Link from 'next/link'
import { ClipboardList, UserPlus } from 'lucide-react'
import { WeeklyTrainingInsights } from '@/components/workout/WeeklyTrainingInsights'

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black uppercase tracking-wide">Painel</h1>
        <p className="text-xs font-medium text-zinc-500">Como seus alunos treinaram nesta semana</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/admin/workouts"
          className="flex items-center gap-2 rounded-2xl border border-zinc-900 bg-zinc-950 p-4 text-xs font-bold uppercase text-zinc-200 transition hover:border-zinc-700"
        >
          <ClipboardList className="h-4 w-4 text-emerald-400" aria-hidden="true" /> Prescrever treino
        </Link>
        <Link
          href="/admin/students"
          className="flex items-center gap-2 rounded-2xl border border-zinc-900 bg-zinc-950 p-4 text-xs font-bold uppercase text-zinc-200 transition hover:border-zinc-700"
        >
          <UserPlus className="h-4 w-4 text-emerald-400" aria-hidden="true" /> Novo aluno
        </Link>
      </div>

      <div className="rounded-3xl border border-zinc-900 bg-zinc-950/60 p-5">
        <WeeklyTrainingInsights mode="admin" />
      </div>
    </div>
  )
}
