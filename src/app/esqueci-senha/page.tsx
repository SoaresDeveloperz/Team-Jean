'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, m } from 'framer-motion'
import { ArrowLeft, LoaderCircle, Mail, MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Alert } from '@/components/ui/alert'
import { AuthShell, authCardClassName } from '@/components/account/AuthShell'

const inputClassName =
  'w-full rounded-2xl border border-line-strong bg-black/40 py-3.5 pl-11 pr-4 text-sm font-medium text-white transition-all placeholder:text-zinc-600 focus:border-brand focus:outline-none'

function translateResetError(message: string, status?: number) {
  const text = message.toLowerCase()
  if (status === 429 || text.includes('rate limit') || text.includes('security purposes')) return 'Aguarde um minuto antes de pedir outro link.'
  if (text.includes('fetch') || text.includes('network')) return 'Sem conexão. Verifique sua internet.'
  if ((status ?? 0) >= 500 || text.includes('sending') || text.includes('not authorized')) return 'Não conseguimos enviar o e-mail agora. Peça ajuda ao seu treinador para entrar.'
  if (text.includes('email')) return 'Confira o e-mail digitado.'
  return 'Não foi possível enviar o link agora. Tente de novo em instantes.'
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSending(true)
    try {
      const address = email.trim()
      const { error: resetError } = await createClient().auth.resetPasswordForEmail(address, {
        redirectTo: `${window.location.origin}/auth/confirm?next=/redefinir-senha`,
      })
      if (resetError) {
        setError(translateResetError(resetError.message, resetError.status))
        return
      }
      // Mesmo sem conta com esse e-mail a resposta é igual (não revela quem é aluno).
      setSentTo(address)
    } catch {
      setError('Sem conexão. Verifique sua internet.')
    } finally {
      setSending(false)
    }
  }

  return (
    <AuthShell
      subtitle="Recuperar acesso"
      footer={
        <Link href="/login" className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 transition hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Voltar para o login
        </Link>
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {sentTo ? (
          <m.section
            key="sent"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`${authCardClassName} text-center`}
            aria-labelledby="sent-title"
          >
            <m.span
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 16 }}
              className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand text-black"
            >
              <MailCheck className="h-7 w-7" aria-hidden="true" />
            </m.span>
            <h2 id="sent-title" className="font-display text-2xl font-bold uppercase">
              Confira seu e-mail
            </h2>
            <p className="text-sm leading-relaxed text-zinc-300" role="status">
              Se existir uma conta com <span className="font-bold text-white">{sentTo}</span>, chega em instantes um link para criar
              uma senha nova. Olhe também a caixa de spam.
            </p>
            <p className="rounded-2xl border border-line bg-black/30 p-3 text-[11px] leading-relaxed text-zinc-400">
              Não chegou? Peça ao seu treinador: ele gera uma senha nova para você na hora.
            </p>
            <button
              type="button"
              onClick={() => setSentTo(null)}
              className="h-11 w-full rounded-2xl border border-line-strong text-xs font-bold uppercase tracking-wider text-zinc-200"
            >
              Usar outro e-mail
            </button>
          </m.section>
        ) : (
          <m.form key="form" onSubmit={handleSubmit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={authCardClassName}>
            <div>
              <h2 className="text-base font-bold text-white">Esqueceu a senha?</h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">Digite o e-mail da sua conta e enviamos um link para criar uma senha nova.</p>
            </div>
            <div className="space-y-1">
              <label htmlFor="reset-email" className="block text-[10px] font-black uppercase tracking-wider text-zinc-400">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-4 h-4 w-4 text-zinc-500" aria-hidden="true" />
                <input
                  id="reset-email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seu@email.com"
                  className={inputClassName}
                />
              </div>
            </div>

            {error && <Alert variant="error">{error}</Alert>}

            <button
              type="submit"
              disabled={sending}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-white text-sm font-black uppercase tracking-[0.16em] text-black transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-70"
            >
              {sending ? <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Enviando" /> : 'Enviar link'}
            </button>
          </m.form>
        )}
      </AnimatePresence>
    </AuthShell>
  )
}
