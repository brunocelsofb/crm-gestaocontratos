import { createClient } from '@/lib/supabase/server'
import { PipelineSelect } from '@/components/pipeline/pipeline-select'
import { PeriodSelector } from '@/components/dashboard/period-selector'
import { MetricCard } from '@/components/dashboard/metric-card'
import { GoalVsBillingSection } from '@/components/dashboard/goal-vs-billing-section'
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
  searchParams: Promise<{ pipeline?: string; from?: string; to?: string; goalMonth?: string; goalYear?: string }>
}) {
  const { pipeline: pipelineIdParam, from: fromParam, to: toParam, goalMonth, goalYear } = await searchParams
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
    { data: openRuns },
    { data: wonInPeriod },
    { data: lostInPeriod },
    { data: closedRuns },
  ] = await Promise.all([
    selectedPipeline
      ? supabase.from('pipeline_runs').select('stage_id, value, contract_id').eq('pipeline_id', selectedPipeline).eq('status', 'open')
      : Promise.resolve({ data: [] as never[] }),
    selectedPipeline
      ? supabase.from('pipeline_runs').select('id, value, previous_run_id').eq('pipeline_id', selectedPipeline).eq('status', 'won').gte('ended_at', `${periodFrom}T00:00:00`).lte('ended_at', `${periodTo}T23:59:59`)
      : Promise.resolve({ data: [] as never[] }),
    selectedPipeline
      ? supabase.from('pipeline_runs').select('id, value').eq('pipeline_id', selectedPipeline).eq('status', 'lost').gte('ended_at', `${periodFrom}T00:00:00`).lte('ended_at', `${periodTo}T23:59:59`)
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

  const renewedValue = (wonInPeriod ?? []).reduce((sum, r) => sum + Number(r.value || 0), 0)
  const churnValue = (lostInPeriod ?? []).reduce((sum, r) => sum + Number(r.value || 0), 0)
  const churnCount = (lostInPeriod ?? []).length

  const previousRunIds = (wonInPeriod ?? []).map((r) => r.previous_run_id).filter((id): id is string => !!id)
  const openContractIds = [...new Set((openRuns ?? []).map((r) => r.contract_id))]

  const [{ data: previousRuns }, { data: openContractsValidity }] = await Promise.all([
    previousRunIds.length
      ? supabase.from('pipeline_runs').select('id, value').in('id', previousRunIds)
      : Promise.resolve({ data: [] as { id: string; value: number }[] }),
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

  // Métricas específicas de SERVIÇO AVULSO — receita ÚNICA, não
  // recorrente. Diferente de "Renovado", aqui não faz sentido comparar
  // com "valor anterior" (não existe uma run anterior pra comparar,
  // cada serviço é isolado) — por isso não calculamos avgIncreasePct
  // pra esse tipo.
  const avulsoWonCount = (wonInPeriod ?? []).length
  const avulsoLostCount = (lostInPeriod ?? []).length
  const avulsoClosedTotal = avulsoWonCount + avulsoLostCount
  const avulsoConversionRate = avulsoClosedTotal > 0 ? Math.round((avulsoWonCount / avulsoClosedTotal) * 100) : null
  const avulsoAvgTicket = avulsoWonCount > 0 ? renewedValue / avulsoWonCount : null

  const totalOpenLabel =
    pipelineType === 'gestao_contratos'
      ? 'Total em aberto (receita recorrente)'
      : pipelineType === 'servico_avulso'
        ? 'Total em aberto (receita única)'
        : 'Total em aberto'

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

      <div
        className={`grid gap-3 ${
          pipelineType === 'vendas'
            ? 'grid-cols-3'
            : pipelineType === 'servico_avulso'
              ? 'grid-cols-2 lg:grid-cols-4'
              : 'grid-cols-2 lg:grid-cols-5'
        }`}
      >
        <MetricCard
          icon={Wallet}
          accent="brand"
          label={totalOpenLabel}
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
        ) : pipelineType === 'servico_avulso' ? (
          <>
            <MetricCard
              icon={TrendingUp}
              accent="positive"
              label="Receita fechada no período"
              value={fmt(renewedValue)}
              hint={`${avulsoWonCount} serviço${avulsoWonCount === 1 ? '' : 's'} concluído${avulsoWonCount === 1 ? '' : 's'}`}
            />
            <MetricCard
              icon={Percent}
              accent="brand"
              label="Taxa de conclusão"
              value={avulsoConversionRate !== null ? `${avulsoConversionRate}%` : '—'}
            />
            <MetricCard
              icon={Wallet}
              accent="warn"
              label="Ticket médio"
              value={avulsoAvgTicket !== null ? fmt(avulsoAvgTicket) : '—'}
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

      {pipelineType === 'gestao_contratos' && (
        <GoalVsBillingSection
          selectedPipeline={selectedPipeline}
          month={goalMonth ? Number(goalMonth) : new Date().getMonth() + 1}
          year={goalYear ? Number(goalYear) : new Date().getFullYear()}
        />
      )}
    </div>
  )
}
