import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Link do e-mail de "esqueci minha senha": troca o token por uma sessão (nos
// cookies) e segue para a página pedida em ?next=. Aceita o modelo de e-mail
// com token_hash (funciona em qualquer aparelho) e o padrão com ?code=.
const OTP_TYPES: EmailOtpType[] = ['recovery', 'email', 'signup', 'invite', 'magiclink', 'email_change']

function safeNext(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const next = safeNext(searchParams.get('next'))
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')

  let ok = false
  try {
    const supabase = await createClient()
    if (tokenHash && type && OTP_TYPES.includes(type)) {
      ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error
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
