'use client'

import { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { HeartPulse, LoaderCircle, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  ACTIVITY_LEVELS,
  CONDITIONS,
  EMPTY_ANSWERS,
  PARQ,
  TEXT_LIMIT,
  parqAnswered,
  parqPositive,
  saveAnamnese,
  type Anamnese,
  type AnamneseAnswers,
} from '@/lib/health'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { Modal, SheetFooter } from '@/components/ui/modal'

const chipClassName =
  'flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-line px-4 text-xs font-bold text-zinc-300 transition hover:text-white has-[:checked]:border-white has-[:checked]:bg-white has-[:checked]:text-black has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand'
const labelClassName = 'mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400'
const fieldClassName =
  'w-full rounded-2xl border border-line-strong bg-black/40 px-3.5 py-3 text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none'
const sectionTitle = 'flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide text-white'

type AnamneseFormProps = {
  open: boolean
  studentId: string
  current: Anamnese | null
  // Treinador preenchendo pelo aluno muda os textos.
  forStudent?: string | null
  onClose: () => void
  onSaved: (anamnese: Anamnese) => void
}

function YesNo({ name, value, onChange, labelledBy }: { name: string; value: boolean | null | undefined; onChange: (value: boolean) => void; labelledBy: string }) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-2 gap-2">
      {[
        { label: 'Não', value: false },
        { label: 'Sim', value: true },
      ].map((option) => (
        <label
          key={option.label}
          className={cn(chipClassName, option.value && 'has-[:checked]:border-danger has-[:checked]:bg-danger has-[:checked]:text-black')}
        >
          <input type="radio" name={name} checked={value === option.value} onChange={() => onChange(option.value)} className="sr-only" />
          {option.label}
        </label>
      ))}
    </div>
  )
}

// Ficha de saúde: PAR-Q, condições, lesões, remédios e hábitos.
// Montado de novo a cada abertura (key no pai): começa com o que já foi salvo.
export function AnamneseForm({ open, studentId, current, forStudent, onClose, onSaved }: AnamneseFormProps) {
  const [supabase] = useState(() => createClient())
  const [answers, setAnswers] = useState<AnamneseAnswers>(() => current?.answers ?? EMPTY_ANSWERS)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<AnamneseAnswers>) => {
    setAnswers((value) => ({ ...value, ...patch }))
    setError('')
  }
  const positive = parqPositive(answers)

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!parqAnswered(answers)) {
      setError('Responda todas as perguntas do PAR-Q (Sim ou Não).')
      return
    }
    setSaving(true)
    try {
      onSaved(await saveAnamnese(supabase, studentId, answers))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a ficha.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      variant="sheet"
      title="Ficha de saúde"
      description={forStudent ? `Anamnese de ${forStudent}` : 'Leva uns 2 minutos. Só você e seu treinador veem.'}
    >
      <form onSubmit={save} className="space-y-7">
        <section aria-labelledby="parq-title" className="space-y-4">
          <div>
            <h3 id="parq-title" className={sectionTitle}>
              <HeartPulse className="h-5 w-5 text-brand" aria-hidden="true" /> PAR-Q
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">Questionário de prontidão para atividade física. Responda com sinceridade.</p>
          </div>
          <ol className="space-y-4">
            {PARQ.map((question, index) => (
              <li key={question.key} className="rounded-2xl border border-line bg-surface p-4">
                <p id={`parq-${question.key}`} className="mb-3 text-sm leading-relaxed text-zinc-200">
                  <span className="mr-1.5 font-display text-base font-bold text-brand">{index + 1}.</span>
                  {question.text}
                </p>
                <YesNo
                  name={`parq-${question.key}`}
                  labelledBy={`parq-${question.key}`}
                  value={answers.parq[question.key]}
                  onChange={(value) => set({ parq: { ...answers.parq, [question.key]: value } })}
                />
              </li>
            ))}
          </ol>
          <AnimatePresence initial={false}>
            {positive && (
              <m.p
                key="parq-alert"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="status"
                className="flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-xs leading-relaxed text-zinc-100"
              >
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                Com algum “sim”, o ideal é conversar com um médico antes de aumentar a intensidade. O treinador recebe esse alerta.
              </m.p>
            )}
          </AnimatePresence>
        </section>

        <section aria-labelledby="health-title" className="space-y-4">
          <h3 id="health-title" className={sectionTitle}>
            Saúde
          </h3>
          <fieldset>
            <legend className={labelClassName}>Tem ou já teve</legend>
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map((condition) => (
                <label key={condition.key} className={cn(chipClassName, 'px-3.5')}>
                  <input
                    type="checkbox"
                    checked={answers.conditions.includes(condition.key)}
                    onChange={(event) =>
                      set({
                        conditions: event.target.checked
                          ? [...answers.conditions, condition.key]
                          : answers.conditions.filter((key) => key !== condition.key),
                      })
                    }
                    className="sr-only"
                  />
                  {condition.label}
                </label>
              ))}
            </div>
          </fieldset>
          {[
            { key: 'injuries' as const, label: 'Lesões ou dores', placeholder: 'Ex.: dor no joelho direito ao agachar' },
            { key: 'surgeries' as const, label: 'Cirurgias', placeholder: 'Ex.: menisco em 2022' },
            { key: 'medications' as const, label: 'Remédios de uso contínuo', placeholder: 'Ex.: losartana 50 mg' },
          ].map((field) => (
            <div key={field.key}>
              <label htmlFor={`anamnese-${field.key}`} className={labelClassName}>
                {field.label} <span className="normal-case tracking-normal text-zinc-500">(opcional)</span>
              </label>
              <textarea
                id={`anamnese-${field.key}`}
                value={answers[field.key]}
                maxLength={TEXT_LIMIT}
                rows={1}
                onChange={(event) => set({ [field.key]: event.target.value })}
                placeholder={field.placeholder}
                className={cn(fieldClassName, 'block max-h-40 resize-none [field-sizing:content]')}
              />
            </div>
          ))}
        </section>

        <section aria-labelledby="habits-title" className="space-y-4">
          <h3 id="habits-title" className={sectionTitle}>
            Hábitos
          </h3>
          <fieldset>
            <legend className={labelClassName}>Atividade física hoje</legend>
            <div className="grid grid-cols-2 gap-2">
              {ACTIVITY_LEVELS.map((level) => (
                <label key={level.key} className={cn(chipClassName, 'h-auto flex-col gap-0 rounded-2xl py-2.5')}>
                  <input type="radio" name="anamnese-activity" checked={answers.activity === level.key} onChange={() => set({ activity: level.key })} className="sr-only" />
                  <span>{level.label}</span>
                  <span className="text-[10px] font-semibold opacity-70">{level.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="anamnese-sleep" className={labelClassName}>
                Sono por noite
              </label>
              <select
                id="anamnese-sleep"
                value={answers.sleep ?? ''}
                onChange={(event) => set({ sleep: event.target.value ? Number(event.target.value) : null })}
                className={cn(fieldClassName, 'h-12 py-0')}
              >
                <option value="">—</option>
                {[4, 5, 6, 7, 8, 9, 10].map((hours) => (
                  <option key={hours} value={hours}>
                    {hours === 10 ? '10 h ou mais' : `${hours} h`}
                  </option>
                ))}
              </select>
            </div>
            <fieldset>
              <legend className={labelClassName}>Fuma?</legend>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'Não', value: false },
                  { label: 'Sim', value: true },
                ].map((option) => (
                  <label key={option.label} className={cn(chipClassName, 'h-12 px-2')}>
                    <input type="radio" name="anamnese-smoker" checked={answers.smoker === option.value} onChange={() => set({ smoker: option.value })} className="sr-only" />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div>
            <label htmlFor="anamnese-notes" className={labelClassName}>
              Algo mais que o treinador deve saber? <span className="normal-case tracking-normal text-zinc-500">(opcional)</span>
            </label>
            <textarea
              id="anamnese-notes"
              value={answers.notes}
              maxLength={TEXT_LIMIT}
              rows={2}
              onChange={(event) => set({ notes: event.target.value })}
              className={cn(fieldClassName, 'block max-h-40 resize-none [field-sizing:content]')}
            />
          </div>
        </section>

        {error && <Alert variant="error">{error}</Alert>}

        <SheetFooter>
          <m.button
            type="submit"
            disabled={saving}
            whileTap={{ scale: 0.98 }}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-white text-sm font-black uppercase tracking-[0.14em] text-black disabled:opacity-60"
          >
            {saving ? <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Salvando" /> : 'Salvar ficha'}
          </m.button>
        </SheetFooter>
      </form>
    </Modal>
  )
}
