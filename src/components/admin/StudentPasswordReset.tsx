'use client'

import { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Copy, KeyRound, Share2 } from 'lucide-react'
import { resetStudentPassword } from '@/app/admin/students/actions'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'

type StudentPasswordResetProps = { studentId: string; studentName: string; email: string | null }

// "Esqueci a senha" pelo treinador: gera uma senha provisória nova e mostra
// para enviar ao aluno (ele troca depois no Perfil).
export function StudentPasswordReset({ studentId, studentName, email }: StudentPasswordResetProps) {
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [password, setPassword] = useState<string | null>(null)
  const firstName = studentName.trim().split(' ')[0] || 'o aluno'

  const generate = async () => {
    setBusy(true)
    try {
      const result = await resetStudentPassword(studentId)
      if (!result.ok || !result.password) {
        toast({ tone: 'error', title: 'Senha não alterada', description: result.message })
        return
      }
      setPassword(result.password)
      setConfirming(false)
    } catch {
      toast({ tone: 'error', title: 'Senha não alterada', description: 'Falha de conexão. Tente de novo.' })
    } finally {
      setBusy(false)
    }
  }

  const share = async () => {
    if (!password) return
    const text = `Sua senha nova do Team Jean:\n${email ? `E-mail: ${email}\n` : ''}Senha: ${password}\n${window.location.origin}/login\n(Troque no Perfil depois de entrar.)`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Senha nova do Team Jean', text })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      toast({ tone: 'success', title: 'Acesso copiado', description: `Cole na conversa com ${firstName}.` })
    } catch {
      toast({ tone: 'error', title: 'Não foi possível copiar', description: 'Anote a senha mostrada.' })
    }
  }

  return (
    <>
      <AnimatePresence initial={false} mode="wait">
        {password ? (
          <m.div
            key="result"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="space-y-3 rounded-2xl border border-brand/30 bg-brand-soft p-4"
            role="status"
          >
            <p className="text-xs font-semibold text-zinc-200">Senha nova de {firstName} (a antiga não funciona mais):</p>
            <p className="select-all text-center font-mono text-2xl font-bold tracking-[0.2em] text-white">{password}</p>
            <button
              type="button"
              onClick={() => void share()}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-xs font-black uppercase tracking-wider text-black"
            >
              {typeof navigator !== 'undefined' && 'share' in navigator ? (
                <Share2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              Enviar para {firstName}
            </button>
          </m.div>
        ) : (
          <m.button
            key="button"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setConfirming(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line py-3 text-xs font-bold text-zinc-300 hover:text-white"
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> Gerar senha nova
          </m.button>
        )}
      </AnimatePresence>
      <ConfirmDialog
        open={confirming}
        title="Gerar senha nova?"
        description={`A senha atual de ${firstName} para de funcionar. Use quando o aluno esquecer a senha.`}
        confirmLabel="Gerar senha"
        tone="default"
        busy={busy}
        onConfirm={() => void generate()}
        onClose={() => setConfirming(false)}
      />
    </>
  )
}
