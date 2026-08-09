import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { actor_name } = await req.json()
  const { id } = await params
  const admin = createAdminClient()

  // Busca a proposta para pegar contract_id e control_code
  const { data: proposal } = await admin
    .from('proposals')
    .select('id, contract_id, control_code, workflow_status')
    .eq('id', id)
    .maybeSingle()

  if (!proposal) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })

  // Volta para rascunho E apaga todos os dados de assinatura (invalida legalmente)
  await admin.from('proposals').update({
    workflow_status: 'rascunho',
    client_status: null,
    client_approved_at: null,
    client_approved_by_name: null,
    client_approved_by_cpf: null,
    client_review_token: null, // novo token será gerado quando precisar
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  // Log na timeline
  await admin.from('activities').insert({
    contract_id: proposal.contract_id,
    type: 'system',
    content: `🔄 Proposta ${proposal.control_code} reaberta por ${actor_name}. Assinatura anterior invalidada.`,
    user_id: user.id,
  })

  return NextResponse.json({ ok: true })
}
