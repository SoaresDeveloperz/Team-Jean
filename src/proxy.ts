import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Só para quem não entrou (quem já está logado vai para o início).
const GUEST_PATHS = ['/login', '/esqueci-senha']
// Abertas com ou sem login: o link do e-mail de nova senha e o cron (protegido
// pelo CRON_SECRET).
const OPEN_PATHS = ['/auth/confirm', '/redefinir-senha', '/api/cron']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // Sem configuração, deixa a página carregar e exibir o erro descritivo.
  if (!url || !anonKey) return response

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  // Renova a sessão e faz a checagem otimista de login. A checagem de papel
  // (admin x aluno) acontece nos layouts, e a proteção dos dados no RLS.
  const { data } = await supabase.auth.getClaims()
  const isLoggedIn = Boolean(data?.claims)
  const { pathname } = request.nextUrl
  const matches = (path: string) => pathname === path || pathname.startsWith(`${path}/`)

  if (OPEN_PATHS.some(matches)) return response

  const isGuestPage = GUEST_PATHS.some(matches)
  if (!isLoggedIn && !isGuestPage) {
    return redirectWithCookies(request, response, '/login')
  }

  if (isLoggedIn && isGuestPage) {
    return redirectWithCookies(request, response, '/')
  }

  return response
}

function redirectWithCookies(request: NextRequest, source: NextResponse, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  const redirect = NextResponse.redirect(url)
  source.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  return redirect
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|offline\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
