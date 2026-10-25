'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Camera, ChevronDown, Columns2, Plus, Ruler, Scale, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { dateFromISO, deleteMeasurement, loadMeasurements, type Measurement } from '@/lib/measurements'
import { ProfileError } from '@/lib/profile'
import { plural } from '@/lib/text'
import { formatKg } from '@/lib/workouts'
import { cn } from '@/lib/cn'
import { friendlyError } from '@/lib/errors'
import { LineChart } from '@/components/fitness/LineChart'
import { PhotoViewer } from '@/components/community/PhotoViewer'
import { Alert } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { Eyebrow, Tile } from '@/components/ui/tile'
import { CompareSlider } from './CompareSlider'
import { MeasurementForm, type PhysicalProfile } from './MeasurementForm'
import { PERIMETERS, SKINFOLDS, bmi, bmiLabel, composition, type SkinfoldSite } from '@/lib/health'

type MeasurementsCardProps = {
  userId: string
  // Pinta a variação de peso: em emagrecimento descer é bom; em hipertrofia/força, subir.
  goal?: string | null
  // Treinador vendo a ficha do aluno.
  studentName?: string | null
  // Dentro de um modal (ficha do aluno) não usa o Tile animado.
  bare?: boolean
  // Sexo, nascimento e altura (IMC e % de gordura pelas dobras).
  profile?: PhysicalProfile | null
  onProfileChange?: (patch: PhysicalProfile) => void
}

type Status = 'loading' | 'ready' | 'missing' | 'error'
type ViewerState = { open: boolean; photos: (string | null)[]; index: number; title: string }

const shortDate = (value: string) => dateFromISO(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
const dayMonth = (value: string) => dateFromISO(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const formatOne = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)

function deltaTone(delta: number, goal: string | null | undefined) {
  if (delta === 0) return 'text-zinc-400'
  const wantsLess = goal === 'emagrecimento'
  const wantsMore = goal === 'hipertrofia' || goal === 'forca'
  if ((wantsLess && delta < 0) || (wantsMore && delta > 0)) return 'text-brand'
  if (wantsLess || wantsMore) return 'text-gold'
  return 'text-zinc-300'
}

function Container({ bare, children }: { bare: boolean; children: ReactNode }) {
  if (bare) return <section className="rounded-3xl border border-line bg-surface p-4">{children}</section>
  return <Tile className="p-4">{children}</Tile>
}

export function MeasurementsCard({ userId, goal, studentName, bare = false, profile, onProfileChange }: MeasurementsCardProps) {
  const [supabase] = useState(() => createClient())
  const toast = useToast()
  const [items, setItems] = useState<Measurement[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [compareOpen, setCompareOpen] = useState(false)
  const [viewer, setViewer] = useState<ViewerState>({ open: false, photos: [], index: 0, title: '' })
  const [confirmItem, setConfirmItem] = useState<Measurement | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Perfil físico atualizado pelo formulário (sem esperar o pai recarregar).
  const [physical, setPhysical] = useState<PhysicalProfile | null>(profile ?? null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const list = await loadMeasurements(supabase, userId)
        if (!active) return
        setItems(list)
        setStatus('ready')
      } catch (error) {
        if (!active) return
        if (error instanceof ProfileError && error.missing) setStatus('missing')
        else {
          setErrorMessage(friendlyError(error, 'Não foi possível carregar as medidas'))
          setStatus('error')
        }
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [supabase, userId, reloadKey])

  const openForm = () => {
    setFormKey((key) => key + 1)
    setFormOpen(true)
  }
  const closeForm = useCallback(() => setFormOpen(false), [])
  const closeCompare = useCallback(() => setCompareOpen(false), [])
  const closeViewer = useCallback(() => setViewer((state) => ({ ...state, open: false })), [])
  const changeViewerIndex = useCallback((index: number) => setViewer((state) => ({ ...state, index })), [])
  const closeConfirm = useCallback(() => {
    if (!deleting) setConfirmItem(null)
  }, [deleting])

  const handleSaved = () => {
    setFormOpen(false)
    setReloadKey((key) => key + 1)
    toast({ tone: 'success', title: 'Medidas salvas', description: studentName ? `Registro de ${studentName}.` : 'Bora acompanhar a evolução!' })
  }

  const confirmDelete = async () => {
    if (!confirmItem) return
    setDeleting(true)
    try {
      await deleteMeasurement(supabase, confirmItem)
      setItems((list) => list.filter((item) => item.id !== confirmItem.id))
      toast({ tone: 'success', title: 'Registro apagado' })
    } catch (error) {
      toast({ tone: 'error', title: 'Não foi possível apagar', description: friendlyError(error) })
    } finally {
      setDeleting(false)
      setConfirmItem(null)
    }
  }

  const weights = items.filter((item) => item.weight_kg !== null)
  const latestWeight = weights[0] ?? null
  const firstWeight = weights[weights.length - 1] ?? null
  const delta = latestWeight && firstWeight && latestWeight !== firstWeight ? (latestWeight.weight_kg as number) - (firstWeight.weight_kg as number) : null
  const latestFat = items.find((item) => item.body_fat !== null) ?? null
  const latestWaist = items.find((item) => item.waist_cm !== null) ?? null
  const latestBmi = bmi(latestWeight?.weight_kg, physical?.height_cm)
  // Composição do registro mais recente com peso e % de gordura.
  const latestComplete = items.find((item) => item.weight_kg !== null && item.body_fat !== null) ?? null
  const latestComposition = latestComplete ? composition(latestComplete.weight_kg, latestComplete.body_fat) : null
  const chartPoints = [...weights]
    .slice(0, 12)
    .reverse()
    .map((item) => ({ key: item.id, label: dayMonth(item.measured_on), value: item.weight_kg as number }))
  const photoEntries = items.filter((item) => item.photos.length > 0)
  const visible = showAll ? items : items.slice(0, 4)
  // Na ficha do aluno o título do modal já é o h2.
  const Heading = bare ? 'h3' : 'h2'

  return (
    <Container bare={bare}>
      <div className="flex items-center justify-between gap-2">
        <Heading>
          <Eyebrow icon={Scale}>Medidas e evolução</Eyebrow>
        </Heading>
        {status === 'ready' && (
          <m.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={openForm}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-black"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Registrar
          </m.button>
        )}
      </div>

      {status === 'loading' && (
        <div className="mt-3 space-y-2" role="status" aria-label="Carregando medidas">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      )}

      {status === 'missing' && (
        <p className="mt-3 rounded-2xl border border-dashed border-line-strong p-4 text-center text-xs leading-relaxed text-zinc-400">
          {studentName
            ? 'Para registrar medidas, rode o arquivo supabase/profile.sql no SQL Editor do Supabase.'
            : 'O registro de medidas ainda não foi ativado. Avise seu treinador.'}
        </p>
      )}

      {status === 'error' && (
        <Alert
          variant="error"
          className="mt-3"
          onRetry={() => {
            setStatus('loading')
            setReloadKey((key) => key + 1)
          }}
        >
          {errorMessage}
        </Alert>
      )}

      {status === 'ready' && items.length === 0 && (
        <button
          type="button"
          onClick={openForm}
          className="mt-3 flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong p-6 text-center transition hover:border-brand/50"
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Camera className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-bold text-white">{studentName ? 'Registrar a primeira avaliação' : 'Comece a acompanhar seu corpo'}</span>
          <span className="text-xs text-zinc-500">Peso, gordura, cintura e fotos de antes e depois.</span>
        </button>
      )}

      {status === 'ready' && items.length > 0 && (
        <>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-black/30 p-3">
              <dt className="text-xs font-black uppercase tracking-wider text-zinc-500">Peso</dt>
              <dd className="mt-1 font-display text-3xl font-bold leading-none">
                {latestWeight ? formatKg(latestWeight.weight_kg as number) : '—'}
                {latestWeight && <span className="ml-0.5 text-sm text-zinc-500">kg</span>}
              </dd>
              {delta !== null && firstWeight && (
                <dd className={cn('mt-1.5 flex items-center gap-0.5 text-xs font-bold', deltaTone(delta, goal))}>
                  {delta < 0 ? (
                    <TrendingDown className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <TrendingUp className="h-3 w-3" aria-hidden="true" />
                  )}
                  {delta > 0 ? '+' : delta < 0 ? '−' : ''}
                  {formatKg(Math.abs(delta))} kg desde {dayMonth(firstWeight.measured_on)}
                </dd>
              )}
            </div>
            <div className="rounded-2xl bg-black/30 p-3">
              <dt className="text-xs font-black uppercase tracking-wider text-zinc-500">Gordura</dt>
              <dd className="mt-1 font-display text-3xl font-bold leading-none">
                {latestFat ? formatOne(latestFat.body_fat as number) : '—'}
                {latestFat && <span className="ml-0.5 text-sm text-zinc-500">%</span>}
              </dd>
            </div>
            <div className="rounded-2xl bg-black/30 p-3">
              <dt className="text-xs font-black uppercase tracking-wider text-zinc-500">Cintura</dt>
              <dd className="mt-1 font-display text-3xl font-bold leading-none">
                {latestWaist ? formatOne(latestWaist.waist_cm as number) : '—'}
                {latestWaist && <span className="ml-0.5 text-sm text-zinc-500">cm</span>}
              </dd>
            </div>
          </dl>

          {(latestBmi !== null || latestComposition) && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Composição corporal">
              {latestBmi !== null && (
                <li className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-zinc-200">
                  IMC <span className="font-bold text-white">{formatOne(latestBmi)}</span> · {bmiLabel(latestBmi)}
                </li>
              )}
              {latestComposition && (
                <>
                  <li className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                    Massa magra <span className="font-bold">{formatOne(latestComposition.leanMass)} kg</span>
                  </li>
                  <li className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-zinc-200">
                    Massa gorda <span className="font-bold text-white">{formatOne(latestComposition.fatMass)} kg</span>
                  </li>
                </>
              )}
            </ul>
          )}

          {chartPoints.length >= 2 && (
            <div className="mt-3">
              <LineChart
                points={chartPoints}
                format={(value) => `${formatKg(value)} kg`}
                title="Evolução do peso"
                noun={['registro', 'registros']}
              />
            </div>
          )}

          {photoEntries.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-[0.1em] text-zinc-500">Fotos de evolução</p>
                {photoEntries.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => setCompareOpen(true)}
                    className="flex h-9 items-center gap-1.5 rounded-xl border border-brand/40 bg-brand-soft px-3 text-xs font-bold text-brand"
                  >
                    <Columns2 className="h-3.5 w-3.5" aria-hidden="true" /> Antes e depois
                  </button>
                )}
              </div>
              <ul className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4" aria-label="Fotos de evolução">
                {photoEntries.map((entry) => (
                  <li key={entry.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setViewer({ open: true, photos: entry.photoUrls, index: 0, title: `Evolução · ${shortDate(entry.measured_on)}` })
                      }
                      aria-label={`Ver fotos de ${shortDate(entry.measured_on)}`}
                      className="relative block h-32 w-24 overflow-hidden rounded-2xl bg-surface-3"
                    >
                      {entry.photoUrls[0] && (
                        // eslint-disable-next-line @next/next/no-img-element -- link temporário de bucket privado
                        <img src={entry.photoUrls[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-5 text-left text-xs font-bold text-white">
                        {dayMonth(entry.measured_on)}
                        {entry.photos.length > 1 && <span className="text-zinc-300"> · {entry.photos.length}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <p className="text-xs font-black uppercase tracking-[0.1em] text-zinc-500">Histórico</p>
            <ul className="mt-1 divide-y divide-line">
              <AnimatePresence initial={false}>
                {visible.map((item) => {
                  const parts = [
                    item.weight_kg !== null ? `${formatKg(item.weight_kg)} kg` : null,
                    item.body_fat !== null ? `${formatOne(item.body_fat)}%` : null,
                    item.waist_cm !== null ? `${formatOne(item.waist_cm)} cm` : null,
                  ].filter(Boolean)
                  const rounds = PERIMETERS.filter((point) => typeof item.perimeters?.[point.key] === 'number')
                  const folds = (Object.keys(SKINFOLDS) as SkinfoldSite[]).filter((site) => typeof item.skinfolds?.[site] === 'number')
                  const hasDetails = rounds.length > 0 || folds.length > 0
                  const expanded = expandedId === item.id
                  // Registro anterior com o mesmo perímetro (para a variação).
                  const older = items.slice(items.indexOf(item) + 1)
                  const previousRound = (key: string) => older.find((entry) => typeof entry.perimeters?.[key] === 'number')?.perimeters?.[key]
                  return (
                    <m.li key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="w-16 shrink-0 text-xs font-bold tabular-nums text-zinc-400">{shortDate(item.measured_on)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white">
                            {parts.length > 0 ? parts.join(' · ') : 'Só fotos'}
                            {item.photos.length > 0 && (
                              <>
                                <Camera className="ml-1.5 inline h-3.5 w-3.5 text-brand" aria-hidden="true" />
                                <span className="sr-only">, {plural(item.photos.length, 'foto', 'fotos')}</span>
                              </>
                            )}
                          </span>
                          {item.note && <span className="block truncate text-xs text-zinc-500">{item.note}</span>}
                        </span>
                        {hasDetails && (
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : item.id)}
                            aria-expanded={expanded}
                            aria-label={`${expanded ? 'Esconder' : 'Ver'} avaliação completa de ${shortDate(item.measured_on)}`}
                            className={cn(
                              'flex h-9 shrink-0 items-center gap-1 rounded-xl px-2.5 text-xs font-bold transition',
                              expanded ? 'bg-white text-black' : 'bg-white/[0.06] text-zinc-300 hover:text-white',
                            )}
                          >
                            <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
                            <m.span animate={{ rotate: expanded ? 180 : 0 }}>
                              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                            </m.span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setConfirmItem(item)}
                          aria-label={`Apagar registro de ${shortDate(item.measured_on)}`}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zinc-500 transition hover:bg-danger-soft hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      <AnimatePresence initial={false}>
                        {expanded && (
                          <m.div
                            key="details"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-2.5 space-y-3 rounded-2xl bg-black/25 p-3">
                              {rounds.length > 0 && (
                                <div>
                                  <p className="text-xs font-black uppercase tracking-wider text-zinc-500">Perímetros (cm)</p>
                                  <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                                    {rounds.map((point) => {
                                      const value = item.perimeters?.[point.key] as number
                                      const before = previousRound(point.key)
                                      const diff = typeof before === 'number' ? Math.round((value - before) * 10) / 10 : null
                                      return (
                                        <div key={point.key} className="flex items-baseline justify-between gap-2 text-xs">
                                          <dt className="truncate text-zinc-400">{point.label}</dt>
                                          <dd className="shrink-0 font-bold tabular-nums text-white">
                                            {formatOne(value)}
                                            {diff !== null && diff !== 0 && (
                                              <span className={cn('ml-1 text-xs', diff > 0 ? 'text-brand' : 'text-gold')}>
                                                {diff > 0 ? '+' : '−'}
                                                {formatOne(Math.abs(diff))}
                                              </span>
                                            )}
                                          </dd>
                                        </div>
                                      )
                                    })}
                                  </dl>
                                </div>
                              )}
                              {folds.length > 0 && (
                                <div>
                                  <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
                                    Dobras (mm){item.protocol ? ` · ${item.protocol === 'pollock7' ? 'Pollock 7' : 'Pollock 3'}` : ''}
                                  </p>
                                  <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                                    {folds.map((site) => (
                                      <div key={site} className="flex items-baseline justify-between gap-2 text-xs">
                                        <dt className="truncate text-zinc-400">{SKINFOLDS[site]}</dt>
                                        <dd className="shrink-0 font-bold tabular-nums text-white">{formatOne(item.skinfolds?.[site] as number)}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                </div>
                              )}
                            </div>
                          </m.div>
                        )}
                      </AnimatePresence>
                    </m.li>
                  )
                })}
              </AnimatePresence>
            </ul>
            {items.length > visible.length && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="mt-1 h-10 w-full rounded-xl text-xs font-bold text-zinc-400 transition hover:text-white"
              >
                Ver todo o histórico ({items.length})
              </button>
            )}
          </div>
        </>
      )}

      <MeasurementForm
        key={formKey}
        open={formOpen}
        userId={userId}
        forStudent={studentName}
        profile={physical}
        onProfileChange={(patch) => {
          setPhysical(patch)
          onProfileChange?.(patch)
        }}
        onClose={closeForm}
        onSaved={handleSaved}
      />
      <CompareSlider open={compareOpen} entries={photoEntries} onClose={closeCompare} />
      <PhotoViewer
        open={viewer.open}
        photos={viewer.photos}
        index={viewer.index}
        title={viewer.title}
        onIndexChange={changeViewerIndex}
        onClose={closeViewer}
      />
      <ConfirmDialog
        open={confirmItem !== null}
        title="Apagar registro?"
        description="As medidas e as fotos deste dia saem do histórico. Não dá para desfazer."
        confirmLabel="Apagar"
        busy={deleting}
        onConfirm={confirmDelete}
        onClose={closeConfirm}
      />
    </Container>
  )
}
