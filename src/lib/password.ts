// Regras e mensagens de senha (troca no Perfil e "esqueci minha senha").

export const MIN_PASSWORD = 6

export const STRENGTH = [
  { label: 'Muito curta', className: 'text-danger', bar: 'bg-danger' },
  { label: 'Fraca', className: 'text-danger', bar: 'bg-danger' },
  { label: 'Boa', className: 'text-gold', bar: 'bg-gold' },
  { label: 'Forte', className: 'text-brand', bar: 'bg-brand' },
]

// 0 = abaixo do mínimo; 1..3 = fraca, boa, forte.
export function passwordStrength(value: string) {
  if (value.length < MIN_PASSWORD) return 0
  let score = 1
  if (value.length >= 10) score += 1
  if (/[a-z]/.test(value) && /[A-Z0-9]/.test(value) && /[^a-z]/.test(value)) score += 1
  return Math.min(3, score)
}

export function translatePasswordError(message: string) {
  const text = message.toLowerCase()
  if (text.includes('different from the old')) return 'A nova senha precisa ser diferente da atual.'
  if (text.includes('at least') || text.includes('weak')) return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`
  if (text.includes('reauthentication') || text.includes('nonce')) {
    return 'Por segurança, saia e entre de novo no app antes de trocar a senha.'
  }
  if (text.includes('session') || text.includes('jwt')) return 'O link expirou. Peça um novo em "Esqueci minha senha".'
  return `Não foi possível trocar a senha: ${message}`
}
