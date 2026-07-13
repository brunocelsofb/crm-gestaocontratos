import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { KanbanBoard, type RunCard } from '@/components/pipeline/kanban-board'
import { PipelineSelect } from '@/components/pipeline/pipeline-select'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { checkAndTriggerRenewals } from '@/lib/actions/pipeline'

const DEFAULT_SLA_DAYS = 7 // usado quando a etapa não tem SLA configurado

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string }>
}) {
  const { pipeline: pipelineIdParam } = await searchParams
  const supabase = await createClient()
  const isAdmin = await isCurrentUserAdmin()

  // Roda "no fundo" (sem await) — antes isso travava o carregamento da
  // tela toda vez que alguém visitava o Funil, mesmo quando não tinha
  // nada pra mover. Se algo for movido agora, aparece na PRÓXIMA
  // visita/atualização, não nesta — troca deliberada de "sempre
  // atualizado na hora" por "tela rápida agora".
  void checkAndTriggerRenewals()

  const { data: pipelines } = await supabase
    .from('pipelines')
    .select('id, name, is_default, type, won_label, lost_label')
    .order('name')

  const selectedPipeline =
    pipelineIdParam ?? pipelines?.find((p) => p.is_default)?.id ?? pipelines?.[0]?.id

  const pipelineType = pipelines?.find((p) => p.id === selectedPipeline)?.type ?? 'gestao_contratos'

  // PERFORMANCE: stages e runs não dependem uma da outra — rodam em
  // paralelo em vez de uma esperar a outra terminar.
  const [{ data: stages }, { data: runs }] = await Promise.all([
    selectedPipeline
      ? supabase.from('stages').select('id, name, order_index, sla_days').eq('pipeline_id', selectedPipeline).order('order_index')
      : Promise.resolve({ data: [] as { id: string; name: string; order_index: number; sla_days: number | null }[] }),
    selectedPipeline
      ? supabase.from('pipeline_runs').select('id, contract_id, stage_id, stage_entered_at, value, status').eq('pipeline_id', selectedPipeline).in('status', ['open', 'won', 'lost'])
      : Promise.resolve({ data: [] as { id: string; contract_id: string; stage_id: string; stage_entered_at: string; value: number; status: string }[] }),
  ])

  const contractIds = [...new Set((runs ?? []).map((r) => r.contract_id))]

  // PERFORMANCE: contratos e "última atividade" também não dependem uma
  // da outra (as duas só precisam da lista de contractIds), então saem
  // juntas também.
  const [{ data: contractsData }, { data: latestActivityRows }, { data: contractTagRows }] = await Promise.all([
    contractIds.length
      ? supabase.from('contracts').select('id, process_number, title, client_name, company_id, valid_until').in('id', contractIds)
      : Promise.resolve({ data: [] as { id: string; process_number: string; title: string; client_name: string; company_id: string | null; valid_until: string | null }[] }),
    contractIds.length
      ? supabase.from('activities').select('contract_id, created_at').in('contract_id', contractIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as { contract_id: string; created_at: string }[] }),
    contractIds.length
      ? supabase.from('contract_tags').select('contract_id, tags(id, name, color)').in('contract_id', contractIds)
      : Promise.resolve({ data: [] as { contract_id: string; tags: { id: string; name: string; color: string } | { id: string; name: string; color: string }[] | null }[] }),
  ])

  const contractById = new Map((contractsData ?? []).map((c) => [c.id, c]))
  const stageById = new Map((stages ?? []).map((s) => [s.id, s]))

  // NOTA DE INCERTEZA: o embedding `tags(...)` através da tabela de
  // ligação contract_tags pode vir como array (mesmo comportamento que
  // já vimos antes em outros lugares) — trato os dois formatos possíveis
  // aqui, em vez de assumir um só.
  const tagByContract = new Map<string, { id: string; name: string; color: string }>()
  for (const row of contractTagRows ?? []) {
    const tagValue = Array.isArray(row.tags) ? row.tags[0] : row.tags
    if (tagValue) tagByContract.set(row.contract_id, tagValue)
  }

  // Como veio ordenado por created_at desc, a primeira ocorrência de cada
  // contract_id já é a atividade mais recente dele.
  const lastActivityByContract = new Map<string, string>()
  for (const a of latestActivityRows ?? []) {
    if (!lastActivityByContract.has(a.contract_id)) lastActivityByContract.set(a.contract_id, a.created_at)
  }

  function computeFreshness(contractId: string, stageEnteredAt: string, stageId: string): 'fresh' | 'warning' | 'stale' {
    const lastInteraction = lastActivityByContract.get(contractId) ?? stageEnteredAt
    const daysSince = (Date.now() - new Date(lastInteraction).getTime()) / 86_400_000
    const sla = stageById.get(stageId)?.sla_days ?? DEFAULT_SLA_DAYS
    const ratio = daysSince / sla
    if (ratio < 0.5) return 'fresh'
    if (ratio < 1) return 'warning'
    return 'stale'
  }

  const cards: RunCard[] = (runs ?? []).map((r) => {
    const contract = contractById.get(r.contract_id)
    return {
      runId: r.id,
      contractId: r.contract_id,
      companyId: contract?.company_id ?? null,
      stageId: r.stage_id,
      status: r.status as 'open' | 'won' | 'lost',
      processNumber: contract?.process_number ?? '',
      clientName: contract?.client_name ?? '',
      title: contract?.title ?? '',
      value: Number(r.value) || 0,
      stageEnteredAt: r.stage_entered_at,
      validUntil: contract?.valid_until ?? null,
      freshness: computeFreshness(r.contract_id, r.stage_entered_at, r.stage_id),
      tag: tagByContract.get(r.contract_id) ?? null,
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[17px] font-medium text-foreground">Funil</h1>
        <div className="flex items-center gap-2">
          {pipelines && pipelines.length > 0 && (
            <PipelineSelect pipelines={pipelines} selected={selectedPipeline} />
          )}
          <Link
            href={`/contracts/new${selectedPipeline ? `?pipeline=${selectedPipeline}` : ''}`}
            className="whitespace-nowrap rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            + {pipelineType === 'vendas' ? 'Nova Oportunidade' : 'Novo Contrato'}
          </Link>
        </div>
      </div>

      {stages && stages.length > 0 ? (
        <KanbanBoard
          pipelineId={selectedPipeline as string}
          stages={stages}
          initialCards={cards}
          showValidity={pipelineType === 'gestao_contratos'}
          wonLabel={pipelines?.find((p) => p.id === selectedPipeline)?.won_label ?? 'Ganho'}
          lostLabel={pipelines?.find((p) => p.id === selectedPipeline)?.lost_label ?? 'Perdido'}
          isAdmin={isAdmin}
        />
      ) : (
        <p className="text-sm text-gray-400">Nenhuma etapa cadastrada para este pipeline.</p>
      )}
    </div>
  )
}
