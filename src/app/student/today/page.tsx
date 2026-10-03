'use client'

import { useCallback, useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Play, Dumbbell, Loader2 } from 'lucide-react'
import { ExerciseMedia } from '../../../components/workout/ExerciseMedia'

type AssignedExercise = {
  id: string
  sets_count?: number | null
  target_reps?: string | number | null
  set_type?: string | null
  exercises?: {
    name?: string | null
    muscle_group?: string | null
    image_url?: string | null
    video_url?: string | null
  } | null
}

type StudentWorkout = {
  id: string
  name: string
}

export default function StudentTodayPage() {
  const [workout, setWorkout] = useState<StudentWorkout | null>(null)
  const [exercises, setExercises] = useState<AssignedExercise[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const loadTodayWorkout = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    // Busca o treino ativo atual do aluno
    const { data: w } = await supabase
      .from('assigned_workouts')
      .select('*')
      .eq('student_id', user.id)
      .eq('is_current', true)
      .limit(1)
      .single()

    if (w) {
      setWorkout(w)
      // Busca os exercícios desse treino
      const { data: ex } = await supabase
        .from('assigned_workout_exercises')
        .select('*, exercises(*)')
        .eq('assigned_workout_id', w.id)
        .order('order', { ascending: true })

      if (ex) setExercises(ex)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTodayWorkout()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadTodayWorkout])

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-zinc-500">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="space-y-6 pt-6">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wide">Treino de Hoje</h1>
          <p className="text-xs text-zinc-500 font-medium">Bora pra cima!</p>
        </div>
        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center space-y-3">
          <Dumbbell className="w-12 h-12 text-zinc-800 mx-auto" />
          <h3 className="font-bold text-base text-zinc-300">Nenhum treino atribuído para hoje</h3>
          <p className="text-xs text-zinc-600">
            Aproveite para descansar ou fale com o treinador Jean para lançar seu treino.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">SEU TREINO ATIVO</p>
        <h1 className="text-2xl font-black uppercase tracking-wide mt-1">{workout.name}</h1>
      </div>

      {/* Botão de Iniciar Treino */}
      <button
        onClick={() => router.push(`/student/workout/${workout.id}`)}
        className="w-full bg-white text-black font-black text-sm uppercase py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
      >
        <Play className="w-5 h-5 fill-black" /> INICIAR TREINO
      </button>

      {/* Preview da Lista de Exercícios */}
      <div className="space-y-3">
        <h2 className="text-xs font-extrabold uppercase text-zinc-400 tracking-wider">
          Exercícios ({exercises.length})
        </h2>

        {exercises.map((item, idx) => (
          <div
            key={item.id}
            className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950"
          >
            <ExerciseMedia
              muscleGroup={item.exercises?.muscle_group || 'Treino'}
            />
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-5 text-xs font-black text-zinc-600">#{idx + 1}</span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-white">{item.exercises?.name}</h3>
                  <p className="text-xs text-zinc-500">
                    {item.exercises?.muscle_group} · {item.sets_count} séries × {item.target_reps} reps
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[10px] font-bold uppercase text-zinc-400">
                {item.set_type || 'Normal'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}