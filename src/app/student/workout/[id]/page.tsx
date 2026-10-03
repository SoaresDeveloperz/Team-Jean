'use client'

import { useCallback, useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/client'
import { Check, ArrowLeft, Loader2, Info, AlertCircle } from 'lucide-react'
import { ExerciseMedia } from '../../../../components/workout/ExerciseMedia'

type Workout = {
  id: string
  name: string
}

type ExerciseDetails = {
  name?: string | null
  muscle_group?: string | null
  image_url?: string | null
  video_url?: string | null
}

type AssignedExercise = {
  id: string
  exercise_id: string
  sets_count?: number | null
  target_reps?: string | number | null
  target_rir?: string | number | null
  set_type?: string | null
  notes?: string | null
  exercises?: ExerciseDetails | null
}

type WorkoutSession = {
  id: string
}

type WorkoutSet = {
  set_number: number
  weight_kg: string
  reps: string
  rir: string | number
  set_type: string
  completed: boolean
}

type LastRecord = {
  weight_kg: number | null
  reps: number | null
}

export default function WorkoutExecutionPage() {
  const { id } = useParams()
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [assignedExercises, setAssignedExercises] = useState<AssignedExercise[]>([])
  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Armazena os registros de cada série digitada na tela
  // Estrutura: { [assigned_ex_id]: [ { set_num: 1, weight: 80, reps: 10, rir: 2, completed: true } ] }
  const [setsData, setSetsData] = useState<Record<string, WorkoutSet[]>>({})
  const [lastRecords, setLastRecords] = useState<Record<string, LastRecord>>({})

  // Modal de Finalização
  const [showFinishModal, setShowModal] = useState(false)
  const [sessionRpe, setSessionRpe] = useState(8)
  const [finishing, setFinishing] = useState(false)

  const initWorkoutSession = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoadError('Faça login para acessar este treino.')
      setLoading(false)
      return
    }

    // 1. Carrega dados do treino
    const { data: w, error: workoutError } = await supabase
      .from('assigned_workouts')
      .select('*')
      .eq('id', id)
      .eq('student_id', user.id)
      .single()

    if (workoutError || !w) {
      setLoadError('Este treino não está disponível para a sua conta.')
      setLoading(false)
      return
    }

    const { data: ex, error: exercisesError } = await supabase
      .from('assigned_workout_exercises')
      .select('*, exercises(*)')
      .eq('assigned_workout_id', id)
      .order('order', { ascending: true })

    if (exercisesError) {
      setLoadError(`Não foi possível carregar os exercícios: ${exercisesError.message}`)
      setLoading(false)
      return
    }

    const assignedExerciseRows = (ex ?? []) as AssignedExercise[]
    setWorkout(w as Workout)
    setAssignedExercises(assignedExerciseRows)

    // 2. Reutiliza a sessão em andamento para que atualizar a página não
    // descarte o progresso nem crie uma sessão duplicada.
    const { data: existingSession } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('assigned_workout_id', id)
      .eq('student_id', user.id)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let activeSession = existingSession as WorkoutSession | null
    if (!activeSession) {
      const { data: newSession, error: sessionError } = await supabase
        .from('workout_sessions')
        .insert([
          {
            assigned_workout_id: id,
            student_id: user.id,
            status: 'in_progress',
          },
        ])
        .select()
        .single()

      if (sessionError || !newSession) {
        setLoadError(`Não foi possível iniciar a sessão: ${sessionError?.message ?? 'erro desconhecido'}`)
        setLoading(false)
        return
      }
      activeSession = newSession as WorkoutSession
    }

    setSession(activeSession)

    // 3. Carrega as séries salvas na sessão atual.
    const { data: savedSets } = await supabase
      .from('session_sets')
      .select('*')
      .eq('session_id', activeSession.id)

    const savedByKey = new Map<string, {
      weight_kg: number | null
      reps: number | null
      rir: number | null
      set_type: string | null
      completed: boolean
    }>()
    for (const savedSet of savedSets ?? []) {
      savedByKey.set(
        `${savedSet.assigned_exercise_id}:${savedSet.set_number}`,
        savedSet,
      )
    }

    // 4. Monta a estrutura de séries e carrega o último registro histórico.
    const initialSets: Record<string, WorkoutSet[]> = {}
    const pastRecords: Record<string, LastRecord> = {}

    if (assignedExerciseRows.length > 0) {
      for (const item of assignedExerciseRows) {
        // Inicializa as séries do treino atual
        const setsArray = []
        const setCount = Math.max(1, Number(item.sets_count) || 1)
        for (let i = 1; i <= setCount; i++) {
          const savedSet = savedByKey.get(`${item.id}:${i}`)
          setsArray.push({
            set_number: i,
            weight_kg: savedSet?.weight_kg == null ? '' : String(savedSet.weight_kg),
            reps: savedSet?.reps == null ? '' : String(savedSet.reps),
            rir: savedSet?.rir == null ? item.target_rir || '' : String(savedSet.rir),
            set_type: savedSet?.set_type || item.set_type || 'normal',
            completed: Boolean(savedSet?.completed),
          })
        }
        initialSets[item.id] = setsArray

        // Busca o último registro de série desse exercício para o aluno
        const { data: pastSet } = await supabase
          .from('session_sets')
          .select('weight_kg, reps')
          .eq('exercise_id', item.exercise_id)
          .eq('completed', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (pastSet) {
          pastRecords[item.id] = pastSet
        }
      }
    }

    setSetsData(initialSets)
    setLastRecords(pastRecords)
    setLoading(false)
  }, [id, supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void initWorkoutSession()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [initWorkoutSession])

  // Atualiza um campo de uma série específica na memória e no banco
  const handleUpdateSet = (
    assignedExId: string,
    setIdx: number,
    field: keyof WorkoutSet,
    value: string | number | boolean,
  ) => {
    setSetsData((prev) => {
      const updatedExSets = [...(prev[assignedExId] || [])]
      updatedExSets[setIdx] = { ...updatedExSets[setIdx], [field]: value }
      return { ...prev, [assignedExId]: updatedExSets }
    })
  }

  // Alterna o estado de concluído de uma série
  const toggleCompleteSet = async (assignedExId: string, exerciseId: string, setIdx: number) => {
    const currentSet = setsData[assignedExId][setIdx]
    const newCompleted = !currentSet.completed

    handleUpdateSet(assignedExId, setIdx, 'completed', newCompleted)

    if (session) {
      const { error: deleteError } = await supabase
        .from('session_sets')
        .delete()
        .eq('session_id', session.id)
        .eq('assigned_exercise_id', assignedExId)
        .eq('set_number', currentSet.set_number)

      if (deleteError) {
        handleUpdateSet(assignedExId, setIdx, 'completed', currentSet.completed)
        return
      }

      if (newCompleted) {
        const { error: insertError } = await supabase.from('session_sets').insert([
          {
            session_id: session.id,
            exercise_id: exerciseId,
            assigned_exercise_id: assignedExId,
            set_number: currentSet.set_number,
            weight_kg: Number(currentSet.weight_kg) || 0,
            reps: Number(currentSet.reps) || 0,
            rir: currentSet.rir ? Number(currentSet.rir) : null,
            set_type: currentSet.set_type,
            completed: true,
          },
        ])

        if (insertError) {
          handleUpdateSet(assignedExId, setIdx, 'completed', currentSet.completed)
        }
      }
    }
  }

  // Finalizar a sessão completa
  const handleFinishWorkout = async () => {
    if (!session) return
    setFinishing(true)

    // Atualiza a sessão para concluída com o RPE final informado
    await supabase
      .from('workout_sessions')
      .update({
        completed_at: new Date().toISOString(),
        session_rpe: sessionRpe,
        status: 'completed',
      })
      .eq('id', session.id)

    setFinishing(false)
    router.push('/student/today')
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
        <Loader2 className="animate-spin w-8 h-8 text-white" />
        <p className="text-xs uppercase font-bold tracking-widest">Preparando treino...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <AlertCircle className="h-10 w-10 text-red-400" aria-hidden="true" />
        <p className="max-w-sm text-sm font-semibold text-zinc-300">{loadError}</p>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="rounded-xl border border-zinc-700 px-4 py-2 text-xs font-bold uppercase text-white"
        >
          Voltar ao dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Topo do Treino */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
        <button
          onClick={() => router.back()}
          className="p-2 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="font-black text-base uppercase tracking-wide truncate max-w-[200px]">
          {workout?.name}
        </h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-white text-black font-extrabold px-3 py-2 rounded-xl text-xs uppercase"
        >
          Concluir
        </button>
      </div>

      {/* Lista de Exercícios para Execução */}
      {assignedExercises.map((exItem) => {
        const last = lastRecords[exItem.id]
        const sets = setsData[exItem.id] || []

        return (
          <div key={exItem.id} className="bg-zinc-950 border border-zinc-900 rounded-3xl p-5 space-y-4">
            {/* Nome do Exercício + Carga Anterior */}
            <div className="flex items-start justify-between border-b border-zinc-900/80 pb-3">
              <div>
                <h3 className="font-black text-base text-white">{exItem.exercises?.name}</h3>
                <p className="text-xs font-bold uppercase text-zinc-500 mt-0.5">
                  {exItem.exercises?.muscle_group}
                </p>
              </div>

              {/* Indicador de Último Registro */}
              {last && (
                <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl text-right">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase block">Anterior</span>
                  <span className="text-xs font-extrabold text-emerald-400">
                    {last.weight_kg}kg × {last.reps}
                  </span>
                </div>
              )}
            </div>

            <ExerciseMedia
              muscleGroup={exItem.exercises?.muscle_group || 'Treino'}
              exerciseName={exItem.exercises?.name || 'Exercício'}
              imageUrl={exItem.exercises?.image_url}
            />

            {/* Observação do Treinador */}
            {exItem.notes && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                <p className="text-xs text-zinc-300 font-medium">{exItem.notes}</p>
              </div>
            )}

            {/* Tabela de Séries */}
            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-2 text-[10px] font-black uppercase text-zinc-500 text-center px-1">
                <span>Série</span>
                <span>Kg</span>
                <span>Reps</span>
                <span>RIR</span>
                <span>✓</span>
              </div>

              {sets.map((s, idx) => (
                <div
                  key={idx}
                  className={`grid grid-cols-5 gap-2 items-center p-2 rounded-2xl border transition-all ${
                    s.completed
                      ? 'bg-emerald-950/20 border-emerald-800/40'
                      : 'bg-zinc-900/80 border-zinc-800/60'
                  }`}
                >
                  <span className="text-xs font-black text-center text-zinc-400">#{s.set_number}</span>

                  <input
                    type="number"
                    value={s.weight_kg}
                    onChange={(e) => handleUpdateSet(exItem.id, idx, 'weight_kg', e.target.value)}
                    placeholder="0"
                    className="bg-black border border-zinc-800 rounded-xl p-2 text-center text-sm font-extrabold text-white focus:outline-none focus:border-white"
                  />

                  <input
                    type="number"
                    value={s.reps}
                    onChange={(e) => handleUpdateSet(exItem.id, idx, 'reps', e.target.value)}
                    placeholder={String(exItem.target_reps ?? '0')}
                    className="bg-black border border-zinc-800 rounded-xl p-2 text-center text-sm font-extrabold text-white focus:outline-none focus:border-white"
                  />

                  <input
                    type="number"
                    value={s.rir}
                    onChange={(e) => handleUpdateSet(exItem.id, idx, 'rir', e.target.value)}
                    placeholder="RIR"
                    className="bg-black border border-zinc-800 rounded-xl p-2 text-center text-sm font-medium text-zinc-400 focus:outline-none focus:border-white"
                  />

                  <button
                    onClick={() => toggleCompleteSet(exItem.id, exItem.exercise_id, idx)}
                    className={`w-full h-9 rounded-xl flex items-center justify-center transition-all ${
                      s.completed ? 'bg-emerald-500 text-black font-bold' : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    <Check className="w-5 h-5 stroke-[3]" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Modal Finalizar Treino (Esforço RPE) */}
      {showFinishModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-black uppercase">Finalizar Treino</h2>
              <p className="text-xs text-zinc-400 font-medium">
                Qual foi o Esforço Percebido (RPE) da sessão?
              </p>
            </div>

            {/* Selector de RPE (1 a 10) */}
            <div className="space-y-3 text-center">
              <span className="text-4xl font-black text-white">{sessionRpe} / 10</span>
              <input
                type="range"
                min="1"
                max="10"
                value={sessionRpe}
                onChange={(e) => setSessionRpe(Number(e.target.value))}
                className="w-full accent-white"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase">
                <span>1 - Leve</span>
                <span>5 - Moderado</span>
                <span>10 - Máximo</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="w-1/2 bg-zinc-900 text-zinc-400 font-bold p-4 rounded-xl text-xs uppercase"
              >
                Voltar
              </button>
              <button
                onClick={handleFinishWorkout}
                disabled={finishing}
                className="w-1/2 bg-white text-black font-extrabold p-4 rounded-xl text-xs uppercase flex items-center justify-center"
              >
                {finishing ? <Loader2 className="animate-spin w-5 h-5" /> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}