'use server'

import { randomInt } from 'node:crypto'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export type ActionResult = { ok: boolean; message: string }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function translateAuthError(message: string | undefined) {
  const text = (message ?? '').toLowerCase()
  if (text.includes('already') && text.includes('registered')) return 'Já existe uma conta com esse e-mail.'
  if (text.includes('password')) return 'A senha não atende aos requisitos do Supabase (mínimo de 6 caracteres).'
  if (text.includes('email')) return 'E-mail inválido.'
  return message ? `Erro ao cadastrar: ${message}` : 'Erro ao cadastrar o aluno.'
}

// O cadastro precisa rodar no servidor: supabase.auth.signUp() no navegador
// troca a sessão atual pela do aluno recém-criado (o admin era deslogado).
export async function createStudent(input: {
  fullName: string
  email: string
  password: string
}): Promise<ActionResult> {
  await requireAdmin()

  const fullName = input.fullName.trim()
  const email = input.email.trim().toLowerCase()
  const password = input.password

  if (!fullName) return { ok: false, message: 'Informe o nome do aluno.' }
  if (!EMAIL_PATTERN.test(email)) return { ok: false, message: 'Informe um e-mail válido.' }
  if (password.length < 6) return { ok: false, message: 'A senha provisória precisa ter pelo menos 6 caracteres.' }

  let supabaseAdmin: ReturnType<typeof createAdminClient>
  try {
    supabaseAdmin = createAdminClient()
  } catch {
    return {
      ok: false,
      message: 'Cadastro indisponível: configure a variável SUPABASE_SERVICE_ROLE_KEY no servidor (Vercel).',
    }
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: 'student' },
  })

  if (error || !data.user) return { ok: false, message: translateAuthError(error?.message) }

  // Garante o perfil com papel de aluno, mesmo que o trigger do banco não exista.
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: data.user.id, email, full_name: fullName, role: 'student' }, { onConflict: 'id' })

  if (profileError) {
    return { ok: false, message: `Conta criada, mas o perfil não foi salvo: ${profileError.message}` }
  }

  return { ok: true, message: `${fullName} foi cadastrado com sucesso.` }
}

// Senha provisória fácil de ditar: sem caracteres ambíguos (0/O, 1/l).
function generatePassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join('')
}

// O aluno esqueceu a senha e o e-mail de recuperação não chegou: o treinador
// gera uma senha nova (a antiga deixa de funcionar) e envia para ele.
export async function resetStudentPassword(studentId: string): Promise<ActionResult & { password?: string }> {
  await requireAdmin()
  if (typeof studentId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId)) {
    return { ok: false, message: 'Aluno inválido.' }
  }

  let supabaseAdmin: ReturnType<typeof createAdminClient>
  try {
    supabaseAdmin = createAdminClient()
  } catch {
    return { ok: false, message: 'Indisponível: configure a variável SUPABASE_SERVICE_ROLE_KEY no servidor (Vercel).' }
  }

  const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('id, role, full_name').eq('id', studentId).maybeSingle()
  if (profileError) return { ok: false, message: `Não foi possível achar o aluno: ${profileError.message}` }
  if (!profile) return { ok: false, message: 'Aluno não encontrado.' }
  if (String(profile.role ?? '').trim().toLowerCase() === 'admin') {
    return { ok: false, message: 'A senha de um treinador não é trocada por aqui.' }
  }

  const password = generatePassword()
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(studentId, { password })
    if (error) return { ok: false, message: `Não foi possível gerar a senha: ${error.message}` }
  } catch (error) {
    return { ok: false, message: `Não foi possível gerar a senha: ${error instanceof Error ? error.message : 'erro desconhecido'}` }
  }
  return { ok: true, message: `Senha nova de ${profile.full_name || 'aluno'} criada.`, password }
}
