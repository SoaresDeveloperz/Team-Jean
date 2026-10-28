// Mensagem de WhatsApp para o aluno que sumiu. Contas puras, sem dependências
// (nem alias "@/"), testadas direto no Node (tests/contas-novidades.mjs).
// Privacidade: a mensagem leva só o primeiro nome (nada de saúde, objetivo,
// medidas nem quantos dias o aluno ficou sem treinar). O link não tem telefone (o app não
// guarda esse dado): o WhatsApp abre a lista de contatos com o texto pronto.

const DAY_MS = 86_400_000

// Dias de calendário entre o último treino e hoje (como em "há 3 dias").
export function daysSince(last: Date, now = new Date()) {
  const start = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  return Math.max(0, Math.round((start(now) - start(last)) / DAY_MS))
}

export function firstName(fullName: string | null | undefined) {
  const first = (fullName ?? '').trim().split(/\s+/)[0]
  return first || ''
}

// Mensagem acolhedora, sem cobrança nem contagem de dias: o primeiro passo é pequeno
// ("um treino leve de 20 minutos já vale"). Depois de duas semanas sem treinar,
// diz também que não há pressa.
// "Oi, Maria! Sentimos sua falta por aqui. Quando quiser, um treino leve de 20 minutos já vale. Posso te ajudar a escolher? 💪"
export function comebackMessage(fullName: string | null | undefined, days: number | null) {
  const name = firstName(fullName)
  const greeting = name ? `Oi, ${name}!` : 'Oi!'
  const calm = days !== null && Number.isFinite(days) && days >= 14 ? ' Sem pressa.' : ''
  return `${greeting} Sentimos sua falta por aqui.${calm} Quando quiser, um treino leve de 20 minutos já vale. Posso te ajudar a escolher? 💪`
}

export function whatsappLink(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

export function comebackWhatsappLink(fullName: string | null | undefined, last: Date | null, now = new Date()) {
  return whatsappLink(comebackMessage(fullName, last ? daysSince(last, now) : null))
}
