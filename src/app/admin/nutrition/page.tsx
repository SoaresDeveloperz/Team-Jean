'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Salad, Search, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { avatarUrlOf } from '@/lib/profile'
import { friendlyError } from '@/lib/errors'
import { plural } from '@/lib/text'
import { cn } from '@/lib/cn'
import { NUTRITION_SETUP_MESSAGE, NutritionLoadError, loadPlanSummaries, type PlanSummary } from '@/lib/nutrition-plan'
import { relativeDay } from '@/lib/stats'
import { Alert } from '@/components/ui/alert'
import { Avatar } from '@/components/ui/avatar'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { Eyebrow } from '@/components/ui/tile'
import { NutritionPlanEditor } from '@/components/coach/NutritionPlanEditor'

type Filter = 'all' | 'with' | 'without'

const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export default function AdminNutritionPage() {
  const [supabase] = useState(() => createClient())
  const [students, setStudents] = useState<Profile[] | null>(null)
  const [plans, setPlans] = useState<Map<string, PlanSummary> | null>(null)
  const [loadError, setLoadError] = useState<{ message: string; missing: boolean } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      const studentsResult = await supabase.from('profiles').select('*').eq('role', 'student').order('full_name', { ascending: true })
      if (!active) return
      if (studentsResult.error) {
        setLoadError({ message: friendlyError(studentsResult.error, 'Não foi possível carregar os alunos'), missing: false })
        return
      }
      setStudents((studentsResult.data ?? []) as Profile[])
      try {
        const summaries = await loadPlanSummaries(supabase)
        if (!active) return
        setPlans(summaries)
        setLoadError(null)
      } catch (error) {
        if (!active) return
        // Sem o SQL da nutrição a lista de alunos aparece, mas ninguém tem plano: o aviso diz o que rodar.
        setLoadError({
          message: error instanceof Error ? error.message : friendlyError(error, 'Não foi possível carregar os planos'),
          missing: error instanceof NutritionLoadError && error.missing,
        })
      }
    })()
    return () => {
      active = false
    }
  }, [supabase, reloadKey])

  const counts = useMemo(() => {
    const total = students?.length ?? 0
    const withPlan = (students ?? []).filter((student) => plans?.has(student.id)).length
    return { all: total, with: withPlan, without: total - withPlan }
  }, [students, plans])

  const shown = useMemo(() => {
    const words = plain(search).split(/\s+/).filter(Boolean)
    return (students ?? []).filter((student) => {
      const has = plans?.has(student.id) ?? false
      if (filter === 'with' && !has) return false
      if (filter === 'without' && has) return false
      if (words.length === 0) return true
      const text = plain(`${student.full_name ?? ''} ${student.email ?? ''}`)
      return words.every((word) => text.includes(word))
    })
  }, [students, plans, search, filter])

  const opened = students?.find((student) => student.id === openId) ?? null
  const closeEditor = useCallback(() => {
    setOpenId(null)
    // O treinador pode ter criado, mudado ou apagado o plano lá dentro: a lista recarrega ao fechar.
    setReloadKey((key) => key + 1)
  }, [])

  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: `Todos · ${counts.all}` },
    { value: 'with', label: `Com plano · ${counts.with}` },
    { value: 'without', label: `Sem plano · ${counts.without}` },
  ]

  return (
    <div className="space-y-4">
      <div className="px-1">
        <Eyebrow icon={Salad}>Consultoria</Eyebrow>
        <h1 className="mt-1 font-display text-[2.75rem] font-bold uppercase leading-[0.9]">Nutrição</h1>
        <p className="mt-1.5 text-xs text-zinc-500">Planos alimentares dos alunos. Toque em um aluno para montar ou ajustar o plano.</p>
      </div>

      {loadError && (
        <Alert variant={loadError.missing ? 'info' : 'error'} onRetry={loadError.missing ? undefined : () => setReloadKey((key) => key + 1)}>
          {loadError.missing ? NUTRITION_SETUP_MESSAGE : loadError.message}
        </Alert>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar aluno"
          aria-label="Buscar aluno"
          autoComplete="off"
          className="h-12 w-full rounded-2xl border border-line bg-surface pl-11 pr-4 text-base text-white placeholder:text-zinc-500 focus:border-brand/60 focus:outline-none"
        />
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Filtrar alunos">
        {filters.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={cn(
              'h-11 shrink-0 rounded-full border px-3.5 text-xs font-bold transition',
              filter === option.value ? 'border-white bg-white text-black' : 'border-line bg-surface text-zinc-400 hover:text-white',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {students === null ? (
        loadError ? null : (
          <div className="grid gap-2.5 lg:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Carregando alunos">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-20 rounded-3xl" />
            ))}
          </div>
        )
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line-strong p-10 text-center">
          <Salad className="h-9 w-9 text-zinc-600" aria-hidden="true" />
          <p className="text-sm font-semibold text-zinc-400">
            {students.length === 0 ? 'Nenhum aluno cadastrado ainda.' : 'Nenhum aluno neste filtro.'}
          </p>
        </div>
      ) : (
        <ul className="grid gap-2.5 lg:grid-cols-2 xl:grid-cols-3">
          {shown.map((student) => {
            const plan = plans?.get(student.id)
            const name = student.full_name || student.email || 'Aluno'
            return (
              <li key={student.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(student.id)}
                  className="flex min-h-[4.5rem] w-full items-center gap-3.5 rounded-3xl border border-line bg-surface p-4 text-left transition hover:border-line-strong"
                >
                  <Avatar name={name} seed={student.id} src={avatarUrlOf(student)} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-white">{name}</span>
                    {plan ? (
                      <span className="block truncate text-xs text-zinc-400">
                        {plan.kcalTarget ? `Meta ${new Intl.NumberFormat('pt-BR').format(plan.kcalTarget)} kcal · ` : ''}
                        {plural(plan.meals, 'refeição', 'refeições')}
                        {plan.updatedAt ? ` · mudou ${relativeDay(new Date(plan.updatedAt))}` : ''}
                      </span>
                    ) : (
                      <span className="block text-xs text-zinc-500">{plans ? 'Ainda sem plano' : 'Plano indisponível'}</span>
                    )}
                  </span>
                  {plan ? (
                    <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden="true" />
                  ) : plans ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand">
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Criar plano
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        open={opened !== null}
        onClose={closeEditor}
        title={opened ? opened.full_name || opened.email || 'Aluno' : 'Plano alimentar'}
        description="Plano alimentar"
        size="wide"
      >
        {opened && <NutritionPlanEditor key={opened.id} studentId={opened.id} studentName={opened.full_name || opened.email || 'Aluno'} />}
      </Modal>
    </div>
  )
}
