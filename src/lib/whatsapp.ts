// Mensagem de WhatsApp para o aluno que sumiu. Contas puras, sem dependências
// (nem alias "@/"), testadas direto no Node (tests/contas-novidades.mjs).
// Privacidade: a mensagem leva só o primeiro nome e os dias sem treinar
// (nada de saúde, objetivo ou medidas). O link não tem telefone (o app não
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

// "Oi, Maria! Faz 9 dias que não vejo seu treino. Tudo bem? Bora voltar essa semana? 💪"
// Sem data do último treino (nenhum no período carregado): "Faz um tempo...".
export function comebackMessage(fullName: string | null | undefined, days: number | null) {
  const name = firstName(fullName)
  const greeting = name ? `Oi, ${name}!` : 'Oi!'
  const time =
    days === null || !Number.isFinite(days) || days < 1
      ? 'Faz um tempo'
      : days === 1
        ? 'Faz 1 dia'
        : `Faz ${Math.floor(days)} dias`
  return `${greeting} ${time} que não vejo seu treino. Tudo bem? Bora voltar essa semana? 💪`
}

export function whatsappLink(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

export function comebackWhatsappLink(fullName: string | null | undefined, last: Date | null, now = new Date()) {
  return whatsappLink(comebackMessage(fullName, last ? daysSince(last, now) : null))
}
