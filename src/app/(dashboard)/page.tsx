import { createClient } from '@/lib/supabase/server'
import { PipelineSelect } from '@/components/pipeline/pipeline-select'
import { StageValueChart } from '@/components/dashboard/stage-value-chart'
import { MetricCard } from '@/components/dashboard/metric-card'
import { ChevronFunnel } from '@/components/dashboard/chevron-funnel'
import { Wallet, TrendingUp, AlertTriangle, Percent, Timer } from 'lucide-react'

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
    .select('id, name, is_default, type')
    .order('name')

  const selectedPipeline =
    pipelineIdParam ?? pipelines?.find((p) => p.is_default)?.id ?? pipelines?.[0]?.id

  const pipelineType = pipelines?.find((p) => p.id === selectedPipeline)?.type ?? 'gestao_contratos'

  const { data: stages } = selectedPipeline
    ? await supabase
        .from('stages')
        .select('id, name, order_index, is_won, is_lost, sla_days, color')
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
    color: s.color ?? '#1B556B',
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
        .select('id, value, previous_run_id')
        .eq('pipeline_id', selectedPipeline)
        .eq('status', 'won')
        .gte('ended_at', startOfMonth.toISOString())
    : { data: [] }

  const renewedValue = (wonThisMonth ?? []).reduce((sum, r) => sum + Number(r.value || 0), 0)

  // Métrica de variação: compara o valor de cada renovação com o valor da
  // run anterior (via previous_run_id), e tira a média percentual. Isso só
  // é possível por causa do desenho de pipeline_runs encadeadas.
  const previousRunIds = (wonThisMonth ?? []).map((r) => r.previous_run_id).filter((id): id is string => !!id)
  const { data: previousRuns } = previousRunIds.length
    ? await supabase.from('pipeline_runs').select('id, value').in('id', previousRunIds)
    : { data: [] }
  const previousValueById = new Map((previousRuns ?? []).map((r) => [r.id, Number(r.value) || 0]))

  const deltasPct = (wonThisMonth ?? [])
    .filter((r) => r.previous_run_id && previousValueById.has(r.previous_run_id))
    .map((r) => {
      const prev = previousValueById.get(r.previous_run_id as string)!
      const curr = Number(r.value) || 0
      return prev > 0 ? ((curr - prev) / prev) * 100 : null
    })
    .filter((d): d is number => d !== null)

  const avgIncreasePct = deltasPct.length
    ? Math.round((deltasPct.reduce((a, b) => a + b, 0) / deltasPct.length) * 10) / 10
    : null

  // Contratos vencendo em 30 dias: runs abertas cuja etapa atual ainda não é
  // de renovação concluída, com expected_close_date dentro da janela.
  const in30Days = new Date()
  in30Days.setDate(in30Days.getDate() + 30)
  const { data: expiringRuns } = selectedPipeline
    ? await supabase
        .from('pipeline_runs')
        .select('id')
        .eq('pipeline_id', selectedPipeline)
        .eq('status', 'open')
        .not('expected_close_date', 'is', null)
        .lte('expected_close_date', in30Days.toISOString().slice(0, 10))
    : { data: [] }

  const { data: pipelineRunIds } = selectedPipeline
    ? await supabase.from('pipeline_runs').select('id').eq('pipeline_id', selectedPipeline)
    : { data: [] }

  const runIds = (pipelineRunIds ?? []).map((r) => r.id)
  const { data: historyRows } = runIds.length
    ? await supabase.from('stage_history').select('pipeline_run_id, stage_id').in('pipeline_run_id', runIds)
    : { data: [] }

  const funnelStages = (stages ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    isWon: s.is_won,
    color: s.color ?? '#1B556B',
    count: new Set(
      (historyRows ?? []).filter((h) => h.stage_id === s.id).map((h) => h.pipeline_run_id)
    ).size,
  }))

  // ------------------------------------------------------------
  // Métricas específicas de PIPELINE DE VENDAS (só calculadas se
  // for esse o tipo — evita consultas desnecessárias no caso comum)
  // ------------------------------------------------------------
  let conversionRate: number | null = null
  let avgSalesCycleDays: number | null = null
  let avgTicket: number | null = null

  if (pipelineType === 'vendas' && selectedPipeline) {
    const { data: closedRuns } = await supabase
      .from('pipeline_runs')
      .select('status, value, started_at, ended_at')
      .eq('pipeline_id', selectedPipeline)
      .in('status', ['won', 'lost'])

    const wonRuns = (closedRuns ?? []).filter((r) => r.status === 'won')
    const totalClosed = (closedRuns ?? []).length

    conversionRate = totalClosed > 0 ? Math.round((wonRuns.length / totalClosed) * 100) : null

    const cycleDays = wonRuns
      .filter((r) => r.ended_at)
      .map((r) => (new Date(r.ended_at as string).getTime() - new Date(r.started_at).getTime()) / 86_400_000)
    avgSalesCycleDays = cycleDays.length
      ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length)
      : null

    avgTicket = wonRuns.length
      ? wonRuns.reduce((sum, r) => sum + (Number(r.value) || 0), 0) / wonRuns.length
      : null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[17px] font-medium text-foreground">Dashboard financeiro</h1>
        {pipelines && pipelines.length > 0 && (
          <PipelineSelect pipelines={pipelines} selected={selectedPipeline} />
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          icon={Wallet}
          accent="brand"
          label="Total em aberto"
          value={fmt(totalOpen)}
        />
        {pipelineType === 'vendas' ? (
          <>
            <MetricCard
              icon={Percent}
              accent="positive"
              label="Taxa de conversão"
              value={conversionRate !== null ? `${conversionRate}%` : '—'}
            />
            <MetricCard
              icon={Timer}
              accent="warn"
              label="Ciclo médio de venda"
              value={avgSalesCycleDays !== null ? `${avgSalesCycleDays} dias` : '—'}
              hint={avgTicket !== null ? `Ticket médio: ${fmt(avgTicket)}` : undefined}
            />
          </>
        ) : (
          <>
            <MetricCard
              icon={TrendingUp}
              accent="positive"
              label="Renovado no mês"
              value={fmt(renewedValue)}
              hint={avgIncreasePct !== null ? `${avgIncreasePct >= 0 ? '+' : ''}${avgIncreasePct}% vs. valor anterior` : undefined}
            />
            <MetricCard
              icon={AlertTriangle}
              accent="warn"
              label="Vencendo em 30 dias"
              value={`${expiringRuns?.length ?? 0} contrato${expiringRuns?.length === 1 ? '' : 's'}`}
            />
          </>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-foreground">
          {pipelineType === 'vendas' ? 'Funil de vendas' : 'Funil de renovação'}
        </h2>
        <ChevronFunnel stages={funnelStages} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-foreground">Valor em aberto por etapa</h2>
        <StageValueChart data={valueByStage} />
      </div>
    </div>
  )
}
