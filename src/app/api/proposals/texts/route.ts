import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { contract_id, texto_objetivos, texto_atividades, texto_estrutura_apoio } = await req.json()
  if (!contract_id) return NextResponse.json({ error: 'contract_id obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  await admin.from('proposal_status').upsert({
    contract_id,
    texto_objetivos,
    texto_atividades,
    texto_estrutura_apoio,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'contract_id' })

  return NextResponse.json({ ok: true })
}
