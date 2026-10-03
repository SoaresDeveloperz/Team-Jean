'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Dumbbell, LayoutDashboard, Play } from 'lucide-react'
import { createClient } from '../../lib/supabase/client'
import { Logo } from '../../components/ui/logo'
import { ExerciseMedia } from '../../components/workout/ExerciseMedia'

type AssignedExercise = {
  id: string
  sets_count?: number | null
  target_reps?: string | number | null
  exercises?: {
    name?: string | null
    muscle_group?: string | null
    image_url?: string | null
    video_url?: string | null
  } | null
}

type CurrentWorkout = {
  id: string
  name: string
  exercises: AssignedExercise[]
}

type DashboardState =
  | { status: 'loading' }
  | { status: 'ready'; email: string; isAdmin: boolean; currentWorkout: CurrentWorkout | null }
  | { status: 'unauthenticated' }
  | { status: 'error' }

export default function DashboardPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [dashboard, setDashboard] = useState<DashboardState>({ status: 'loading' })
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return

      if (error) {
        setDashboard({ status: 'error' })
        return
      }

      if (!data.session) {
        setDashboard({ status: 'unauthenticated' })
        return
      }

      const metadataRole = String(data.session.user.user_metadata?.role ?? '').toLowerCase()
      let isAdmin = metadataRole === 'admin'

      if (!isAdmin) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.session.user.id)
          .maybeSingle()

        if (!active) return
        isAdmin = String(profile?.role ?? '').toLowerCase() === 'admin'
      }

      if (!isAdmin && data.session.user.email) {
        const { data: profilesByEmail } = await supabase
          .from('profiles')
          .select('role')
          .ilike('email', data.session.user.email.trim())
          .limit(20)

        if (!active) return
        isAdmin = profilesByEmail?.some(
          (profile) => String(profile.role ?? '').trim().toLowerCase() === 'admin',
        ) ?? false
      }

      let currentWorkout: CurrentWorkout | null = null
      const { data: workout } = await supabase
        .from('assigned_workouts')
        .select('*')
        .eq('student_id', data.session.user.id)
        .eq('is_current', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (workout) {
        const { data: assignedExercises } = await supabase
          .from('assigned_workout_exercises')
          .select('*, exercises(*)')
          .eq('assigned_workout_id', workout.id)
          .order('order', { ascending: true })

        currentWorkout = {
          id: workout.id,
          name: workout.name,
          exercises: (assignedExercises ?? []) as AssignedExercise[],
        }
      }

      setDashboard({
        status: 'ready',
        email: data.session.user.email ?? 'Conta Team Jean',
        isAdmin,
        currentWorkout,
      })
    }).catch(() => {
      if (active) setDashboard({ status: 'error' })
    })

    return () => {
      active = false
    }
  }, [router, supabase])

  const handleSignOut = async () => {
    setSigningOut(true)
    setSignOutError('')

    const { error } = await supabase.auth.signOut()

    if (error) {
      setSignOutError('Não foi possível sair agora. Tente novamente.')
      setSigningOut(false)
      return
    }

    router.replace('/')
  }

  if (dashboard.status !== 'ready') {
    return (
      <main className="min-h-screen bg-black px-6 text-white flex items-center justify-center">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <p className="text-sm text-zinc-400">
            {dashboard.status === 'error'
              ? 'Não foi possível verificar sua sessão. Tente entrar novamente.'
              : dashboard.status === 'unauthenticated'
                ? 'O login não manteve uma sessão neste navegador. Confira se a URL e a chave do Supabase pertencem ao mesmo projeto.'
                : 'Verificando seu acesso...'}
          </p>
          {dashboard.status === 'unauthenticated' && (
            <button
              type="button"
              onClick={() => router.replace('/')}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-900"
            >
              Voltar ao login
            </button>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-12">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo className="h-12 w-12" />
            <div>
              <p className="text-sm font-black tracking-widest">TEAM JEAN</p>
              <p className="text-[10px] font-medium tracking-[0.2em] text-zinc-500">
                CONSULTORIA ESPORTIVA
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dashboard.isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm font-semibold transition hover:bg-zinc-900"
              >
                <LayoutDashboard aria-hidden="true" size={16} />
                <span className="hidden sm:inline">Painel Admin</span>
                <span className="sm:hidden">Admin</span>
              </Link>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-900 disabled:opacity-50"
            >
              {signingOut ? 'Saindo...' : 'Sair'}
            </button>
          </div>
        </header>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7 sm:p-10">
          <p className="text-xs font-bold tracking-[0.2em] text-zinc-500">
            ÁREA DO ATLETA
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Você entrou.
          </h1>
          <p className="mt-3 text-zinc-400">
            Sua sessão do Team Jean está ativa.
          </p>
          <div className="mt-8 border-t border-zinc-800 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Conta conectada
            </p>
            <p className="mt-2 break-all text-sm text-zinc-200">{dashboard.email}</p>
          </div>
          {signOutError && (
            <p role="alert" className="mt-5 text-sm text-red-400">
              {signOutError}
            </p>
          )}
        </section>

          {dashboard.currentWorkout ? (
            <section className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold tracking-[0.2em] text-zinc-500">
                    TREINO ATUAL
                  </p>
                  <h2 className="mt-1 text-xl font-black uppercase tracking-wide">
                    {dashboard.currentWorkout.name}
                  </h2>
                </div>
                <Link
                  href={`/student/workout/${dashboard.currentWorkout.id}`}
                  className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black uppercase text-black transition active:scale-95"
                >
                  <Play className="h-4 w-4 fill-black" aria-hidden="true" />
                  Iniciar
                </Link>
              </div>

              {dashboard.currentWorkout.exercises.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.currentWorkout.exercises.map((item, index) => (
                    <div
                      key={item.id}
                      className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950"
                    >
                      <ExerciseMedia
                        muscleGroup={item.exercises?.muscle_group ?? 'Treino'}
                        exerciseName={item.exercises?.name ?? 'Exercício'}
                        imageUrl={item.exercises?.image_url}
                      />
                      <div className="flex items-center gap-3 p-4">
                        <span className="text-xs font-black text-zinc-600">
                          #{index + 1}
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold text-white">
                            {item.exercises?.name ?? 'Exercício'}
                          </h3>
                          <p className="text-xs text-zinc-500">
                            {item.exercises?.muscle_group ?? 'Grupo não informado'}
                            {item.sets_count
                              ? ` · ${item.sets_count} séries${item.target_reps ? ` × ${item.target_reps} reps` : ''}`
                              : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950 p-6 text-center">
                  <Dumbbell className="mx-auto h-8 w-8 text-zinc-700" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold text-zinc-400">
                    Seu treino ainda não tem exercícios.
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Peça ao treinador para completar a ficha.
                  </p>
                </div>
              )}
            </section>
          ) : (
            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7 text-center">
              <Dumbbell className="mx-auto h-10 w-10 text-zinc-700" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-black uppercase">Nenhum treino ativo</h2>
              <p className="mt-2 text-sm text-zinc-500">
                Quando o treinador atribuir seu próximo treino, ele aparecerá aqui.
              </p>
            </section>
          )}
      </div>
    </main>
  )
}