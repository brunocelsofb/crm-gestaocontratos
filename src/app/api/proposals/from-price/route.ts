import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const body = await req.json()
  const { contract_id, proposal_value, client_name, project_name, margem_pct } = body

  if (!contract_id || !proposal_value) {
    return NextResponse.json({ error: 'contract_id e proposal_value são obrigatórios' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Atualiza o run aberto com o valor da proposta
  const { error: runError } = await supabase
    .from('pipeline_runs')
    .update({ value: proposal_value })
    .eq('contract_id', contract_id)
    .eq('status', 'open')

  // Registra atividade no contrato
  await supabase.from('activities').insert({
    contract_id,
    type: 'price',
    content: `Proposta precificada no ORBIS Price: R$ ${Number(proposal_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /mês${margem_pct ? ` · Margem: ${Number(margem_pct).toFixed(1)}%` : ''}.`,
  })

  if (runError) {
    return NextResponse.json({ error: runError.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, updated_value: proposal_value })
}
