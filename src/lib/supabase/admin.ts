import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// ⚠️ Este cliente usa a chave service_role, que IGNORA todo o RLS.
// Só deve ser usado em Server Actions que já checaram manualmente que
// o usuário atual é admin — nunca exponha isso a um Client Component,
// nunca importe este arquivo fora de código server-only.
//
// NOTA DE INCERTEZA: não testei ao vivo a chamada supabase.auth.admin.*
// (preciso de um projeto Supabase real para isso, que não tenho aqui).
// A API é a que eu conheço do supabase-js, mas confirme se der erro.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: 'contract_crm' },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )
}
