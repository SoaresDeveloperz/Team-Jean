'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/client'
import { Check, ArrowLeft, Loader2, Info } from 'lucide-react'

export default function WorkoutExecutionPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [workout, setWorkout] = useState<any>(null)
  const [assignedExercises, setAssignedExercises] = useState<any[]>([])
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [setsData, setSetsData] = useState<Record<string, any[]>>({})
  const [lastRecords, setLastRecords] = useState<Record<string, any>>({})
  const [showFinishModal, setShowModal] = useState(false)
  const [sessionRpe, setSessionRpe] = useState(8)
  const [finishing, setFinishing] = useState(false)

  useEffect(() => {
    initWorkoutSession()
  }, [])

  const initWorkoutSession = async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: w } = await supabase
      .from('assigned_workouts')
      .select('*')
      .eq('id', id)
      .single()
    const { data: ex } = await supabase
      .from('assigned_workout_exercises')
      .select('*, exercises(name, muscle_group, video_url)')
      .eq('assigned_workout_id', id)
      .order('order', { ascending: true })

    setWorkout(w)
    setAssignedExercises(ex || [])

    const { data: newSession } = await supabase
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
    setSession(newSession)

    const initialSets: Record<string, any[]> = {}
    const pastRecords: Record<string, any> = {}

    if (ex) {
      for (const item of ex) {
        // Se houver séries planejadas individuais, usa elas! Se não, fallback
        const planned = item.planned_sets || []
        const setsCount = planned.length > 0 ? planned.length : item.sets_count

        const setsArray = []
        for (let i = 0; i < setsCount; i++) {
          const currentPlan = planned[i] || {}
          setsArray.push({
            set_number: i + 1,
            weight_kg: '',
            reps: '',
            target_reps: currentPlan.reps || item.target_reps || '8-12',
            rir: currentPlan.rir !== undefined ? currentPlan.rir : item.target_rir,
            type: currentPlan.type || item.set_type || 'working',
            completed: false,
          })
        }
        initialSets[item.id] = setsArray

        const { data: pastSet } = await supabase
          .from('session_sets')
          .select('weight_kg, reps')
          .eq('exercise_id', item.exercise_id)
          .eq('completed', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (pastSet) pastRecords[item.id] = pastSet
      }
    }
    setSetsData(initialSets)
    setLastRecords(pastRecords)
    setLoading(false)
  }

  const handleUpdateSet = (
    assignedExId: string,
    setIdx: number,
    field: string,
    value: any
  ) => {
    setSetsData((prev) => {
      const updatedExSets = [...(prev[assignedExId] || [])]
      updatedExSets[setIdx] = { ...updatedExSets[setIdx], [field]: value }
      return { ...prev, [assignedExId]: updatedExSets }
    })
  }

  const toggleCompleteSet = async (
    assignedExId: string,
    exerciseId: string,
    setIdx: number
  ) => {
    const currentSet = setsData[assignedExId][setIdx]
    const newCompleted = !currentSet.completed
    handleUpdateSet(assignedExId, setIdx, 'completed', newCompleted)

    if (session && newCompleted) {
      await supabase.from('session_sets').insert([
        {
          session_id: session.id,
          exercise_id: exerciseId,
          assigned_exercise_id: assignedExId,
          set_number: currentSet.set_number,
          weight_kg: Number(currentSet.weight_kg) || 0,
          reps: Number(currentSet.reps) || 0,
          rir: currentSet.rir ? Number(currentSet.rir) : null,
          set_type: currentSet.type,
          completed: true,
        },
      ])
    }
  }

  const handleFinishWorkout = async () => {
    if (!session) return
    setFinishing(true)
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

  const getSetBadge = (type: string) => {
    switch (type) {
      case 'warmup':
        return { label: 'AQUECIMENTO', color: 'text-amber-400 bg-amber-950/40 border-amber-800/40' }
      case 'feeder':
        return { label: 'FEEDER SET', color: 'text-sky-400 bg-sky-950/40 border-sky-800/40' }
      case 'top':
        return { label: 'TOP SET', color: 'text-rose-400 bg-rose-950/40 border-rose-800/40' }
      case 'backoff':
        return { label: 'BACK-OFF SET', color: 'text-purple-400 bg-purple-950/40 border-purple-800/40' }
      case 'cluster':
        return { label: 'CLUSTER', color: 'text-indigo-400 bg-indigo-950/40 border-indigo-800/40' }
      case 'myo_reps':
        return { label: 'MYO REPS', color: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40' }
      default:
        return { label: 'WORKING SET', color: 'text-zinc-400 bg-zinc-900 border-zinc-800' }
    }
  }

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
        <Loader2 className="animate-spin w-8 h-8 text-white" />
      </div>
    )

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
        <button
          onClick={() => router.back()}
          className="p-2 text-zinc-400 hover:text-white"
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

      {assignedExercises.map((exItem) => {
        const last = lastRecords[exItem.id]
        const sets = setsData[exItem.id] || []

        return (
          <div
            key={exItem.id}
            className="bg-zinc-950 border border-zinc-900 rounded-3xl p-5 space-y-4 overflow-hidden"
          >
            {/* VÍDEO DO EXERCÍCIO */}
            {exItem.exercises?.video_url ? (
              <div className="w-full h-40 bg-zinc-900 rounded-2xl overflow-hidden mb-4 relative">
                <img
                  src={exItem.exercises.video_url}
                  alt="Execução"
                  className="w-full h-full object-cover opacity-80"
                />
              </div>
            ) : (
              <div className="w-full h-20 bg-zinc-900/60 rounded-2xl flex items-center justify-center mb-2 border border-zinc-800">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                  Foco: {exItem.exercises?.muscle_group}
                </span>
              </div>
            )}

            <div className="flex items-start justify-between border-b border-zinc-900 pb-3">
              <div>
                <h3 className="font-black text-base text-white">
                  {exItem.exercises?.name}
                </h3>
                <p className="text-xs font-bold uppercase text-zinc-500 mt-0.5">
                  {exItem.exercises?.muscle_group}
                </p>
              </div>
              {last && (
                <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl text-right">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase block">
                    Anterior
                  </span>
                  <span className="text-xs font-extrabold text-emerald-400">
                    {last.weight_kg}kg × {last.reps}
                  </span>
                </div>
              )}
            </div>

            {exItem.notes && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                <p className="text-xs text-zinc-300 font-medium">
                  {exItem.notes}
                </p>
              </div>
            )}

            {/* TABELA DE EXECUÇÃO DAS SÉRIES */}
            <div className="space-y-3">
              {sets.map((s, idx) => {
                const badge = getSetBadge(s.type)
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-2xl border space-y-2 transition-all ${
                      s.completed
                        ? 'bg-emerald-950/20 border-emerald-800/40'
                        : 'bg-zinc-900/80 border-zinc-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-zinc-400">
                          #{s.set_number}
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase border px-2 py-0.5 rounded-md ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-400">
                        Meta: {s.target_reps} reps | RIR {s.rir ?? '0'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 items-center pt-1">
                      <div>
                        <span className="text-[8px] font-bold text-zinc-500 uppercase block mb-1">
                          Carga (kg)
                        </span>
                        <input
                          type="number"
                          value={s.weight_kg}
                          onChange={(e) =>
                            handleUpdateSet(
                              exItem.id,
                              idx,
                              'weight_kg',
                              e.target.value
                            )
                          }
                          placeholder="0"
                          className="w-full bg-black border border-zinc-800 rounded-xl p-2.5 text-center text-sm font-extrabold text-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <span className="text-[8px] font-bold text-zinc-500 uppercase block mb-1">
                          Reps Feitas
                        </span>
                        <input
                          type="number"
                          value={s.reps}
                          onChange={(e) =>
                            handleUpdateSet(
                              exItem.id,
                              idx,
                              'reps',
                              e.target.value
                            )
                          }
                          placeholder={s.target_reps || '0'}
                          className="w-full bg-black border border-zinc-800 rounded-xl p-2.5 text-center text-sm font-extrabold text-white focus:outline-none"
                        />
                      </div>

                      <button
                        onClick={() =>
                          toggleCompleteSet(
                            exItem.id,
                            exItem.exercise_id,
                            idx
                          )
                        }
                        className={`w-full h-10 rounded-xl flex justify-center items-center font-bold mt-3 transition-all ${
                          s.completed
                            ? 'bg-emerald-500 text-black'
                            : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        <Check className="w-5 h-5 stroke-[3]" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* MODAL DE FINALIZAÇÃO DA SESSÃO */}
      {showFinishModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-black uppercase">Finalizar Treino</h2>
              <p className="text-xs text-zinc-400">
                Qual foi o Esforço (RPE) da sessão?
              </p>
            </div>
            <div className="space-y-3 text-center">
              <span className="text-4xl font-black text-white">
                {sessionRpe} / 10
              </span>
              <input
                type="range"
                min="1"
                max="10"
                value={sessionRpe}
                onChange={(e) => setSessionRpe(Number(e.target.value))}
                className="w-full accent-white"
              />
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
                className="w-1/2 bg-white text-black font-extrabold p-4 rounded-xl text-xs uppercase flex justify-center items-center"
              >
                {finishing ? (
                  <Loader2 className="animate-spin w-5 h-5" />
                ) : (
                  'Salvar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
          }
