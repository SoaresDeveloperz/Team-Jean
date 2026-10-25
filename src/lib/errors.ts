// Traduz erros (rede, Supabase, banco) para frases curtas em português, sem
// jargão. A tela nunca mostra "TypeError: Failed to fetch" nem código do banco.

export const NETWORK_MESSAGE = 'Sem internet agora. Tente de novo.'
export const RETRY_MESSAGE = 'Tente de novo.'
const SESSION_MESSAGE = 'Sua sessão expirou. Entre de novo.'
const PERMISSION_MESSAGE = 'Você não tem permissão para fazer isso.'
const SLOW_MESSAGE = 'O servidor demorou para responder. Tente de novo.'
const SERVER_MESSAGE = 'O servidor está com problema agora. Tente de novo em alguns minutos.'
const SETUP_MESSAGE = 'Esta parte do app ainda não foi ativada.'

type ErrorLike = {
  name?: unknown
  message?: unknown
  code?: unknown
  details?: unknown
  status?: unknown
  statusCode?: unknown
  __isAuthError?: unknown
  __isStorageError?: unknown
}

// Chrome, Firefox, Safari, Node e o supabase-js escrevem a falta de rede de jeitos diferentes.
const NETWORK_PATTERN =
  /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet_disconnected|err_network|err_connection|internet connection appears to be offline|authretryablefetcherror/i

const CODE_MESSAGES: Record<string, string> = {
  PGRST301: SESSION_MESSAGE,
  PGRST302: SESSION_MESSAGE,
  PGRST116: 'Não encontramos o que você procurou.',
  PGRST202: SETUP_MESSAGE,
  PGRST204: SETUP_MESSAGE,
  PGRST205: SETUP_MESSAGE,
  '42P01': SETUP_MESSAGE,
  '42703': SETUP_MESSAGE,
  '42883': SETUP_MESSAGE,
  '42501': PERMISSION_MESSAGE,
  '23505': 'Isso já está cadastrado.',
  '23503': 'Este item está ligado a outros dados e não pode ser apagado.',
  '23514': 'Algum valor está fora do permitido. Confira os campos.',
  '23502': 'Falta preencher um campo obrigatório.',
  '22001': 'Algum texto passou do tamanho máximo.',
  '22003': 'Algum número está fora do permitido.',
  '22P02': 'Algum valor está num formato inválido.',
  '57014': SLOW_MESSAGE,
}

const MESSAGE_RULES: [RegExp, string][] = [
  [/jwt expired|invalid jwt|refresh token|session (?:expired|missing|not found)|auth session missing/i, SESSION_MESSAGE],
  [/row-level security|permission denied|not allowed|unauthorized/i, PERMISSION_MESSAGE],
  [/timeout|timed out/i, SLOW_MESSAGE],
  [/maximum allowed size|payload too large|too large/i, 'O arquivo é grande demais.'],
  [/mime type|invalid_mime_type/i, 'Este tipo de arquivo não é aceito.'],
  [/resource already exists|duplicate/i, 'Isso já está cadastrado.'],
  [/schema cache|does not exist/i, SETUP_MESSAGE],
]

function asErrorLike(error: unknown): ErrorLike | null {
  return error && typeof error === 'object' ? (error as ErrorLike) : null
}

const text = (value: unknown) => (typeof value === 'string' ? value : '')

export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export function isNetworkError(error: unknown) {
  if (isOffline()) return true
  if (typeof error === 'string') return NETWORK_PATTERN.test(error)
  const item = asErrorLike(error)
  if (!item) return false
  // O supabase-js devolve status 0 quando o pedido nem chegou ao servidor.
  if (item.status === 0) return true
  return NETWORK_PATTERN.test(`${text(item.name)} ${text(item.message)} ${text(item.details)}`)
}

// Erro de biblioteca (Supabase, navegador) que não pode ir para a tela como está.
function isTechnical(item: ErrorLike, error: unknown) {
  if (text(item.code) || item.__isAuthError || item.__isStorageError) return true
  if (/postgrest|storage|auth|typeerror|syntaxerror|rangeerror|referenceerror/i.test(text(item.name))) return true
  if (error instanceof TypeError || error instanceof SyntaxError || error instanceof RangeError || error instanceof ReferenceError) return true
  // Objetos crus ({ message, code }) também vêm do Supabase.
  return !(error instanceof Error)
}

// O motivo, em uma frase curta. Mensagens que o próprio app já escreveu em
// português (new Error('Treino não encontrado.')) passam como estão.
export function errorReason(error: unknown): string {
  if (isNetworkError(error)) return NETWORK_MESSAGE
  const item = asErrorLike(error)
  if (!item) return typeof error === 'string' && error.trim() ? error : RETRY_MESSAGE

  const code = text(item.code)
  // Gatilhos e funções do banco (raise exception) já falam português.
  if (code === 'P0001' && text(item.message)) return text(item.message)
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code]

  const message = text(item.message)
  if (!isTechnical(item, error)) return message.trim() || RETRY_MESSAGE

  for (const [pattern, friendly] of MESSAGE_RULES) {
    if (pattern.test(message)) return friendly
  }
  const status = Number(item.status ?? item.statusCode)
  if (status === 401) return SESSION_MESSAGE
  if (status === 403) return PERMISSION_MESSAGE
  if (status >= 500) return SERVER_MESSAGE
  return RETRY_MESSAGE
}

// "O que não deu certo" + motivo: "Não foi possível carregar seu treino. Sem internet agora. Tente de novo."
export function friendlyError(error: unknown, prefix?: string): string {
  const reason = errorReason(error)
  if (!prefix) return reason
  const head = prefix.trim().replace(/[.:;,\s]+$/, '')
  return `${head}. ${reason}`
}

// Sem sessão no aparelho: sem internet (o login não renovou) ou login vencido.
export const MISSING_SESSION = { status: 401, message: 'auth session missing' }
