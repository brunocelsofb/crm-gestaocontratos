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
  const { contract_id, status, proposal_value, actor_name, actor_email, proposal_id, price_url, comment } = body

  if (!contract_id || !status) {
    return NextResponse.json({ error: 'contract_id e status são obrigatórios' }, { status: 400, headers: CORS })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Tenta pegar usuário logado
  let loggedName = actor_name ?? null
  try {
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      if (profile?.full_name) loggedName = profile.full_name
    }
  } catch { /* externo */ }

  // Monta patch com campos de auditoria por etapa
  const patch: Record<string, unknown> = {
    status,
    actor_name: loggedName,
    actor_email: actor_email ?? null,
    updated_at: now,
  }
  if (proposal_value)  patch.proposal_value = proposal_value
  if (proposal_id)     patch.proposal_id = proposal_id
  if (price_url)       patch.price_url = price_url

  // Registra timestamp e nome por etapa
  if (status === 'em_aprovacao_tecnica') {
    patch.submitted_at = now
    patch.submitted_by_name = loggedName
  }
  if (status === 'aprovado_tecnico') {
    patch.technical_approved_at = now
    patch.technical_approved_by_name = loggedName
    if (comment) patch.technical_comment = comment
  }
  if (status === 'aprovado_comercial') {
    patch.commercial_approved_at = now
    patch.commercial_approved_by_name = loggedName
    if (comment) patch.commercial_comment = comment
  }
  if (status === 'rascunho') {
    // Reset dos campos de auditoria ao voltar para rascunho
    patch.submitted_at = null
    patch.submitted_by_name = null
    patch.technical_approved_at = null
    patch.technical_approved_by_name = null
    patch.commercial_approved_at = null
    patch.commercial_approved_by_name = null
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

  await supabase.from('activities').insert({
    contract_id,
    type: 'proposal',
    content: `${statusLabel[status] ?? status}${loggedName ? ` por ${loggedName}` : ''}${proposal_value ? ` · Valor: R$ ${Number(proposal_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}.`,
  })

  return NextResponse.json({ ok: true }, { headers: CORS })
}
