import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const checks: Record<string, any> = {}

  // 1. View corrigida?
  const { data: viewData, error: viewError } = await supabase
    .from('contracts_with_current_run').select('id, client_name, run_status').limit(10)
  checks.view_statuses = viewData?.map(d => ({ name: d.client_name?.slice(0,30), status: d.run_status }))
  checks.view_error = viewError?.message

  // 2. Tags com coluna context?
  const { data: tagData, error: tagError } = await supabase
    .from('tags').select('name, context').limit(5)
  checks.tags = tagData
  checks.tags_error = tagError?.message

  // 3. Contrato do Matheus
  const { data: matheus } = await supabase
    .from('contracts').select('id, client_name, company_id').ilike('client_name', '%MATHEUS%').limit(5)
  checks.matheus_contracts = matheus?.map(d => ({
    id: d.id.slice(0,8),
    name: d.client_name,
    company_id: d.company_id?.slice(0,8) ?? 'NULL'
  }))

  // 4. Runs do Matheus
  if (matheus?.length) {
    const { data: runs } = await supabase
      .from('pipeline_runs').select('id, status, contract_id, pipeline_id').in('contract_id', matheus.map(m => m.id))
    checks.matheus_runs = runs?.map(r => ({ status: r.status, cid: r.contract_id.slice(0,8) }))
  }

  // 5. Busca pelo CNPJ raiz 66378147
  const { data: byCnpj } = await supabase
    .from('contracts').select('id, client_name, company_id').ilike('client_name', '%66378147%').limit(5)
  checks.by_cnpj_root = byCnpj?.map(d => ({ name: d.client_name, co_id: d.company_id?.slice(0,8) ?? 'NULL' }))

  // 6. Busca pelo nome parcial
  const { data: byName } = await supabase
    .from('contracts').select('id, client_name, company_id').ilike('client_name', '%MATHEUS LUIZ BARBOSA%').limit(5)
  checks.by_name = byName?.map(d => ({ name: d.client_name, co_id: d.company_id?.slice(0,8) ?? 'NULL' }))

  // Debug específico da empresa do Matheus
  const companyId = '255598e0-36e8-4e29-b253-70faee08987b'
  const { data: byCompanyId } = await supabase
    .from('contracts').select('id, client_name, company_id').eq('company_id', companyId).limit(10)
  checks.matheus_by_company_id = byCompanyId?.map(d => ({ name: d.client_name, co_id: d.company_id?.slice(0,8) }))

  const { data: allRuns } = await supabase
    .from('pipeline_runs')
    .select('id, status, contract_id, pipeline_id, pipelines(name, type)')
    .in('contract_id', ['519cb8fb-' + '0000-0000-0000-000000000000'])
    .limit(10)
  // Busca pelos runs do contrato 519cb8fb completo
  const { data: mRuns } = await supabase
    .from('pipeline_runs')
    .select('id, status, started_at, pipeline_id, pipelines(name, type)')
    .eq('contract_id', '519cb8fb-' + (byCompanyId?.[0]?.id?.slice(9) ?? ''))
    .limit(10)
  checks.all_runs_for_matheus = mRuns

  return NextResponse.json(checks, { headers: { 'Cache-Control': 'no-store' } })
}
