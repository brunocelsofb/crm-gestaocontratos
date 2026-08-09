import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PropostasTable } from '@/components/proposals/propostas-table'

export default async function PropostasPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()

  const [{ data: proposals }, { data: profiles }] = await Promise.all([
    supabase.from('proposals')
      .select(`
        id, control_code, version, workflow_status, proposal_value,
        created_at, updated_at, proposal_validity_days,
        client_review_token, client_approved_by_name,
        submitted_at, submitted_by_name,
        contracts!inner(id, title, client_name, user_id)
      `)
      .is('deleted_at', null)
      .not('workflow_status', 'eq', 'rascunho')
      .order('updated_at', { ascending: false })
      .limit(200),
    supabase.from('profiles').select('id, full_name'),
  ])

  const profileById = new Map((profiles ?? []).map(p => [p.id, p.full_name]))

  const rows = (proposals ?? []).map(p => ({
    ...p,
    contract_title: (p.contracts as any)?.client_name ?? (p.contracts as any)?.title ?? '—',
    contract_id: (p.contracts as any)?.id ?? '',
    responsible: profileById.get((p.contracts as any)?.user_id) ?? '—',
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Propostas</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Visão global de todas as propostas ativas no sistema.
        </p>
      </div>
      <PropostasTable
        proposals={rows}
        currentUserRole={profile?.role ?? 'member'}
      />
    </div>
  )
}
