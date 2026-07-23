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

  return NextResponse.json(checks, { headers: { 'Cache-Control': 'no-store' } })
}
