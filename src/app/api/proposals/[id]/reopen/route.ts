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
    .select('id, contract_id, control_code, workflow_status, submitted_by_name, technical_approved_by_name, commercial_approved_by_name')
    .eq('id', id)
    .maybeSingle()

  if (!proposal) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })

  // Volta para rascunho SEM apagar o histórico de aprovações técnica/comercial
  // Apenas a assinatura do cliente é invalidada (questão legal)
  // Os campos técnicos/comerciais ficam como referência histórica
  await admin.from('proposals').update({
    workflow_status: 'rascunho',
    client_status: null,
    client_approved_at: null,
    client_approved_by_name: null,
    client_approved_by_cpf: null,
    client_review_token: null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  // Salva snapshot do ciclo anterior na activities antes de reabrir
  const cycleSnapshot = [
    proposal.submitted_by_name ? `Enviada por: ${proposal.submitted_by_name}` : null,
    proposal.technical_approved_by_name ? `Téc: ${proposal.technical_approved_by_name}` : null,
    proposal.commercial_approved_by_name ? `Com: ${proposal.commercial_approved_by_name}` : null,
  ].filter(Boolean).join(' · ')

  await admin.from('activities').insert({
    contract_id: proposal.contract_id,
    type: 'system',
    content: `🔄 Proposta ${proposal.control_code} reaberta por ${actor_name}. Assinatura anterior invalidada.${cycleSnapshot ? ` Ciclo anterior — ${cycleSnapshot}.` : ''}`,
    metadata: {
      proposal_id: id,
      new_status: 'rascunho',
      actor: actor_name,
      is_reopen: true,
    },
    user_id: user.id,
  })

  return NextResponse.json({ ok: true })
}
