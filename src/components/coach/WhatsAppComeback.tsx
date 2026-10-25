import { MessageCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { comebackWhatsappLink, firstName } from '@/lib/whatsapp'

type WhatsAppComebackProps = {
  fullName: string | null | undefined
  // Último treino concluído (null: nenhum no período carregado).
  last: Date | null
  className?: string
}

// Botão "WhatsApp" para chamar de volta o aluno que sumiu. Sem telefone: o
// WhatsApp abre a lista de contatos com a mensagem pronta (só nome e dias).
export function WhatsAppComeback({ fullName, last, className }: WhatsAppComebackProps) {
  const name = firstName(fullName) || 'aluno'
  return (
    <a
      href={comebackWhatsappLink(fullName, last)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chamar ${name} no WhatsApp`}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border border-brand/40 bg-brand-soft px-3 text-xs font-black uppercase text-brand transition hover:bg-brand hover:text-black',
        className,
      )}
    >
      <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> WhatsApp
    </a>
  )
}
