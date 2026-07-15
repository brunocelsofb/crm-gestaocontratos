// Middleware: renova a sessão do Supabase a cada request e
// redireciona usuários não autenticados para /login.
//
// NOTA: mesma ressalva do server.ts — confirme a assinatura atual
// de createServerClient/getAll/setAll na documentação do Supabase.

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
                       request.nextUrl.pathname.startsWith('/register')

  // Rota pública: a pesquisa de NPS é respondida por clientes externos,
  // que não têm (e não devem precisar de) conta no sistema.
  const isPublicRoute = request.nextUrl.pathname.startsWith('/nps/') || request.nextUrl.pathname.startsWith('/survey/') || request.nextUrl.pathname.startsWith('/proposal/') || request.nextUrl.pathname.includes('/pdf/public') || request.nextUrl.pathname.startsWith('/captura') || request.nextUrl.pathname.startsWith('/suporte') || request.nextUrl.pathname.startsWith('/acompanhar-ticket') || request.nextUrl.pathname.startsWith('/avaliar-atendimento')

  // Usuário não logado tentando acessar área protegida -> manda para login
  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Usuário já logado tentando acessar login/register -> manda pro dashboard
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Aplica o middleware em todas as rotas, exceto:
     * - arquivos estáticos do Next (_next/static, _next/image)
     * - favicon
     * Ajuste esse padrão se adicionar outras pastas públicas (ex: /api/webhooks)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
