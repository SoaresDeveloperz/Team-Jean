'use client'

import { useCallback, useState } from 'react'
import { m } from 'framer-motion'
import { ChevronRight, Eye, EyeOff, KeyRound, LoaderCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { Tile } from '@/components/ui/tile'
import { useToast } from '@/components/ui/toast'

const MIN_LENGTH = 6
const STRENGTH = [
  { label: 'Muito curta', className: 'text-danger', bar: 'bg-danger' },
  { label: 'Fraca', className: 'text-danger', bar: 'bg-danger' },
  { label: 'Boa', className: 'text-gold', bar: 'bg-gold' },
  { label: 'Forte', className: 'text-brand', bar: 'bg-brand' },
]

const inputClassName =
  'w-full rounded-2xl border border-line-strong bg-black/40 p-3.5 pr-12 text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none'
const labelClassName = 'mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400'

// 0 = abaixo do mínimo; 1..3 = fraca, boa, forte.
function passwordStrength(value: string) {
  if (value.length < MIN_LENGTH) return 0
  let score = 1
  if (value.length >= 10) score += 1
  if (/[a-z]/.test(value) && /[A-Z0-9]/.test(value) && /[^a-z]/.test(value)) score += 1
  return Math.min(3, score)
}

function translatePasswordError(message: string) {
  const text = message.toLowerCase()
  if (text.includes('different from the old')) return 'A nova senha precisa ser diferente da atual.'
  if (text.includes('at least') || text.includes('weak')) return `A senha precisa ter pelo menos ${MIN_LENGTH} caracteres.`
  if (text.includes('reauthentication') || text.includes('nonce')) {
    return 'Por segurança, saia e entre de novo no app antes de trocar a senha.'
  }
  return `Não foi possível trocar a senha: ${message}`
}

// Item do Perfil para o aluno trocar a senha provisória criada pelo treinador.
export function ChangePasswordTile() {
  const [supabase] = useState(() => createClient())
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  const openModal = () => {
    setPassword('')
    setConfirmation('')
    setVisible(false)
    setError('')
    setOpen(true)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (password.length < MIN_LENGTH) return setError(`A senha precisa ter pelo menos ${MIN_LENGTH} caracteres.`)
    if (password !== confirmation) return setError('As senhas não conferem.')

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) {
      setError(translatePasswordError(updateError.message))
      return
    }
    setOpen(false)
    toast({ tone: 'success', title: 'Senha alterada', description: 'Use a nova senha no próximo login.' })
  }

  const strength = passwordStrength(password)
  const strengthInfo = STRENGTH[strength]
  const mismatch = confirmation.length > 0 && confirmation !== password

  return (
    <>
      <Tile className="p-0">
        <button type="button" onClick={openModal} className="flex w-full items-center gap-3 p-5 text-left">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.05] text-zinc-300">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold text-white">Trocar senha</span>
            <span className="block text-[11px] text-zinc-500">Troque a senha provisória por uma só sua</span>
          </span>
          <ChevronRight className="h-4 w-4 text-zinc-600" aria-hidden="true" />
        </button>
      </Tile>

      <Modal open={open} onClose={close} title="Trocar senha" description="A nova senha vale a partir do próximo login.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className={labelClassName}>
              Nova senha
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={visible ? 'text' : 'password'}
                required
                minLength={MIN_LENGTH}
                autoComplete="new-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError('')
                }}
                aria-describedby="new-password-strength"
                placeholder={`Mínimo de ${MIN_LENGTH} caracteres`}
                className={inputClassName}
              />
              <button
                type="button"
                onClick={() => setVisible((value) => !value)}
                aria-label={visible ? 'Esconder senha' : 'Mostrar senha'}
                className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl text-zinc-500 hover:text-white"
              >
                {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex flex-1 gap-1" aria-hidden="true">
                {[1, 2, 3].map((level) => (
                  <span key={level} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <m.span
                      className={cn('block h-full rounded-full', strengthInfo.bar)}
                      initial={false}
                      animate={{ width: password && strength >= level ? '100%' : '0%' }}
                      transition={{ duration: 0.25 }}
                    />
                  </span>
                ))}
              </div>
              <span
                id="new-password-strength"
                aria-live="polite"
                className={cn('w-20 text-right text-[10px] font-black uppercase tracking-wider', password ? strengthInfo.className : 'text-zinc-500')}
              >
                {password ? strengthInfo.label : 'Força'}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="confirm-password" className={labelClassName}>
              Confirme a nova senha
            </label>
            <input
              id="confirm-password"
              type={visible ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value)
                setError('')
              }}
              aria-invalid={mismatch}
              aria-describedby={mismatch ? 'confirm-password-error' : undefined}
              className={cn(inputClassName, 'pr-3.5', mismatch && 'border-danger/60 focus:border-danger')}
            />
            {mismatch && (
              <p id="confirm-password-error" className="mt-1.5 text-[11px] font-semibold text-danger">
                As senhas não conferem.
              </p>
            )}
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          <m.button
            type="submit"
            disabled={saving}
            whileTap={{ scale: 0.98 }}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-white text-sm font-black uppercase tracking-[0.14em] text-black disabled:opacity-60"
          >
            {saving ? <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Salvando" /> : 'Salvar nova senha'}
          </m.button>
        </form>
      </Modal>
    </>
  )
}
