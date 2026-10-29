'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { BellRing, LoaderCircle, Send, Share } from 'lucide-react'
import { disablePush, enablePush, readPushStatus, sendTestPush, type PushStatus } from '@/lib/push/client'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/cn'
import { Switch } from '@/components/ui/switch'
import { Tile } from '@/components/ui/tile'
import { useToast } from '@/components/ui/toast'

const HINTS: Record<PushStatus, string> = {
  loading: 'Verificando este aparelho…',
  dev: 'Disponível na versão publicada do app.',
  unsupported: 'Este navegador não recebe notificações push.',
  'ios-install': '',
  unconfigured: 'As notificações push ainda não foram configuradas no servidor.',
  denied: 'Bloqueadas neste aparelho. Para receber avisos do Jean, ative as notificações do Team Jean nos ajustes do celular.',
  off: 'Receba avisos, recados e lembretes mesmo com o app fechado.',
  on: 'Ativadas neste aparelho.',
}

// Liga/desliga as notificações push neste aparelho (aluno e treinador).
export function PushNotificationsTile({ coach = false }: { coach?: boolean }) {
  const toast = useToast()
  const [status, setStatus] = useState<PushStatus>('loading')
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    let active = true
    readPushStatus()
      .then((value) => {
        if (active) setStatus(value)
      })
      .catch(() => {
        if (active) setStatus('unsupported')
      })
    return () => {
      active = false
    }
  }, [])

  const toggle = async (checked: boolean) => {
    setBusy(true)
    try {
      if (checked) {
        const result = await enablePush()
        setStatus(result.status)
        toast({ tone: result.status === 'on' ? 'success' : 'error', title: result.status === 'on' ? 'Notificações ativadas' : 'Não foi possível ativar', description: result.message })
        if (result.status === 'on') haptic(20)
      } else {
        setStatus(await disablePush())
        toast({ tone: 'success', title: 'Notificações desativadas', description: 'Os avisos continuam no sino do app.' })
      }
    } catch (error) {
      toast({ tone: 'error', title: 'Não foi possível mudar as notificações', description: error instanceof Error ? error.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    setTesting(true)
    try {
      const result = await sendTestPush()
      toast({ tone: result.ok ? 'success' : 'error', title: result.ok ? 'Teste enviado' : 'Teste não entregue', description: result.message })
    } finally {
      setTesting(false)
    }
  }

  const canToggle = status === 'on' || status === 'off'
  const hint =
    status === 'unconfigured' && coach
      ? 'Configure as chaves VAPID na Vercel para ativar (veja o README).'
      : HINTS[status]

  return (
    <Tile className="space-y-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors',
            status === 'on' ? 'bg-brand text-black' : 'bg-white/[0.05] text-zinc-300',
          )}
        >
          <BellRing className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Notificações no celular</p>
          <p className="text-xs leading-snug text-zinc-400" aria-live="polite">
            {status === 'ios-install' ? (
              <>
                No iPhone, toque em <Share className="inline h-3 w-3" aria-label="Compartilhar" />, &quot;Adicionar à Tela de
                Início&quot; e abra o app por lá para ativar.
              </>
            ) : (
              hint
            )}
          </p>
        </div>
        {busy ? (
          <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-zinc-400" aria-label="Aguarde" />
        ) : (
          canToggle && <Switch label="Notificações no celular" checked={status === 'on'} onChange={(checked) => void toggle(checked)} />
        )}
      </div>
      <AnimatePresence initial={false}>
        {status === 'on' && (
          <m.div key="test" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <button
              type="button"
              onClick={() => void test()}
              disabled={testing}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white/[0.04] text-xs font-bold text-zinc-200 transition hover:text-white disabled:opacity-60"
            >
              {testing ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              Enviar notificação de teste
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </Tile>
  )
}
