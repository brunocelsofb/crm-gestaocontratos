// Client Supabase para Client Components ("use client")
//
// NOTA: a API de @supabase/ssr abaixo é a que eu conheço, mas
// confirme contra a documentação atual antes de confiar 100% —
// pacotes de auth desse tipo mudam assinatura com certa frequência.

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'contract_crm' } }
  )
}
