import { createClient } from '@/lib/supabase/server'
import { PipelineSelect } from '@/components/pipeline/pipeline-select'
import { StageValueChart } from '@/components/dashboard/stage-value-chart'

function fmt(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default async function DashboardPage({
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

  const { data: stages } = selectedPipeline
    ? await supabase
        .from('stages')
        .select('id, name, order_index')
        .eq('pipeline_id', selectedPipeline)
        .order('order_index')
    : { data: [] }

  const { data: openRuns } = selectedPipeline
    ? await supabase
        .from('pipeline_runs')
        .select('stage_id, value')
        .eq('pipeline_id', selectedPipeline)
        .eq('status', 'open')
    : { data: [] }

  const totalOpen = (openRuns ?? []).reduce((sum, r) => sum + Number(r.value || 0), 0)

  const valueByStage = (stages ?? []).map((s) => ({
    name: s.name,
    value: (openRuns ?? [])
      .filter((r) => r.stage_id === s.id)
      .reduce((sum, r) => sum + Number(r.value || 0), 0),
  }))

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: wonThisMonth } = selectedPipeline
    ? await supabase
        .from('pipeline_runs')
        .select('value')
        .eq('pipeline_id', selectedPipeline)
        .eq('status', 'won')
        .gte('ended_at', startOfMonth.toISOString())
    : { data: [] }

  const wonValue = (wonThisMonth ?? []).reduce((sum, r) => sum + Number(r.value || 0), 0)

  const { data: closedRuns } = selectedPipeline
    ? await supabase
        .from('pipeline_runs')
        .select('status')
        .eq('pipeline_id', selectedPipeline)
        .in('status', ['won', 'lost'])
    : { data: [] }

  const wonCount = (closedRuns ?? []).filter((r) => r.status === 'won').length
  const totalClosed = (closedRuns ?? []).length
  // Taxa de conversão calculada só sobre runs já encerradas (won+lost) deste
  // pipeline. Se não houver nenhuma run encerrada ainda, mostramos 0% em vez
  // de dividir por zero.
  const conversionRate = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : 0

  // Funil de conversão: quantas runs (deste pipeline, abertas ou já
  // encerradas) chegaram a passar por cada etapa — usa stage_history,
  // contando runs distintas por etapa.
  const { data: pipelineRunIds } = selectedPipeline
    ? await supabase.from('pipeline_runs').select('id').eq('pipeline_id', selectedPipeline)
    : { data: [] }

  const runIds = (pipelineRunIds ?? []).map((r) => r.id)
  const { data: historyRows } = runIds.length
    ? await supabase.from('stage_history').select('pipeline_run_id, stage_id').in('pipeline_run_id', runIds)
    : { data: [] }

  const funnelCounts = (stages ?? []).map((s) => ({
    name: s.name,
    count: new Set(
      (historyRows ?? []).filter((h) => h.stage_id === s.id).map((h) => h.pipeline_run_id)
    ).size,
  }))
  const maxFunnelCount = funnelCounts[0]?.count || 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Dashboard financeiro</h1>
        {pipelines && pipelines.length > 0 && (
          <PipelineSelect pipelines={pipelines} selected={selectedPipeline} />
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Total em aberto</p>
          <p className="text-xl font-semibold text-gray-900">{fmt(totalOpen)}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Ganho no mês</p>
          <p className="text-xl font-semibold text-gray-900">{fmt(wonValue)}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Taxa de conversão</p>
          <p className="text-xl font-semibold text-gray-900">{conversionRate}%</p>
          <p className="mt-0.5 text-[11px] text-gray-400">{wonCount} de {totalClosed} encerradas</p>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-gray-900">Valor em aberto por etapa</h2>
        <StageValueChart data={valueByStage} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-gray-900">
          Funil de conversão (processos que já passaram por cada etapa)
        </h2>
        <div className="space-y-1.5">
          {funnelCounts.map((f) => (
            <div key={f.name} className="flex items-center gap-2 text-xs">
              <span className="w-40 shrink-0 text-gray-600">{f.name}</span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-gray-100">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${Math.round((f.count / maxFunnelCount) * 100)}%` }}
                />
              </div>
              <span className="w-6 text-right text-gray-500">{f.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
