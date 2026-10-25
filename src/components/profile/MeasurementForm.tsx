'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Calculator, ChevronDown, ImagePlus, LoaderCircle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { MAX_PROGRESS_PHOTOS, addMeasurement, cleanValues, parseDecimal, todayISO } from '@/lib/measurements'
import { PROFILE_SETUP_MESSAGE, ProfileError } from '@/lib/profile'
import {
  HEALTH_SETUP_MESSAGE,
  PERIMETERS,
  PROTOCOLS,
  SKINFOLDS,
  ageOn,
  bmi,
  bmiLabel,
  estimateBodyFat,
  isHealthSetupMissing,
  protocolSites,
  type PerimeterKey,
  type Protocol,
  type Sex,
  type SkinfoldSite,
} from '@/lib/health'
import { cn } from '@/lib/cn'
import { friendlyError } from '@/lib/errors'
import { Alert } from '@/components/ui/alert'
import { Modal, SheetFooter } from '@/components/ui/modal'

export type PhysicalProfile = Pick<Profile, 'sex' | 'birth_date' | 'height_cm'>

type MeasurementFormProps = {
  open: boolean
  userId: string
  // Treinador registrando para o aluno muda os textos.
  forStudent?: string | null
  // Sexo, nascimento e altura (para o % de gordura e o IMC).
  profile?: PhysicalProfile | null
  onProfileChange?: (patch: PhysicalProfile) => void
  onClose: () => void
  onSaved: () => void
}

type Photo = { id: string; file: File; preview: string }

const inputClassName =
  'h-14 w-full rounded-2xl border border-line-strong bg-black/40 px-4 text-center font-display text-2xl font-bold text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none'
const labelClassName = 'mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400'
const smallInputClassName =
  'h-11 w-full rounded-xl border border-line-strong bg-black/40 px-2 text-center font-bold tabular-nums text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none'
const chipClassName =
  'flex h-10 cursor-pointer items-center justify-center rounded-full border border-line px-3.5 text-xs font-bold text-zinc-300 transition hover:text-white has-[:checked]:border-white has-[:checked]:bg-white has-[:checked]:text-black has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand'
const PHOTO_HINTS = ['Frente', 'Lado', 'Costas']
const formatOne = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)
const toText = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value).replace('.', ','))

// Converte os campos de texto em números (null = vazio, NaN = inválido).
function parseFields<K extends string>(values: Partial<Record<K, string>>) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, parseDecimal(String(value ?? ''))])) as Record<K, number | null>
}

// Montado de novo a cada abertura (key no pai): começa sempre limpo.
export function MeasurementForm({ open, userId, forStudent, profile, onProfileChange, onClose, onSaved }: MeasurementFormProps) {
  const [supabase] = useState(() => createClient())
  const fullId = useId()
  const [fullOpen, setFullOpen] = useState(false)
  const [sex, setSex] = useState<Sex | null>(profile?.sex ?? null)
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? '')
  const [height, setHeight] = useState(toText(profile?.height_cm))
  const [protocol, setProtocol] = useState<Protocol | null>(null)
  const [skinfolds, setSkinfolds] = useState<Partial<Record<SkinfoldSite, string>>>({})
  const [perimeters, setPerimeters] = useState<Partial<Record<PerimeterKey, string>>>({})
  const [measuredOn, setMeasuredOn] = useState(() => todayISO())
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [waist, setWaist] = useState('')
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [error, setError] = useState('')
  const [stage, setStage] = useState<string | null>(null)
  const photosRef = useRef<Photo[]>([])

  useEffect(() => {
    photosRef.current = photos
  }, [photos])

  useEffect(
    () => () => {
      for (const photo of photosRef.current) URL.revokeObjectURL(photo.preview)
    },
    [],
  )

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const room = MAX_PROGRESS_PHOTOS - photos.length
    const files = [...list].filter((file) => file.type.startsWith('image/')).slice(0, room)
    if (list.length > room) setError(`Até ${MAX_PROGRESS_PHOTOS} fotos por registro.`)
    setPhotos((current) => [
      ...current,
      ...files.map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) })),
    ])
  }

  const removePhoto = (id: string) => {
    const photo = photos.find((item) => item.id === id)
    if (photo) URL.revokeObjectURL(photo.preview)
    setPhotos((current) => current.filter((item) => item.id !== id))
  }

  const sites = protocol ? protocolSites(protocol, sex) : []
  const skinfoldValues = parseFields(skinfolds)
  const age = ageOn(birthDate, measuredOn || todayISO())
  const estimate = estimateBodyFat(protocol, sex, age, skinfoldValues)
  const heightValue = parseDecimal(height)
  const weightValue = parseDecimal(weight)
  const bmiValue = typeof heightValue === 'number' && typeof weightValue === 'number' && !Number.isNaN(heightValue) && !Number.isNaN(weightValue) ? bmi(weightValue, heightValue) : null
  const missingForFat = protocol
    ? [!sex && 'sexo', age === null && 'data de nascimento', sites.some((site) => !(Number(skinfoldValues[site]) > 0)) && 'todas as dobras'].filter(Boolean)
    : []

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    const values = { weight: parseDecimal(weight), bodyFat: estimate ? estimate.bodyFat : parseDecimal(bodyFat), waist: parseDecimal(waist) }
    if (Object.values(values).some((value) => Number.isNaN(value))) return setError('Use só números (ex.: 72,4).')
    if (values.weight !== null && (values.weight < 20 || values.weight > 400)) return setError('Peso deve ficar entre 20 e 400 kg.')
    if (values.bodyFat !== null && (values.bodyFat < 2 || values.bodyFat > 70)) return setError('Gordura deve ficar entre 2% e 70%.')
    if (values.waist !== null && (values.waist < 30 || values.waist > 250)) return setError('Cintura deve ficar entre 30 e 250 cm.')
    // Avaliação completa: só os pontos do protocolo escolhido.
    const folds = protocol ? Object.fromEntries(sites.map((site) => [site, skinfoldValues[site]])) : {}
    const rounds = parseFields(perimeters)
    if ([...Object.values(folds), ...Object.values(rounds)].some((value) => Number.isNaN(value))) return setError('Use só números nas dobras e perímetros (ex.: 12,5).')
    if (Object.values(folds).some((value) => value !== null && (value < 1 || value > 80))) return setError('Cada dobra deve ficar entre 1 e 80 mm.')
    if (Object.values(rounds).some((value) => value !== null && (value < 5 || value > 250))) return setError('Cada perímetro deve ficar entre 5 e 250 cm.')
    if (heightValue !== null && (Number.isNaN(heightValue) || heightValue < 80 || heightValue > 250)) return setError('Altura deve ficar entre 80 e 250 cm.')
    if (birthDate && (birthDate > todayISO() || birthDate < '1900-01-01')) return setError('Confira a data de nascimento.')
    const skinfoldData = cleanValues(folds)
    const perimeterData = cleanValues(rounds)
    if (values.weight === null && values.bodyFat === null && values.waist === null && photos.length === 0 && !skinfoldData && !perimeterData) {
      return setError('Preencha pelo menos uma medida ou adicione uma foto.')
    }
    if (!measuredOn) return setError('Informe a data da medida.')
    if (measuredOn > todayISO()) return setError('A data não pode ser no futuro.')

    setStage('Salvando')
    try {
      // Sexo, nascimento e altura ficam no perfil (valem para as próximas avaliações).
      const physical: PhysicalProfile = { sex, birth_date: birthDate || null, height_cm: heightValue === null ? null : Math.round(heightValue * 10) / 10 }
      const changed =
        physical.sex !== (profile?.sex ?? null) || physical.birth_date !== (profile?.birth_date ?? null) || physical.height_cm !== (profile?.height_cm ?? null)
      if (changed) {
        const { error: profileError } = await supabase.from('profiles').update(physical).eq('id', userId)
        if (profileError) throw new ProfileError(isHealthSetupMissing(profileError) ? HEALTH_SETUP_MESSAGE : friendlyError(profileError, 'Não foi possível salvar o perfil'))
        onProfileChange?.(physical)
      }
      await addMeasurement(
        supabase,
        userId,
        {
          measuredOn,
          ...values,
          note,
          photos: photos.map((photo) => photo.file),
          perimeters: perimeterData,
          skinfolds: skinfoldData,
          protocol: skinfoldData ? protocol : null,
        },
        setStage,
      )
      onSaved()
    } catch (saveError) {
      setStage(null)
      if (saveError instanceof ProfileError && saveError.missing) setError(PROFILE_SETUP_MESSAGE)
      else setError(friendlyError(saveError, 'Não foi possível salvar'))
    }
  }

  return (
    <Modal
      open={open}
      onClose={stage ? () => undefined : onClose}
      variant="sheet"
      title="Registrar medidas"
      description={forStudent ? `Avaliação de ${forStudent}` : 'Só você e seu treinador veem estes dados.'}
    >
      <form onSubmit={save} className="space-y-5">
        <div>
          <label htmlFor="measure-date" className={labelClassName}>
            Data
          </label>
          <input
            id="measure-date"
            type="date"
            value={measuredOn}
            max={todayISO()}
            onChange={(event) => setMeasuredOn(event.target.value)}
            className="h-12 w-full rounded-2xl border border-line-strong bg-black/40 px-4 text-white focus:border-brand focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'measure-weight', label: 'Peso', unit: 'kg', value: weight, set: setWeight, placeholder: '72,4' },
            { id: 'measure-fat', label: 'Gordura', unit: '%', value: bodyFat, set: setBodyFat, placeholder: '—' },
            { id: 'measure-waist', label: 'Cintura', unit: 'cm', value: waist, set: setWaist, placeholder: '—' },
          ].map((field) => {
            const computed = field.id === 'measure-fat' && estimate !== null
            return (
              <div key={field.id}>
                <label htmlFor={field.id} className={labelClassName}>
                  {field.label} <span className="normal-case tracking-normal text-zinc-500">({field.unit})</span>
                </label>
                <input
                  id={field.id}
                  inputMode="decimal"
                  value={computed ? formatOne(estimate.bodyFat) : field.value}
                  readOnly={computed}
                  aria-describedby={computed ? `${fullId}-fat` : undefined}
                  onChange={(event) => field.set(event.target.value)}
                  placeholder={field.placeholder}
                  className={cn(inputClassName, computed && 'border-brand/50 text-brand')}
                />
              </div>
            )
          })}
        </div>

        {/* Avaliação completa: dobras (Pollock), perímetros e IMC */}
        <section className="overflow-hidden rounded-3xl border border-line bg-surface">
          <button
            type="button"
            aria-expanded={fullOpen}
            aria-controls={`${fullId}-panel`}
            onClick={() => setFullOpen((value) => !value)}
            className="flex w-full items-center gap-3 p-4 text-left"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <Calculator className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white">Avaliação completa</span>
              <span className="block text-[11px] text-zinc-400">Dobras cutâneas (Pollock), perímetros e IMC</span>
            </span>
            <m.span animate={{ rotate: fullOpen ? 180 : 0 }} className="text-zinc-500">
              <ChevronDown className="h-5 w-5" aria-hidden="true" />
            </m.span>
          </button>
          <AnimatePresence initial={false}>
            {fullOpen && (
              <m.div
                key="full"
                id={`${fullId}-panel`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="space-y-5 border-t border-line p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <fieldset className="col-span-2">
                      <legend className={labelClassName}>Sexo</legend>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'F' as const, label: 'Feminino' },
                          { value: 'M' as const, label: 'Masculino' },
                        ].map((option) => (
                          <label key={option.value} className={chipClassName}>
                            <input type="radio" name={`${fullId}-sex`} checked={sex === option.value} onChange={() => setSex(option.value)} className="sr-only" />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div>
                      <label htmlFor={`${fullId}-birth`} className={labelClassName}>
                        Nascimento
                      </label>
                      <input
                        id={`${fullId}-birth`}
                        type="date"
                        value={birthDate}
                        max={todayISO()}
                        onChange={(event) => setBirthDate(event.target.value)}
                        className="h-11 w-full rounded-xl border border-line-strong bg-black/40 px-3 text-white focus:border-brand focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor={`${fullId}-height`} className={labelClassName}>
                        Altura <span className="normal-case tracking-normal text-zinc-500">(cm)</span>
                      </label>
                      <input
                        id={`${fullId}-height`}
                        inputMode="decimal"
                        value={height}
                        onChange={(event) => setHeight(event.target.value)}
                        placeholder="170"
                        className={smallInputClassName}
                      />
                    </div>
                  </div>

                  <fieldset>
                    <legend className={labelClassName}>Protocolo de dobras</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {[{ value: null, label: 'Sem dobras', hint: '' }, ...PROTOCOLS].map((option) => (
                        <label key={option.label} className={cn(chipClassName, 'h-auto flex-col rounded-2xl px-2 py-2')}>
                          <input
                            type="radio"
                            name={`${fullId}-protocol`}
                            checked={protocol === option.value}
                            onChange={() => setProtocol(option.value)}
                            className="sr-only"
                          />
                          <span>{option.label}</span>
                          {option.hint && <span className="text-[10px] font-semibold opacity-70">{option.hint}</span>}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {protocol && (
                    <div>
                      <p className={labelClassName}>
                        Dobras <span className="normal-case tracking-normal text-zinc-500">(mm)</span>
                      </p>
                      {protocol === 'pollock3' && !sex ? (
                        <p className="rounded-2xl border border-dashed border-line-strong p-3 text-center text-xs text-zinc-400">
                          Escolha o sexo: as 3 dobras do protocolo mudam entre homens e mulheres.
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {sites.map((site) => (
                            <div key={site}>
                              <label htmlFor={`${fullId}-fold-${site}`} className="mb-1 block truncate text-[10px] font-bold text-zinc-400">
                                {SKINFOLDS[site]}
                              </label>
                              <input
                                id={`${fullId}-fold-${site}`}
                                inputMode="decimal"
                                value={skinfolds[site] ?? ''}
                                onChange={(event) => setSkinfolds((current) => ({ ...current, [site]: event.target.value }))}
                                placeholder="—"
                                className={smallInputClassName}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      <div
                        id={`${fullId}-fat`}
                        aria-live="polite"
                        className={cn(
                          'mt-3 rounded-2xl border px-4 py-3',
                          estimate ? 'border-brand/30 bg-brand-soft' : 'border-line bg-black/20',
                        )}
                      >
                        {estimate ? (
                          <p className="flex items-baseline justify-between gap-3">
                            <span className="text-xs font-semibold text-zinc-200">
                              % de gordura ({protocol === 'pollock3' ? 'Pollock 3' : 'Pollock 7'} + Siri)
                            </span>
                            <span className="font-display text-3xl font-bold text-brand">{formatOne(estimate.bodyFat)}%</span>
                          </p>
                        ) : (
                          <p className="text-xs text-zinc-400">Para calcular o % de gordura falta: {missingForFat.join(', ') || 'preencher as dobras'}.</p>
                        )}
                        {estimate && (
                          <p className="mt-0.5 text-[11px] text-zinc-400">
                            Soma {formatOne(estimate.sum)} mm · densidade {estimate.density.toFixed(4).replace('.', ',')} g/ml · {age} anos
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {bmiValue !== null && (
                    <p className="rounded-2xl border border-line bg-black/20 px-4 py-3 text-xs text-zinc-300">
                      IMC <span className="font-display text-xl font-bold text-white">{formatOne(bmiValue)}</span> · {bmiLabel(bmiValue)}
                    </p>
                  )}

                  <div>
                    <p className={labelClassName}>
                      Perímetros <span className="normal-case tracking-normal text-zinc-500">(cm)</span>
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {PERIMETERS.map((item) => (
                        <div key={item.key}>
                          <label htmlFor={`${fullId}-round-${item.key}`} className="mb-1 block truncate text-[10px] font-bold text-zinc-400">
                            {item.label}
                          </label>
                          <input
                            id={`${fullId}-round-${item.key}`}
                            inputMode="decimal"
                            value={perimeters[item.key] ?? ''}
                            onChange={(event) => setPerimeters((current) => ({ ...current, [item.key]: event.target.value }))}
                            placeholder="—"
                            className={smallInputClassName}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </section>

        <div>
          <p className={labelClassName}>Fotos de evolução (opcional)</p>
          <div className="grid grid-cols-3 gap-2">
            <AnimatePresence initial={false}>
              {photos.map((photo, index) => (
                <m.div
                  key={photo.id}
                  layout
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface-3"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) */}
                  <img src={photo.preview} alt={`Foto ${index + 1} (${PHOTO_HINTS[index]})`} className="h-full w-full object-cover" />
                  <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                    {PHOTO_HINTS[index]}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    disabled={Boolean(stage)}
                    aria-label={`Remover foto ${index + 1}`}
                    className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/75 text-white"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </m.div>
              ))}
            </AnimatePresence>
            {photos.length < MAX_PROGRESS_PHOTOS && (
              <label
                className={cn(
                  'grid aspect-[3/4] cursor-pointer place-items-center rounded-2xl border border-dashed border-line-strong text-zinc-400 transition hover:border-brand/50 hover:text-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand',
                  stage && 'pointer-events-none opacity-50',
                )}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    addFiles(event.target.files)
                    event.target.value = ''
                  }}
                  className="sr-only"
                />
                <span className="flex flex-col items-center gap-1 text-[10px] font-bold">
                  <ImagePlus className="h-6 w-6" aria-hidden="true" />
                  <span>
                    <span className="sr-only">Adicionar foto de </span>
                    {PHOTO_HINTS[photos.length]}
                  </span>
                </span>
              </label>
            )}
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">Dica: mesma luz, mesma distância e mesma pose deixam a comparação justa.</p>
        </div>

        <div>
          <label htmlFor="measure-note" className={labelClassName}>
            Observação (opcional)
          </label>
          <input
            id="measure-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={280}
            placeholder="Ex: em jejum, pela manhã"
            className="h-12 w-full rounded-2xl border border-line-strong bg-black/40 px-4 text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none"
          />
        </div>

        {error && <Alert variant="error">{error}</Alert>}
        <p className="sr-only" aria-live="polite">
          {stage ?? ''}
        </p>

        <SheetFooter>
          <m.button
            type="submit"
            disabled={Boolean(stage)}
            whileTap={{ scale: 0.98 }}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black uppercase tracking-[0.14em] text-black disabled:opacity-60"
          >
            {stage ? (
              <>
                <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                <span className="text-xs normal-case tracking-normal">{stage}...</span>
              </>
            ) : (
              'Salvar medidas'
            )}
          </m.button>
        </SheetFooter>
      </form>
    </Modal>
  )
}
