import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: Request) {
  const body = await req.json()
  const { contract_id, status, proposal_value, actor_name, actor_email, proposal_id, price_url } = body

  if (!contract_id || !status) {
    return NextResponse.json({ error: 'contract_id e status são obrigatórios' }, { status: 400, headers: CORS })
  }

  const supabase = createAdminClient()

  // Tenta pegar o usuário logado (quando chamado internamente pelo CRM)
  let loggedUserId: string | null = null
  try {
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    loggedUserId = user?.id ?? null
  } catch { /* chamado externamente, sem sessão */ }

  // Monta o patch de aprovação
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (proposal_value)  patch.proposal_value = proposal_value
  if (proposal_id)     patch.proposal_id = proposal_id
  if (price_url)       patch.price_url = price_url
  if (actor_name)      patch.actor_name = actor_name
  if (actor_email)     patch.actor_email = actor_email
  if (loggedUserId) {
    if (status === 'em_aprovacao_tecnica') patch.submitted_by = loggedUserId
    if (status === 'aprovado_tecnico')     patch.technical_approved_by = loggedUserId
    if (status === 'aprovado_comercial')   patch.commercial_approved_by = loggedUserId
  }

  await supabase.from('proposal_status').upsert(
    { contract_id, ...patch },
    { onConflict: 'contract_id' }
  )

  if (proposal_value) {
    await supabase.from('pipeline_runs')
      .update({ value: proposal_value })
      .eq('contract_id', contract_id)
      .eq('status', 'open')
  }

  const statusLabel: Record<string, string> = {
    aprovado_comercial:     '✅ Proposta aprovada comercialmente',
    aprovado_tecnico:       '🔧 Proposta aprovada tecnicamente',
    reprovado_tecnico:      '❌ Proposta reprovada — retornou para revisão',
    em_aprovacao_tecnica:   '⏳ Proposta enviada para aprovação técnica',
    em_aprovacao_comercial: '⏳ Proposta enviada para aprovação comercial',
    rascunho:               '📝 Proposta retornada para rascunho',
  }

  // Registra atividade
  const actorLabel = actor_name ?? (loggedUserId ? 'usuário do CRM' : null)
  await supabase.from('activities').insert({
    contract_id,
    type: 'proposal',
    content: `${statusLabel[status] ?? status}${actorLabel ? ` por ${actorLabel}` : ''}${proposal_value ? ` · Valor: R$ ${Number(proposal_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}.`,
  })

  // Envia e-mail de alerta para aprovadores quando muda de estado
  if (status === 'em_aprovacao_tecnica' || status === 'em_aprovacao_comercial') {
    const targetRole = status === 'em_aprovacao_tecnica' ? 'aprovador_tecnico' : 'aprovador_comercial'
    const { data: approvers } = await supabase
      .from('profiles')
      .select('id, full_name, email:id')
      .eq('role', targetRole)

    if (approvers && approvers.length > 0) {
      // Busca o contrato para obter o nome do cliente
      const { data: contract } = await supabase
        .from('contracts')
        .select('client_name, title, process_number')
        .eq('id', contract_id)
        .maybeSingle()

      const clientName = contract?.client_name ?? 'Cliente'
      const projectName = contract?.title || contract?.process_number || contract_id

      // Busca e-mails dos aprovadores via auth
      for (const approver of approvers) {
        const { data: authUser } = await supabase.auth.admin.getUserById(approver.id)
        const approverEmail = authUser.user?.email
        if (!approverEmail) continue

        // Envia e-mail via Gmail integrado (organização)
        try {
          await supabase.from('email_queue').insert({
            to: approverEmail,
            subject: `[ORBIS CRM] Proposta aguardando sua aprovação — ${clientName}`,
            body: `Olá ${approver.full_name},\n\nA proposta para <strong>${clientName}</strong> (${projectName}) está aguardando sua aprovação ${status === 'em_aprovacao_tecnica' ? 'técnica' : 'comercial'}.\n\nAcesse o CRM para aprovar ou reprovar:\nhttps://crm-gestaocontratos-pi.vercel.app/contracts/${contract_id}\n\nEquipe ORBIS`,
            contract_id,
          })
        } catch { /* email_queue pode não existir — ok, não bloqueia */ }
      }
    }
  }

  return NextResponse.json({ ok: true }, { headers: CORS })
}
