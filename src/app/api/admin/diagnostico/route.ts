import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const admin = createAdminClient()
  const user_supabase = await createClient()
  const checks: Record<string, any> = {}

  // Testa com createClient (usuário autenticado) — mesmo client usado pelas páginas
  const { data: pipelines, error: pe } = await user_supabase.from('pipelines').select('id, type, name').limit(5)
  checks.pipelines = pipelines?.map(p => ({ id: p.id.slice(0,8), type: p.type, name: p.name }))
  checks.pipelines_error = pe?.message

  const { data: runs, error: re } = await user_supabase.from('pipeline_runs').select('id, status, pipeline_id').limit(5)
  checks.runs_sample = runs?.map(r => ({ status: r.status, pid: r.pipeline_id?.slice(0,8) }))
  checks.runs_error = re?.message

  const { data: stages, error: se } = await user_supabase.from('stages').select('id, name, pipeline_id').limit(5)
  checks.stages_sample = stages?.map(s => ({ name: s.name, pid: s.pipeline_id?.slice(0,8) }))
  checks.stages_error = se?.message

  // Verifica colunas reais de pipeline_runs via admin
  const { data: cols } = await admin.rpc('exec_sql' as any, {
    sql: `SELECT column_name FROM information_schema.columns WHERE table_schema='contract_crm' AND table_name='pipeline_runs' ORDER BY ordinal_position`
  }).catch(() => ({ data: null }))
  checks.pipeline_runs_columns = cols

  return NextResponse.json(checks, { headers: { 'Cache-Control': 'no-store' } })
}
