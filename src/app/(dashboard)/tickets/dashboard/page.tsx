import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PeriodSelector } from '@/components/dashboard/period-selector'
import { MetricCard } from '@/components/dashboard/metric-card'
import { TicketBreakdownChart } from '@/components/tickets/ticket-breakdown-chart'
import { TicketTrendChart } from '@/components/tickets/ticket-trend-chart'
import { PRIORITY_LABELS, GRAVITY_CATEGORIES } from '@/lib/utils/gut-matrix'
import { Ticket, CheckCircle2, Clock, ShieldCheck, Star } from 'lucide-react'

function currentQuarterRange() {
  const now = new Date()
  const quarter = Math.floor(now.getMonth() / 3)
  const from = new Date(now.getFullYear(), quarter * 3, 1)
  const to = new Date(now.getFullYear(), quarter * 3 + 3, 0)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(GRAVITY_CATEGORIES.map((c) => [c.value, c.label]))
const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default async function TicketsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const params = await searchParams
  const defaultRange = currentQuarterRange()
  const from = params.from ?? defaultRange.from
  const to = params.to ?? defaultRange.to

  const supabase = await createClient()

  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, status, priority, category, assigned_to, sla_due_at, resolved_at, created_at, satisfaction_rating, satisfaction_responded_at')
    .gte('created_at', `${from}T00:00:00`)
    .lte('created_at', `${to}T23:59:59`)

  const { data: allProfiles } = await supabase.from('profiles').select('id, full_name')
  const profileById = new Map((allProfiles ?? []).map((p) => [p.id, p.full_name]))

  const total = tickets?.length ?? 0
  const resolved = (tickets ?? []).filter((t) => t.status === 'resolvido' || t.status === 'fechado')

  const resolutionTimes = resolved
    .filter((t) => t.resolved_at)
    .map((t) => (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()) / 86_400_000)
  const avgResolutionDays = resolutionTimes.length > 0 ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length : null

  const resolvedWithSla = resolved.filter((t) => t.sla_due_at && t.resolved_at)
  const withinSla = resolvedWithSla.filter((t) => new Date(t.resolved_at!) <= new Date(t.sla_due_at!))
  const slaComplianceRate = resolvedWithSla.length > 0 ? Math.round((withinSla.length / resolvedWithSla.length) * 100) : null

  const satisfactionRatings = (tickets ?? []).filter((t) => t.satisfaction_responded_at).map((t) => t.satisfaction_rating as number)
  const avgSatisfaction = satisfactionRatings.length > 0 ? satisfactionRatings.reduce((a, b) => a + b, 0) / satisfactionRatings.length : null

  const categoryCounts = new Map<string, number>()
  for (const t of tickets ?? []) {
    const key = t.category ?? 'sem_categoria'
    categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1)
  }
  const categoryData = [...categoryCounts.entries()]
    .map(([key, count]) => ({ label: CATEGORY_LABELS[key] ?? 'Sem categoria', count }))
    .sort((a, b) => b.count - a.count)

  const assigneeCounts = new Map<string, number>()
  for (const t of tickets ?? []) {
    const key = t.assigned_to ?? 'sem_responsavel'
    assigneeCounts.set(key, (assigneeCounts.get(key) ?? 0) + 1)
  }
  const assigneeData = [...assigneeCounts.entries()]
    .map(([key, count]) => ({ label: key === 'sem_responsavel' ? 'Sem responsável' : profileById.get(key) ?? 'Alguém', count }))
    .sort((a, b) => b.count - a.count)

  const monthBuckets: { year: number; month: number }[] = []
  const toDate = new Date(to)
  for (let i = 5; i >= 0; i--) {
    const d = new Date(toDate.getFullYear(), toDate.getMonth() - i, 1)
    monthBuckets.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }

  const { data: trendTickets } = await supabase
    .from('tickets')
    .select('status, created_at')
    .gte('created_at', `${monthBuckets[0].year}-${String(monthBuckets[0].month).padStart(2, '0')}-01`)

  const trendData = monthBuckets.map(({ year, month }) => {
    const inMonth = (trendTickets ?? []).filter((t) => {
      const d = new Date(t.created_at)
      return d.getFullYear() === year && d.getMonth() + 1 === month
    })
    return {
      label: `${MONTH_SHORT[month - 1]}/${String(year).slice(2)}`,
      abertos: inMonth.filter((t) => t.status !== 'resolvido' && t.status !== 'fechado').length,
      resolvidos: inMonth.filter((t) => t.status === 'resolvido' || t.status === 'fechado').length,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Dashboard de Atendimento</h1>
          <p className="mt-0.5 text-sm text-gray-500">Visão consolidada dos chamados — dados de gestão à vista.</p>
        </div>
        <Link href="/tickets" className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          ← Ver lista de tickets
        </Link>
      </div>

      <PeriodSelector from={from} to={to} basePath="/tickets/dashboard" />

      <div className="grid grid-cols-5 gap-3">
        <MetricCard icon={Ticket} accent="brand" label="Total de tickets" value={String(total)} />
        <MetricCard icon={CheckCircle2} accent="positive" label="Resolvidos/Fechados" value={String(resolved.length)} hint={total > 0 ? `${Math.round((resolved.length / total) * 100)}%` : undefined} />
        <MetricCard
          icon={Clock}
          accent="warn"
          label="Tempo médio de resolução"
          value={avgResolutionDays !== null ? `${avgResolutionDays.toFixed(1)}d` : '—'}
        />
        <MetricCard
          icon={ShieldCheck}
          accent={slaComplianceRate !== null && slaComplianceRate >= 80 ? 'positive' : 'negative'}
          label="% dentro do prazo (SLA)"
          value={slaComplianceRate !== null ? `${slaComplianceRate}%` : '—'}
          hint={resolvedWithSla.length > 0 ? `${resolvedWithSla.length} avaliados` : undefined}
        />
        <MetricCard
          icon={Star}
          accent={avgSatisfaction !== null && avgSatisfaction >= 4 ? 'positive' : avgSatisfaction !== null && avgSatisfaction >= 3 ? 'warn' : 'negative'}
          label="Satisfação média"
          value={avgSatisfaction !== null ? `${avgSatisfaction.toFixed(1)}/5` : '—'}
          hint={satisfactionRatings.length > 0 ? `${satisfactionRatings.length} avaliações` : undefined}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-foreground">Abertos vs Resolvidos — últimos 6 meses</h2>
        <TicketTrendChart data={trendData} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-medium text-foreground">Por categoria</h2>
          {categoryData.length > 0 ? <TicketBreakdownChart data={categoryData} /> : <p className="text-sm text-gray-400">Sem dados no período.</p>}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-medium text-foreground">Por responsável</h2>
          {assigneeData.length > 0 ? <TicketBreakdownChart data={assigneeData} /> : <p className="text-sm text-gray-400">Sem dados no período.</p>}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {(['nao_critica', 'pouco_critica', 'critica', 'muito_critica'] as const).map((p) => {
          const count = (tickets ?? []).filter((t) => t.priority === p).length
          return (
            <div key={p} className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">{PRIORITY_LABELS[p]}</p>
              <p className="text-lg font-semibold text-gray-900">{count}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
