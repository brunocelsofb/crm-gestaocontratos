import { createClient } from '@/lib/supabase/server'
import { PipelineSelect } from '@/components/pipeline/pipeline-select'
import { PeriodSelector } from '@/components/dashboard/period-selector'
import { StageValueChart } from '@/components/dashboard/stage-value-chart'
import { MetricCard } from '@/components/dashboard/metric-card'
import { ChevronFunnel } from '@/components/dashboard/chevron-funnel'
import { getValidityStatus } from '@/lib/utils/validity'
import { Wallet, TrendingUp, AlertTriangle, XCircle, UserX, Percent, Timer } from 'lucide-react'

function fmt(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function currentMonthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string; from?: string; to?: string }>
}) {
  const { pipeline: pipelineIdParam, from: fromParam, to: toParam } = await searchParams
  const supabase = await createClient()

  const { data: pipelines } = await supabase
    .from('pipelines')
    .select('id, name, is_default, type')
    .order('name')

  const selectedPipeline =
    pipelineIdParam ?? pipelines?.find((p) => p.is_default)?.id ?? pipelines?.[0]?.id

  const pipelineType = pipelines?.find((p) => p.id === selectedPipeline)?.type ?? 'gestao_contratos'

  // Período usado pelos cartões "Renovado" e "Churn" — o que aconteceu
  // DENTRO desse intervalo. "Total em aberto", "A vencer" e "Vencido" são
  // sempre em relação a HOJE (estado atual), não dependem desse período.
  const defaultRange = currentMonthRange()
  const periodFrom = fromParam ?? defaultRange.from
  const periodTo = toParam ?? defaultRange.to

  const in30Days = new Date()
  in30Days.setDate(in30Days.getDate() + 30)
  const in30DaysStr = in30Days.toISOString().slice(0, 10)

  // PERFORMANCE: consultas independentes rodando em paralelo (ver
  // explicação detalhada em commits anteriores — reduz bastante o tempo
  // de carregamento comparado a fazer uma de cada vez).
  const [
    { data: stages },
    { data: openRuns },
    { data: wonInPeriod },
    { data: lostInPeriod },
    { data: pipelineRunIds },
    { data: closedRuns },
  ] = await Promise.all([
    selectedPipeline
      ? supabase.from('stages').select('id, name, order_index, is_won, is_lost, sla_days, color').eq('pipeline_id', selectedPipeline).order('order_index')
      : Promise.resolve({ data: [] as never[] }),
    selectedPipeline
      ? supabase.from('pipeline_runs').select('stage_id, value, contract_id').eq('pipeline_id', selectedPipeline).eq('status', 'open')
      : Promise.resolve({ data: [] as never[] }),
    selectedPipeline
      ? supabase.from('pipeline_runs').select('id, value, previous_run_id').eq('pipeline_id', selectedPipeline).eq('status', 'won').gte('ended_at', `${periodFrom}T00:00:00`).lte('ended_at', `${periodTo}T23:59:59`)
      : Promise.resolve({ data: [] as never[] }),
    selectedPipeline
      ? supabase.from('pipeline_runs').select('id, value').eq('pipeline_id', selectedPipeline).eq('status', 'lost').gte('ended_at', `${periodFrom}T00:00:00`).lte('ended_at', `${periodTo}T23:59:59`)
      : Promise.resolve({ data: [] as never[] }),
    selectedPipeline
      ? supabase.from('pipeline_runs').select('id').eq('pipeline_id', selectedPipeline)
      : Promise.resolve({ data: [] as never[] }),
    pipelineType === 'vendas' && selectedPipeline
      ? supabase.from('pipeline_runs').select('status, value, started_at, ended_at').eq('pipeline_id', selectedPipeline).in('status', ['won', 'lost'])
      : Promise.resolve({ data: [] as never[] }),
  ])

  // "Total em aberto (receita recorrente)": soma TODOS os contratos com
  // passagem aberta, independente de estarem vencidos ou não — um
  // contrato só sai daqui quando alguém explicitamente marca "Não
  // renovado" (vira churn) ou "Renovado". Vencido sozinho não tira do total.
  const totalOpen = (openRuns ?? []).reduce((sum, r) => sum + Number(r.value || 0), 0)

  const valueByStage = (stages ?? []).map((s) => ({
    name: s.name,
    color: s.color ?? '#1B556B',
    value: (openRuns ?? [])
      .filter((r) => r.stage_id === s.id)
      .reduce((sum, r) => sum + Number(r.value || 0), 0),
  }))

  const renewedValue = (wonInPeriod ?? []).reduce((sum, r) => sum + Number(r.value || 0), 0)
  const churnValue = (lostInPeriod ?? []).reduce((sum, r) => sum + Number(r.value || 0), 0)
  const churnCount = (lostInPeriod ?? []).length

  const previousRunIds = (wonInPeriod ?? []).map((r) => r.previous_run_id).filter((id): id is string => !!id)
  const runIds = (pipelineRunIds ?? []).map((r) => r.id)
  const openContractIds = [...new Set((openRuns ?? []).map((r) => r.contract_id))]

  const [{ data: previousRuns }, { data: historyRows }, { data: openContractsValidity }] = await Promise.all([
    previousRunIds.length
      ? supabase.from('pipeline_runs').select('id, value').in('id', previousRunIds)
      : Promise.resolve({ data: [] as { id: string; value: number }[] }),
    runIds.length
      ? supabase.from('stage_history').select('pipeline_run_id, stage_id').in('pipeline_run_id', runIds)
      : Promise.resolve({ data: [] as { pipeline_run_id: string; stage_id: string }[] }),
    openContractIds.length
      ? supabase.from('contracts').select('id, valid_until').in('id', openContractIds)
      : Promise.resolve({ data: [] as { id: string; valid_until: string | null }[] }),
  ])

  const previousValueById = new Map((previousRuns ?? []).map((r) => [r.id, Number(r.value) || 0]))

  const deltasPct = (wonInPeriod ?? [])
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

  // "A vencer" e "Vencido": olham a vigência de cada contrato com run
  // aberta, e somam o VALOR da run (não é só contagem).
  const validUntilByContract = new Map((openContractsValidity ?? []).map((c) => [c.id, c.valid_until]))
  let expiringSoonValue = 0
  let expiringSoonCount = 0
  let expiredValue = 0
  let expiredCount = 0

  for (const run of openRuns ?? []) {
    const validUntil = validUntilByContract.get(run.contract_id) ?? null
    const status = getValidityStatus(validUntil)
    if (status === 'expiring_soon') {
      expiringSoonValue += Number(run.value) || 0
      expiringSoonCount++
    } else if (status === 'expired') {
      expiredValue += Number(run.value) || 0
      expiredCount++
    }
  }

  const funnelStages = (stages ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    isWon: s.is_won,
    color: s.color ?? '#1B556B',
    count: new Set(
      (historyRows ?? []).filter((h) => h.stage_id === s.id).map((h) => h.pipeline_run_id)
    ).size,
  }))

  // Métricas específicas de pipeline de VENDAS
  const wonRuns = (closedRuns ?? []).filter((r) => r.status === 'won')
  const totalClosed = (closedRuns ?? []).length

  const conversionRate = totalClosed > 0 ? Math.round((wonRuns.length / totalClosed) * 100) : null

  const cycleDays = wonRuns
    .filter((r) => r.ended_at)
    .map((r) => (new Date(r.ended_at as string).getTime() - new Date(r.started_at).getTime()) / 86_400_000)
  const avgSalesCycleDays = cycleDays.length
    ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length)
    : null

  const avgTicket = wonRuns.length
    ? wonRuns.reduce((sum, r) => sum + (Number(r.value) || 0), 0) / wonRuns.length
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[17px] font-medium text-foreground">Dashboard financeiro</h1>
        {pipelines && pipelines.length > 0 && (
          <PipelineSelect pipelines={pipelines} selected={selectedPipeline} />
        )}
      </div>

      {pipelineType !== 'vendas' && (
        <PeriodSelector
          from={periodFrom}
          to={periodTo}
          basePath="/"
          extraParams={{ pipeline: selectedPipeline }}
        />
      )}

      <div className={`grid gap-3 ${pipelineType === 'vendas' ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-5'}`}>
        <MetricCard
          icon={Wallet}
          accent="brand"
          label="Total em aberto (receita recorrente)"
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
              icon={AlertTriangle}
              accent="warn"
              label="A vencer (30 dias)"
              value={fmt(expiringSoonValue)}
              hint={`${expiringSoonCount} contrato${expiringSoonCount === 1 ? '' : 's'}`}
            />
            <MetricCard
              icon={XCircle}
              accent="negative"
              label="Vencido"
              value={fmt(expiredValue)}
              hint={`${expiredCount} contrato${expiredCount === 1 ? '' : 's'}`}
            />
            <MetricCard
              icon={TrendingUp}
              accent="positive"
              label="Renovado no período"
              value={fmt(renewedValue)}
              hint={avgIncreasePct !== null ? `${avgIncreasePct >= 0 ? '+' : ''}${avgIncreasePct}% vs. valor anterior` : undefined}
            />
            <MetricCard
              icon={UserX}
              accent="negative"
              label="Churn no período"
              value={fmt(churnValue)}
              hint={`${churnCount} contrato${churnCount === 1 ? '' : 's'}`}
            />
          </>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-foreground">
          {pipelines?.find((p) => p.id === selectedPipeline)?.name ?? 'Funil'}
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
