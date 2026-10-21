'use client'

import { m } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'
import { MIN_PASSWORD, STRENGTH, passwordStrength } from '@/lib/password'
import { cn } from '@/lib/cn'

const inputClassName =
  'w-full rounded-2xl border border-line-strong bg-black/40 p-3.5 pr-12 text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none'
const labelClassName = 'mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400'

type NewPasswordFieldsProps = {
  password: string
  confirmation: string
  visible: boolean
  onPasswordChange: (value: string) => void
  onConfirmationChange: (value: string) => void
  onToggleVisible: () => void
}

// Nova senha + confirmação, com medidor de força (Perfil e "esqueci minha senha").
export function NewPasswordFields({
  password,
  confirmation,
  visible,
  onPasswordChange,
  onConfirmationChange,
  onToggleVisible,
}: NewPasswordFieldsProps) {
  const strength = passwordStrength(password)
  const strengthInfo = STRENGTH[strength]
  const mismatch = confirmation.length > 0 && confirmation !== password

  return (
    <>
      <div>
        <label htmlFor="new-password" className={labelClassName}>
          Nova senha
        </label>
        <div className="relative">
          <input
            id="new-password"
            type={visible ? 'text' : 'password'}
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            aria-describedby="new-password-strength"
            placeholder={`Mínimo de ${MIN_PASSWORD} caracteres`}
            className={inputClassName}
          />
          <button
            type="button"
            onClick={onToggleVisible}
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
          onChange={(event) => onConfirmationChange(event.target.value)}
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
    </>
  )
}
