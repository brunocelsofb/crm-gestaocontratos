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
  const { contract_id, proposal_value, margem_pct } = body

  if (!contract_id || !proposal_value) {
    return NextResponse.json({ error: 'contract_id e proposal_value são obrigatórios' }, { status: 400, headers: CORS })
  }

  const supabase = createAdminClient()

  await supabase
    .from('pipeline_runs')
    .update({ value: proposal_value })
    .eq('contract_id', contract_id)
    .eq('status', 'open')

  // Salva/atualiza proposal_status para que a aba Proposta no CRM mostre o valor
  await supabase.from('proposal_status').upsert({
    contract_id,
    status: 'rascunho',
    proposal_value,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'contract_id', ignoreDuplicates: false })

  await supabase.from('activities').insert({
    contract_id,
    type: 'price',
    content: `Proposta precificada no ORBIS Price: R$ ${Number(proposal_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /mês${margem_pct ? ` · Margem: ${Number(margem_pct).toFixed(1)}%` : ''}.`,
  })

  return NextResponse.json({ ok: true, updated_value: proposal_value }, { headers: CORS })
}
