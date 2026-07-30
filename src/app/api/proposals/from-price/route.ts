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
  const { contract_id, proposal_value, margem_pct, technical_snapshot } = body

  if (!contract_id || !proposal_value) {
    return NextResponse.json({ error: 'contract_id e proposal_value são obrigatórios' }, { status: 400, headers: CORS })
  }

  const supabase = createAdminClient()

  // Atualiza o run aberto com o valor
  await supabase
    .from('pipeline_runs')
    .update({ value: proposal_value })
    .eq('contract_id', contract_id)
    .eq('status', 'open')

  // Salva em proposal_status — sempre atualiza snapshot e valor, preserva o status atual
  const { data: existing } = await supabase
    .from('proposal_status')
    .select('status')
    .eq('contract_id', contract_id)
    .maybeSingle()

  await supabase.from('proposal_status').upsert({
    contract_id,
    status: existing?.status ?? 'rascunho',
    proposal_value,
    technical_snapshot: technical_snapshot ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'contract_id' })

  // Registra atividade
  await supabase.from('activities').insert({
    contract_id,
    type: 'price',
    content: `Proposta precificada no ORBIS Price: R$ ${Number(proposal_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /mês${margem_pct ? ` · Margem: ${Number(margem_pct).toFixed(1)}%` : ''}.`,
  })

  return NextResponse.json({ ok: true }, { headers: CORS })
}
