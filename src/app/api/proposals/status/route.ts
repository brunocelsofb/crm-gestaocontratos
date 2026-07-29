import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  await supabase.from('proposal_status').upsert({
    contract_id,
    status,
    proposal_value: proposal_value ?? null,
    proposal_id: proposal_id ?? null,
    price_url: price_url ?? null,
    actor_name: actor_name ?? null,
    actor_email: actor_email ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'contract_id' })

  if (proposal_value) {
    await supabase.from('pipeline_runs')
      .update({ value: proposal_value })
      .eq('contract_id', contract_id)
      .eq('status', 'open')
  }

  const statusLabel: Record<string, string> = {
    aprovado_comercial:     '✅ Proposta aprovada comercialmente',
    aprovado_tecnico:       '🔧 Proposta aprovada tecnicamente',
    reprovado_tecnico:      '❌ Proposta reprovada tecnicamente',
    em_aprovacao_tecnica:   '⏳ Proposta enviada para aprovação técnica',
    em_aprovacao_comercial: '⏳ Proposta enviada para aprovação comercial',
  }

  await supabase.from('activities').insert({
    contract_id,
    type: 'proposal',
    content: `${statusLabel[status] ?? status}${actor_name ? ` por ${actor_name}` : ''}${proposal_value ? ` · Valor: R$ ${Number(proposal_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}.`,
  })

  return NextResponse.json({ ok: true }, { headers: CORS })
}
