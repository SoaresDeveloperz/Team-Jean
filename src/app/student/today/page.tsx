'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import { Play, Dumbbell, Loader2, Calendar } from 'lucide-react'

export default function StudentTodayPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [workout, setWorkout] = useState<any>(null)
  const [exercises, setExercises] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: p } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
    setProfile(p)

    const { data: w } = await supabase
      .from('assigned_workouts')
      .select('*')
      .eq('student_id', user.id)
      .eq('is_current', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (w) {
      setWorkout(w)
      const { data: ex } = await supabase
        .from('assigned_workout_exercises')
        .select('*, exercises(name, muscle_group)')
        .eq('assigned_workout_id', w.id)
        .order('order', { ascending: true })
      setExercises(ex || [])
    }

    setLoading(false)
  }

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Saudação */}
      <div>
        <h1 className="text-2xl font-black text-white">
          Fala, {profile?.full_name?.split(' ')[0] || 'Atleta'} 💪
        </h1>
        <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          {today}
        </p>
      </div>

      {!workout ? (
        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <Dumbbell className="w-7 h-7 text-zinc-600" />
          </div>
          <h2 className="text-lg font-black uppercase">Dia de descanso</h2>
          <p className="text-xs text-zinc-500">
            Nenhum treino ativo no momento. Quando o Jean lançar, aparece aqui.
          </p>
        </div>
      ) : (
        <>
          {/* Card principal do treino */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">
                Treino de hoje
              </p>
              <h2 className="text-2xl font-black uppercase text-white leading-tight">
                {workout.name}
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                {exercises.length} exercícios prescritos
              </p>
            </div>

            <button
              onClick={() => router.push(`/student/workout/${workout.id}`)}
              className="w-full h-14 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <Play className="w-5 h-5 fill-black" />
              Iniciar treino
            </button>
          </div>

          {/* Lista limpa dos exercícios */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-1">
              Visão geral
            </p>

            {exercises.map((item, index) => {
              const setsCount = Array.isArray(item.planned_sets)
                ? item.planned_sets.length
                : item.sets_count || 0

              return (
                <div
                  key={item.id}
                  className="bg-zinc-950 border border-zinc-900 rounded-2xl px-4 py-3.5 flex items-center gap-3"
                >
                  <span className="w-6 text-xs font-black text-zinc-600">
                    {index + 1}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                    <Dumbbell className="w-4 h-4 text-zinc-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold text-white truncate">
                      {item.exercises?.name || 'Exercício'}
                    </p>
                    <p className="text-[11px] text-zinc-500 font-semibold uppercase">
                      {setsCount} séries · {item.exercises?.muscle_group || '—'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
