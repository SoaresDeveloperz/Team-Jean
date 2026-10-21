'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { KeyRound, LoaderCircle, TimerOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { MIN_PASSWORD, translatePasswordError } from '@/lib/password'
import { Alert } from '@/components/ui/alert'
import { useToast } from '@/components/ui/toast'
import { AuthShell, authCardClassName } from '@/components/account/AuthShell'
import { NewPasswordFields } from '@/components/account/NewPasswordFields'

type PageState = 'checking' | 'ready' | 'expired'

// Chega aqui pelo link do e-mail (já com a sessão criada em /auth/confirm).
export default function ResetPasswordPage() {
  const router = useRouter()
  const toast = useToast()
  const [supabase] = useState(() => createClient())
  const [state, setState] = useState<PageState>('checking')
  const [email, setEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setEmail(data.session?.user.email ?? null)
      setState(data.session ? 'ready' : 'expired')
    })
    return () => {
      active = false
    }
  }, [supabase])

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
    toast({ tone: 'success', title: 'Senha nova salva', description: 'Pronto! Você já está dentro do app.' })
    router.replace('/')
    router.refresh()
  }

  return (
    <AuthShell subtitle="Nova senha">
      <AnimatePresence mode="wait" initial={false}>
        {state === 'checking' ? (
          <m.div key="checking" className="grid h-40 place-items-center" role="status" aria-label="Verificando o link">
            <LoaderCircle className="h-6 w-6 animate-spin text-zinc-400" aria-hidden="true" />
          </m.div>
        ) : state === 'expired' ? (
          <m.section key="expired" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`${authCardClassName} text-center`}>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold-soft text-gold">
              <TimerOff className="h-7 w-7" aria-hidden="true" />
            </span>
            <h2 className="font-display text-2xl font-bold uppercase">Link expirado</h2>
            <p className="text-sm leading-relaxed text-zinc-300">O link de redefinição expirou ou já foi usado. Peça um novo para continuar.</p>
            <Link
              href="/esqueci-senha"
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-white text-xs font-black uppercase tracking-[0.16em] text-black"
            >
              Pedir novo link
            </Link>
          </m.section>
        ) : (
          <m.form key="form" onSubmit={handleSubmit} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={authCardClassName}>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-black">
                <KeyRound className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-white">Crie sua senha nova</h2>
                {email && <p className="mt-0.5 truncate text-xs text-zinc-400">Conta: {email}</p>}
              </div>
            </div>
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
              {saving ? <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Salvando" /> : 'Salvar e entrar'}
            </m.button>
          </m.form>
        )}
      </AnimatePresence>
    </AuthShell>
  )
}
