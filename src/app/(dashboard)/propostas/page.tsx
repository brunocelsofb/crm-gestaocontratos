import { createClient } from '@/lib/supabase/server'
import { PropostasTable } from '@/components/proposals/propostas-table'

export default async function PropostasPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()

  // Query 1: todas as propostas não-rascunho
  const { data: proposals, error } = await supabase
    .from('proposals')
    .select('id, control_code, version, workflow_status, proposal_value, created_at, updated_at, proposal_validity_days, client_review_token, client_approved_by_name, contract_id')
    .is('deleted_at', null)
    .not('workflow_status', 'eq', 'rascunho')
    .order('updated_at', { ascending: false })
    .limit(300)

  if (error) console.error('[propostas page]', error)

  const contractIds = [...new Set((proposals ?? []).map(p => p.contract_id).filter(Boolean))]
  const proposalIds = (proposals ?? []).map(p => p.id)

  // Query 2: contratos relacionados
  const { data: contracts } = contractIds.length > 0
    ? await supabase.from('contracts')
        .select('id, title, client_name, user_id, pipeline_stage')
        .in('id', contractIds)
    : { data: [] }

  // Query 3: itens das propostas (para coluna Itens)
  const { data: items } = proposalIds.length > 0
    ? await supabase.from('proposal_items')
        .select('proposal_id, item, type, subtotal')
        .in('proposal_id', proposalIds)
    : { data: [] }

  // Query 4: perfis para responsável
  const { data: profiles } = await supabase.from('profiles').select('id, full_name')

  const contractById = new Map((contracts ?? []).map(c => [c.id, c]))
  const profileById  = new Map((profiles ?? []).map(p => [p.id, p.full_name]))

  // Agrupa itens por proposal_id
  const itemsByProposal = new Map<string, typeof items>()
  for (const item of items ?? []) {
    const arr = itemsByProposal.get(item.proposal_id) ?? []
    arr.push(item)
    itemsByProposal.set(item.proposal_id, arr)
  }

  const rows = (proposals ?? []).map(p => {
    const contract = contractById.get(p.contract_id)
    const pItems = itemsByProposal.get(p.id) ?? []
    const mrr     = pItems.filter(i => i.type === 'MRR').reduce((s, i) => s + Number(i.subtotal), 0)
    const pontual = pItems.filter(i => i.type !== 'MRR').reduce((s, i) => s + Number(i.subtotal), 0)
    const itemSummary = pItems.map(i => `(1) ${i.item}`).join(' · ')

    return {
      id: p.id,
      control_code: p.control_code,
      version: p.version,
      workflow_status: p.workflow_status,
      proposal_value: p.proposal_value,
      created_at: p.created_at,
      updated_at: p.updated_at,
      proposal_validity_days: p.proposal_validity_days,
      client_review_token: p.client_review_token,
      client_approved_by_name: p.client_approved_by_name,
      contract_id: p.contract_id,
      contract_title: contract?.client_name ?? contract?.title ?? '—',
      pipeline_stage: contract?.pipeline_stage ?? null,
      responsible: profileById.get(contract?.user_id ?? '') ?? '—',
      mrr,
      pontual,
      item_summary: itemSummary,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Propostas</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Visão global de todas as propostas ativas · {rows.length} proposta{rows.length !== 1 ? 's' : ''}
        </p>
      </div>
      <PropostasTable proposals={rows} currentUserRole={profile?.role ?? 'member'} />
    </div>
  )
}
