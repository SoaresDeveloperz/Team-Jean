'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ImagePlus, LoaderCircle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { MAX_PROGRESS_PHOTOS, addMeasurement, parseDecimal, todayISO } from '@/lib/measurements'
import { PROFILE_SETUP_MESSAGE, ProfileError } from '@/lib/profile'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { Modal, SheetFooter } from '@/components/ui/modal'

type MeasurementFormProps = {
  open: boolean
  userId: string
  // Treinador registrando para o aluno muda os textos.
  forStudent?: string | null
  onClose: () => void
  onSaved: () => void
}

type Photo = { id: string; file: File; preview: string }

const inputClassName =
  'h-14 w-full rounded-2xl border border-line-strong bg-black/40 px-4 text-center font-display text-2xl font-bold text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none'
const labelClassName = 'mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400'
const PHOTO_HINTS = ['Frente', 'Lado', 'Costas']

// Montado de novo a cada abertura (key no pai): começa sempre limpo.
export function MeasurementForm({ open, userId, forStudent, onClose, onSaved }: MeasurementFormProps) {
  const [supabase] = useState(() => createClient())
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

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    const values = { weight: parseDecimal(weight), bodyFat: parseDecimal(bodyFat), waist: parseDecimal(waist) }
    if (Object.values(values).some((value) => Number.isNaN(value))) return setError('Use só números (ex.: 72,4).')
    if (values.weight !== null && (values.weight < 20 || values.weight > 400)) return setError('Peso deve ficar entre 20 e 400 kg.')
    if (values.bodyFat !== null && (values.bodyFat < 2 || values.bodyFat > 70)) return setError('Gordura deve ficar entre 2% e 70%.')
    if (values.waist !== null && (values.waist < 30 || values.waist > 250)) return setError('Cintura deve ficar entre 30 e 250 cm.')
    if (values.weight === null && values.bodyFat === null && values.waist === null && photos.length === 0) {
      return setError('Preencha pelo menos uma medida ou adicione uma foto.')
    }
    if (!measuredOn) return setError('Informe a data da medida.')
    if (measuredOn > todayISO()) return setError('A data não pode ser no futuro.')

    setStage('Salvando')
    try {
      await addMeasurement(
        supabase,
        userId,
        { measuredOn, ...values, note, photos: photos.map((photo) => photo.file) },
        setStage,
      )
      onSaved()
    } catch (saveError) {
      setStage(null)
      if (saveError instanceof ProfileError && saveError.missing) setError(PROFILE_SETUP_MESSAGE)
      else setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar.')
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
          ].map((field) => (
            <div key={field.id}>
              <label htmlFor={field.id} className={labelClassName}>
                {field.label} <span className="normal-case tracking-normal text-zinc-500">({field.unit})</span>
              </label>
              <input
                id={field.id}
                inputMode="decimal"
                value={field.value}
                onChange={(event) => field.set(event.target.value)}
                placeholder={field.placeholder}
                className={inputClassName}
              />
            </div>
          ))}
        </div>

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
