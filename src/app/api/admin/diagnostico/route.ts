import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const checks: Record<string, any> = {}

  const { data: viewData, error: viewError } = await supabase
    .from('contracts_with_current_run').select('id, run_status').limit(10)
  checks.view_all_statuses = { data: viewData?.map(d => d.run_status), error: viewError?.message }

  const { data: tagData, error: tagError } = await supabase
    .from('tags').select('id, name, context').limit(5)
  checks.tags_has_context_column = { data: tagData, error: tagError?.message }

  const { data: matheus } = await supabase
    .from('contracts').select('id, client_name, company_id').ilike('client_name', '%MATHEUS%').limit(3)
  checks.matheus = matheus?.map(d => ({ id: d.id.slice(0,8), name: d.client_name, co_id: d.company_id?.slice(0,8) }))

  if (matheus?.length) {
    const { data: runs } = await supabase
      .from('pipeline_runs').select('status, contract_id').in('contract_id', matheus.map(m => m.id))
    checks.matheus_runs = runs?.map(r => ({ status: r.status, cid: r.contract_id.slice(0,8) }))
  }

  return NextResponse.json(checks)
}
