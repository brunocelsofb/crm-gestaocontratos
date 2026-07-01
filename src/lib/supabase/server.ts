// Client Supabase para Server Components, Server Actions e Route Handlers
//
// NOTA: a forma de ler/escrever cookies dentro de createServerClient
// mudou em versões anteriores do @supabase/ssr (cookies.get/set/remove
// vs getAll/setAll). Verifique qual assinatura sua versão instalada
// espera — não tenho certeza de qual é a atual no momento em que
// você for instalar o pacote.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: 'contract_crm' },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll pode ser chamado de um Server Component, onde
            // não é permitido escrever cookies — isso é esperado e
            // seguro de ignorar se houver um middleware atualizando
            // a sessão (ver middleware.ts).
          }
        },
      },
    }
  )
}
