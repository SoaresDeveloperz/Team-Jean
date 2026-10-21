'use client'

import { useState } from 'react'
import { m } from 'framer-motion'
import { LoaderCircle, QrCode } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PIX_KEY_TYPES, guessPixKeyType, normalizePixKey, saveSettings, type CoachSettings, type PixKeyType } from '@/lib/finance'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/toast'
import { Eyebrow, Tile } from '@/components/ui/tile'

const labelClassName = 'mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400'
const fieldClassName =
  'h-12 w-full rounded-2xl border border-line-strong bg-black/40 px-4 text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none'
const chipClassName =
  'flex h-9 cursor-pointer items-center justify-center rounded-full border border-line px-3 text-[11px] font-bold text-zinc-300 transition hover:text-white has-[:checked]:border-white has-[:checked]:bg-white has-[:checked]:text-black has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand'

// Chave PIX do treinador (vira o "copia e cola" no Perfil do aluno) e o
// lembrete automático no vencimento.
export function PixSettingsCard({ settings, onSaved }: { settings: CoachSettings | null; onSaved: (settings: CoachSettings) => void }) {
  const [supabase] = useState(() => createClient())
  const toast = useToast()
  const [type, setType] = useState<PixKeyType>(() => guessPixKeyType(settings?.pix_key))
  const [key, setKey] = useState(settings?.pix_key ?? '')
  const [name, setName] = useState(settings?.pix_name ?? '')
  const [city, setCity] = useState(settings?.pix_city ?? '')
  const [reminders, setReminders] = useState(settings?.billing_reminders ?? false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const placeholder = PIX_KEY_TYPES.find((item) => item.value === type)?.placeholder

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    const normalized = key.trim() ? normalizePixKey(type, key) : null
    if (key.trim() && !normalized) return setError('Chave PIX inválida para o tipo escolhido.')
    if (normalized && (!name.trim() || !city.trim())) return setError('Informe o nome e a cidade do recebedor (aparecem no app do banco).')
    setSaving(true)
    setError('')
    try {
      const saved = await saveSettings(supabase, {
        pix_key: normalized,
        pix_name: name.trim().slice(0, 25) || null,
        pix_city: city.trim().slice(0, 15) || null,
        billing_reminders: reminders,
      })
      setKey(saved.pix_key ?? '')
      onSaved(saved)
      toast({ tone: 'success', title: 'PIX salvo', description: saved.pix_key ? 'Os alunos já podem copiar o PIX no Perfil.' : undefined })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Tile>
      <form onSubmit={save} className="space-y-4">
        <div>
          <h2>
            <Eyebrow icon={QrCode}>Recebimento por PIX</Eyebrow>
          </h2>
          <p className="mt-1.5 text-xs text-zinc-400">O aluno copia o PIX com o valor da mensalidade direto do Perfil.</p>
        </div>
        <fieldset>
          <legend className={labelClassName}>Tipo da chave</legend>
          <div className="flex flex-wrap gap-1.5">
            {PIX_KEY_TYPES.map((option) => (
              <label key={option.value} className={chipClassName}>
                <input type="radio" name="pix-type" checked={type === option.value} onChange={() => setType(option.value)} className="sr-only" />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="pix-key" className={labelClassName}>
            Chave PIX
          </label>
          <input
            id="pix-key"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder={placeholder}
            inputMode={type === 'email' || type === 'random' ? 'text' : 'numeric'}
            autoComplete="off"
            className={fieldClassName}
          />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-3">
          <div>
            <label htmlFor="pix-name" className={labelClassName}>
              Nome do recebedor
            </label>
            <input id="pix-name" value={name} maxLength={25} onChange={(event) => setName(event.target.value)} placeholder="Jean Treinador" className={fieldClassName} />
          </div>
          <div>
            <label htmlFor="pix-city" className={labelClassName}>
              Cidade
            </label>
            <input id="pix-city" value={city} maxLength={15} onChange={(event) => setCity(event.target.value)} placeholder="São Paulo" className={fieldClassName} />
          </div>
        </div>
        <div className={cn('flex items-center justify-between gap-3 rounded-2xl border p-4', reminders ? 'border-brand/30 bg-brand-soft' : 'border-line bg-black/20')}>
          <div>
            <p className="text-sm font-bold text-white">Lembrete automático</p>
            <p className="text-[11px] text-zinc-400">3 dias antes, no dia e 3 dias depois do vencimento (aviso + push).</p>
          </div>
          <Switch label="Lembrete automático da mensalidade" checked={reminders} onChange={setReminders} />
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        <m.button
          type="submit"
          disabled={saving}
          whileTap={{ scale: 0.98 }}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-white text-xs font-black uppercase tracking-[0.14em] text-black disabled:opacity-60"
        >
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-label="Salvando" /> : 'Salvar recebimento'}
        </m.button>
      </form>
    </Tile>
  )
}
