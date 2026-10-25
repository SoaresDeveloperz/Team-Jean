'use client'

import { useState } from 'react'
import { m } from 'framer-motion'
import { AtSign, LoaderCircle } from 'lucide-react'
import {
  BIO_MAX,
  GOALS,
  PROFILE_SETUP_MESSAGE,
  ProfileError,
  isValidInstagram,
  normalizeInstagram,
  type ProfileDetails,
} from '@/lib/profile'
import { cn } from '@/lib/cn'
import { Alert } from '@/components/ui/alert'
import { Modal, SheetFooter } from '@/components/ui/modal'
import { friendlyError } from '@/lib/errors'

type EditableFields = Pick<ProfileDetails, 'full_name' | 'bio' | 'goal' | 'instagram'>

type EditProfileSheetProps = {
  open: boolean
  profile: EditableFields
  onClose: () => void
  // Recebe só o que mudou.
  onSave: (patch: Partial<EditableFields>) => Promise<void>
}

const inputClassName =
  'w-full rounded-2xl border border-line-strong bg-black/40 p-3.5 text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none'
const labelClassName = 'mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400'

// Os campos começam com o perfil atual: o componente é montado de novo a
// cada abertura (key no pai), então não precisa sincronizar estado.
export function EditProfileSheet({ open, profile, onClose, onSave }: EditProfileSheetProps) {
  const [name, setName] = useState(profile.full_name ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [goal, setGoal] = useState(profile.goal ?? '')
  const [instagram, setInstagram] = useState(profile.instagram ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    const fullName = name.trim()
    const handle = normalizeInstagram(instagram)
    if (!fullName) return setError('Informe seu nome.')
    if (handle && !isValidInstagram(handle)) return setError('Instagram inválido: use só o @usuário (letras, números, ponto e _).')

    const next: EditableFields = {
      full_name: fullName,
      bio: bio.trim() || null,
      goal: goal || null,
      instagram: handle || null,
    }
    const patch: Partial<EditableFields> = {}
    for (const key of Object.keys(next) as (keyof EditableFields)[]) {
      if ((next[key] ?? null) !== (profile[key] ?? null)) patch[key] = next[key]
    }
    if (Object.keys(patch).length === 0) return onClose()

    setSaving(true)
    try {
      await onSave(patch)
    } catch (saveError) {
      if (saveError instanceof ProfileError && saveError.missing) setError(PROFILE_SETUP_MESSAGE)
      else setError(friendlyError(saveError, 'Não foi possível salvar'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={saving ? () => undefined : onClose} variant="sheet" title="Editar perfil" description="Seu treinador também vê estes dados.">
      <form onSubmit={save} className="space-y-5">
        <div>
          <label htmlFor="profile-name" className={labelClassName}>
            Nome
          </label>
          <input
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            autoComplete="name"
            className={inputClassName}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-end justify-between">
            <label htmlFor="profile-bio" className={cn(labelClassName, 'mb-0')}>
              Bio
            </label>
            <span aria-hidden="true" className={cn('text-[10px] font-bold tabular-nums', bio.length > BIO_MAX * 0.9 ? 'text-gold' : 'text-zinc-500')}>
              {bio.length}/{BIO_MAX}
            </span>
          </div>
          <textarea
            id="profile-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            maxLength={BIO_MAX}
            rows={3}
            placeholder="Ex: Rumo aos 100 kg no supino 💪"
            className={cn(inputClassName, 'resize-none leading-relaxed')}
          />
        </div>

        <fieldset>
          <legend className={labelClassName}>Objetivo</legend>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((option) => (
              <label
                key={option.value}
                className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-line px-3.5 text-xs font-bold text-zinc-300 transition hover:text-white has-[:checked]:border-brand/60 has-[:checked]:bg-brand-soft has-[:checked]:text-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand"
              >
                <input
                  type="radio"
                  name="profile-goal"
                  value={option.value}
                  checked={goal === option.value}
                  onChange={() => setGoal(option.value)}
                  className="sr-only"
                />
                <span aria-hidden="true">{option.emoji}</span>
                {option.label}
              </label>
            ))}
            {goal && (
              <button
                type="button"
                onClick={() => setGoal('')}
                className="h-10 rounded-full px-3 text-xs font-bold text-zinc-500 hover:text-white"
              >
                Limpar
              </button>
            )}
          </div>
        </fieldset>

        <div>
          <label htmlFor="profile-instagram" className={labelClassName}>
            Instagram
          </label>
          <div className="relative">
            <AtSign className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
            <input
              id="profile-instagram"
              value={instagram}
              // O @ já aparece no ícone; digitar outro não duplica.
              onChange={(event) => setInstagram(event.target.value.replace(/^@+/, ''))}
              placeholder="seu.usuario"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={cn(inputClassName, 'pl-10')}
            />
          </div>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        <SheetFooter>
          <m.button
            type="submit"
            disabled={saving}
            whileTap={{ scale: 0.98 }}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-white text-sm font-black uppercase tracking-[0.14em] text-black disabled:opacity-60"
          >
            {saving ? <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Salvando" /> : 'Salvar perfil'}
          </m.button>
        </SheetFooter>
      </form>
    </Modal>
  )
}
