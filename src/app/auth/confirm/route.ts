import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Link do e-mail de "esqueci minha senha": troca o token por uma sessão (nos
// cookies) e segue para a tela de nova senha. Aceita o modelo de e-mail com
// token_hash (funciona em qualquer aparelho) e o padrão com ?code=. Só serve
// para recuperar a senha: outro ?type= volta ao login e ?next= só pode ser a
// tela de nova senha (nada de mandar a pessoa logada para outro lugar).
const RECOVERY_TYPE: EmailOtpType = 'recovery'
const RECOVERY_PAGE = '/redefinir-senha'

function safeNext(value: string | null) {
  const path = value && value.startsWith('/') && !value.startsWith('//') ? value : null
  return path === RECOVERY_PAGE ? path : RECOVERY_PAGE
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const next = safeNext(searchParams.get('next'))
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const code = searchParams.get('code')

  let ok = false
  try {
    const supabase = await createClient()
    if (type !== null && type !== RECOVERY_TYPE) {
      ok = false
    } else if (tokenHash) {
      ok = type === RECOVERY_TYPE && !(await supabase.auth.verifyOtp({ type: RECOVERY_TYPE, token_hash: tokenHash })).error
    } else if (code) {
      ok = !(await supabase.auth.exchangeCodeForSession(code)).error
    }
  } catch {
    ok = false
  }

  const target = request.nextUrl.clone()
  target.search = ''
  if (ok) {
    target.pathname = next
  } else {
    target.pathname = '/login'
    target.searchParams.set('erro', 'link')
  }
  return NextResponse.redirect(target)
}
