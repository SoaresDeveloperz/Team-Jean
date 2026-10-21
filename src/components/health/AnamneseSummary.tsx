import { CircleCheck, ShieldAlert } from 'lucide-react'
import { ACTIVITY_LEVELS, CONDITIONS, PARQ, type Anamnese } from '@/lib/health'
import { cn } from '@/lib/cn'

// Respostas da ficha de saúde, para ler (ficha do aluno no painel do treinador).
export function AnamneseSummary({ anamnese }: { anamnese: Anamnese }) {
  const { answers } = anamnese
  const yes = PARQ.filter((question) => answers.parq[question.key] === true)
  const conditions = CONDITIONS.filter((condition) => answers.conditions.includes(condition.key))
  const activity = ACTIVITY_LEVELS.find((level) => level.key === answers.activity)
  const details = [
    { label: 'Lesões ou dores', value: answers.injuries },
    { label: 'Cirurgias', value: answers.surgeries },
    { label: 'Remédios', value: answers.medications },
    { label: 'Observações', value: answers.notes },
  ].filter((item) => item.value.trim())

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'flex items-start gap-3 rounded-2xl border p-3.5',
          anamnese.parq_positive ? 'border-danger/30 bg-danger-soft' : 'border-brand/25 bg-brand-soft',
        )}
      >
        {anamnese.parq_positive ? (
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
        ) : (
          <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">{anamnese.parq_positive ? 'PAR-Q com alerta' : 'PAR-Q sem alertas'}</p>
          {yes.length > 0 ? (
            <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-zinc-200">
              {yes.map((question) => (
                <li key={question.key} className="flex gap-1.5">
                  <span className="font-bold text-danger">Sim:</span> {question.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-0.5 text-xs text-zinc-300">Respondeu “não” nas 7 perguntas.</p>
          )}
        </div>
      </div>

      {conditions.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Condições de saúde">
          {conditions.map((condition) => (
            <li key={condition.key} className="rounded-full border border-gold/30 bg-gold-soft px-2.5 py-1 text-[11px] font-bold text-gold">
              {condition.label}
            </li>
          ))}
        </ul>
      )}

      {details.length > 0 && (
        <dl className="space-y-2">
          {details.map((item) => (
            <div key={item.label} className="rounded-2xl bg-black/25 px-3.5 py-2.5">
              <dt className="text-[9px] font-black uppercase tracking-wider text-zinc-500">{item.label}</dt>
              <dd className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-zinc-200">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Atividade', value: activity ? `${activity.label}${activity.key === 'sedentario' ? '' : '/sem'}` : '—' },
          { label: 'Sono', value: answers.sleep ? `${answers.sleep}${answers.sleep >= 10 ? '+' : ''} h` : '—' },
          { label: 'Fuma', value: answers.smoker === null ? '—' : answers.smoker ? 'Sim' : 'Não' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-line bg-black/20 px-2 py-2.5">
            <dt className="text-[9px] font-black uppercase tracking-wider text-zinc-500">{item.label}</dt>
            <dd className="mt-0.5 text-sm font-bold text-white">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
