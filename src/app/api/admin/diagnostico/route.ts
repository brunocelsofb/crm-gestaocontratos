import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const checks: Record<string, any> = {}

  const companyId = '255598e0-36e8-4e29-b253-70faee08987b'

  // Empresa
  const { data: company } = await supabase.from('companies').select('id, name, cnpj').eq('id', companyId).single()
  checks.company = company

  // Contratos por company_id
  const { data: byId } = await supabase.from('contracts').select('id, client_name, company_id').eq('company_id', companyId).limit(5)
  checks.contracts_by_company_id = byId

  // Contratos por nome
  const { data: byName } = await supabase.from('contracts').select('id, client_name, company_id').ilike('client_name', '%MATHEUS LUIZ%').limit(5)
  checks.contracts_by_name = byName

  // Runs por contract_id
  if (byId?.length || byName?.length) {
    const ids = [...new Set([...(byId ?? []), ...(byName ?? [])].map(c => c.id))]
    const { data: runs } = await supabase.from('pipeline_runs').select('id, status, contract_id, pipeline_id').in('contract_id', ids)
    checks.runs = runs
  }

  return NextResponse.json(checks, { headers: { 'Cache-Control': 'no-store' } })
}
