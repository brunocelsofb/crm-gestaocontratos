import { createClient } from '@/lib/supabase/server'

export async function executeReadTool(name: string, input: Record<string, unknown>): Promise<string> {
  const supabase = await createClient()

  if (name === 'search_contracts') {
    const query = String(input.query ?? '')
    const { data } = await supabase
      .from('contracts')
      .select('id, client_name, process_number')
      .or(`client_name.ilike.%${query}%,process_number.ilike.%${query}%`)
      .limit(10)

    if (!data || data.length === 0) return 'Nenhum contrato encontrado com esse termo.'
    return JSON.stringify(data.map((c) => ({ id: c.id, cliente: c.client_name, processo: c.process_number })))
  }

  if (name === 'search_companies') {
    const query = String(input.query ?? '')
    const { data } = await supabase
      .from('companies')
      .select('id, name, trade_name, cnpj')
      .or(`name.ilike.%${query}%,cnpj.ilike.%${query}%`)
      .limit(10)

    if (!data || data.length === 0) return 'Nenhuma empresa encontrada com esse termo.'
    return JSON.stringify(data)
  }

  if (name === 'get_contract_details') {
    const contractId = String(input.contract_id ?? '')
    const { data: contract } = await supabase.from('contracts').select('*').eq('id', contractId).maybeSingle()
    if (!contract) return 'Contrato não encontrado.'

    const { data: run } = await supabase
      .from('pipeline_runs')
      .select('value, stage_id, pipeline_id')
      .eq('contract_id', contractId)
      .eq('status', 'open')
      .maybeSingle()

    let stageName = null
    let pipelineName = null
    if (run) {
      const { data: stage } = await supabase.from('stages').select('name').eq('id', run.stage_id).maybeSingle()
      const { data: pipeline } = await supabase.from('pipelines').select('name').eq('id', run.pipeline_id).maybeSingle()
      stageName = stage?.name
      pipelineName = pipeline?.name
    }

    return JSON.stringify({
      cliente: contract.client_name,
      processo: contract.process_number,
      funil: pipelineName,
      etapa_atual: stageName,
      valor: run?.value ?? null,
      vigencia_inicio: contract.valid_from,
      vigencia_fim: contract.valid_until,
    })
  }

  if (name === 'list_stale_contracts') {
    const days = Number(input.days ?? 15)
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()

    const { data: openRuns } = await supabase.from('pipeline_runs').select('contract_id').eq('status', 'open')
    const contractIds = [...new Set((openRuns ?? []).map((r) => r.contract_id))]
    if (contractIds.length === 0) return 'Nenhum contrato em aberto.'

    const { data: recentActivities } = await supabase
      .from('activities')
      .select('contract_id')
      .in('contract_id', contractIds)
      .gte('created_at', cutoff)

    const activeIds = new Set((recentActivities ?? []).map((a) => a.contract_id))
    const staleIds = contractIds.filter((id) => !activeIds.has(id))

    if (staleIds.length === 0) return `Nenhum contrato parado há mais de ${days} dias.`

    const { data: staleContracts } = await supabase
      .from('contracts')
      .select('id, client_name')
      .in('id', staleIds.slice(0, 20))

    return JSON.stringify(staleContracts)
  }

  return 'Ferramenta desconhecida.'
}
