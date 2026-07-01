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

  // CORREÇÃO: o embedding automático `contracts(...)` não estava
  // retornando dados no ambiente real (mostrava valor e dias certos,
  // mas cliente/processo vinham vazios) — troquei para duas consultas
  // separadas, juntadas aqui no código. Mesmo padrão já usado (e
  // funcionando de verdade) na tela de Contratos.
  // CORREÇÃO: antes filtrava só status='open', e por isso um contrato
  // marcado como Ganho ou Perdido sumia do quadro inteiro (a run muda de
  // status quando fecha). Agora mostramos open + won + lost — só 'moved'
  // fica de fora, porque esse caso já é representado pela NOVA run no
  // outro pipeline, então mostrar a antiga aqui seria duplicar/confundir.
  const { data: runs } = selectedPipeline
    ? await supabase
        .from('pipeline_runs')
        .select('id, contract_id, stage_id, stage_entered_at, value, status')
        .eq('pipeline_id', selectedPipeline)
        .in('status', ['open', 'won', 'lost'])
    : { data: [] }

  const contractIds = [...new Set((runs ?? []).map((r) => r.contract_id))]
  const { data: contractsData } = contractIds.length
    ? await supabase
        .from('contracts')
        .select('id, process_number, title, client_name')
        .in('id', contractIds)
    : { data: [] }

  const contractById = new Map((contractsData ?? []).map((c) => [c.id, c]))

  const cards: RunCard[] = (runs ?? []).map((r) => {
    const contract = contractById.get(r.contract_id)
    return {
      runId: r.id,
      contractId: r.contract_id,
      stageId: r.stage_id,
      status: r.status as 'open' | 'won' | 'lost',
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
