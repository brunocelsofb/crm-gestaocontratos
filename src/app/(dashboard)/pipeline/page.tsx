import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { KanbanBoard, type RunCard } from '@/components/pipeline/kanban-board'
import { PipelineSelect } from '@/components/pipeline/pipeline-select'

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string }>
}) {
  // Mesma ressalva já feita em outras páginas: `searchParams` como Promise
  // é o padrão em versões recentes do Next.js App Router — remova o
  // `await` se sua versão instalada usar o formato antigo.
  const { pipeline: pipelineIdParam } = await searchParams
  const supabase = await createClient()

  const { data: pipelines } = await supabase
    .from('pipelines')
    .select('id, name, is_default')
    .order('name')

  const selectedPipeline =
    pipelineIdParam ?? pipelines?.find((p) => p.is_default)?.id ?? pipelines?.[0]?.id

  const { data: stages } = selectedPipeline
    ? await supabase
        .from('stages')
        .select('id, name, order_index, sla_days')
        .eq('pipeline_id', selectedPipeline)
        .order('order_index')
    : { data: [] }

  // Embedding de contracts aqui é confiável porque pipeline_runs.contract_id
  // é uma foreign key real numa tabela real (diferente do caso da view
  // usada na listagem de contratos).
  const { data: runs } = selectedPipeline
    ? await supabase
        .from('pipeline_runs')
        .select('id, contract_id, stage_id, stage_entered_at, value, contracts(process_number, title, client_name)')
        .eq('pipeline_id', selectedPipeline)
        .eq('status', 'open')
    : { data: [] }

  const cards: RunCard[] = (runs ?? []).map((r) => {
    const contractArr = r.contracts as unknown as { process_number: string; title: string; client_name: string }[] | null
    const contract = contractArr?.[0] ?? null
    return {
      runId: r.id,
      contractId: r.contract_id,
      stageId: r.stage_id,
      processNumber: contract?.process_number ?? '',
      clientName: contract?.client_name ?? '',
      title: contract?.title ?? '',
      value: Number(r.value) || 0,
      stageEnteredAt: r.stage_entered_at,
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
