'use client'

import { useCallback, useState } from 'react'
import { m } from 'framer-motion'
import { ChevronRight, KeyRound, LoaderCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { MIN_PASSWORD, translatePasswordError } from '@/lib/password'
import { Alert } from '@/components/ui/alert'
import { NewPasswordFields } from './NewPasswordFields'
import { Modal } from '@/components/ui/modal'
import { Tile } from '@/components/ui/tile'
import { useToast } from '@/components/ui/toast'

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
    if (password.length < MIN_PASSWORD) return setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`)
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
          <NewPasswordFields
            password={password}
            confirmation={confirmation}
            visible={visible}
            onPasswordChange={(value) => {
              setPassword(value)
              setError('')
            }}
            onConfirmationChange={(value) => {
              setConfirmation(value)
              setError('')
            }}
            onToggleVisible={() => setVisible((value) => !value)}
          />

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
