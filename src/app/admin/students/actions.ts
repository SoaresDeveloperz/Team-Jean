'use server'

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
