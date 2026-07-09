import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { KanbanBoard, type RunCard } from '@/components/pipeline/kanban-board'
import { PipelineSelect } from '@/components/pipeline/pipeline-select'

const DEFAULT_SLA_DAYS = 7 // usado quando a etapa não tem SLA configurado

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string }>
}) {
  const { pipeline: pipelineIdParam } = await searchParams
  const supabase = await createClient()

  const { data: pipelines } = await supabase
    .from('pipelines')
    .select('id, name, is_default')
    .order('name')

  const selectedPipeline =
    pipelineIdParam ?? pipelines?.find((p) => p.is_default)?.id ?? pipelines?.[0]?.id

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
  const [{ data: contractsData }, { data: latestActivityRows }] = await Promise.all([
    contractIds.length
      ? supabase.from('contracts').select('id, process_number, title, client_name, company_id').in('id', contractIds)
      : Promise.resolve({ data: [] as { id: string; process_number: string; title: string; client_name: string; company_id: string | null }[] }),
    contractIds.length
      ? supabase.from('activities').select('contract_id, created_at').in('contract_id', contractIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as { contract_id: string; created_at: string }[] }),
  ])

  const contractById = new Map((contractsData ?? []).map((c) => [c.id, c]))
  const stageById = new Map((stages ?? []).map((s) => [s.id, s]))

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
      freshness: computeFreshness(r.contract_id, r.stage_entered_at, r.stage_id),
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
            + Novo Contrato
          </Link>
        </div>
      </div>

      {stages && stages.length > 0 ? (
        <KanbanBoard stages={stages} initialCards={cards} />
      ) : (
        <p className="text-sm text-gray-400">Nenhuma etapa cadastrada para este pipeline.</p>
      )}
    </div>
  )
}
