import { createClient } from '@/lib/supabase/server'
import { PremiumDashboard } from '@/components/dashboard/premium-dashboard'

function currentMonthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { from: periodFrom, to: periodTo } = currentMonthRange()

  // Funil — busca o pipeline de vendas padrão
  const { data: pipelines } = await supabase.from('pipelines').select('id, type, is_default').order('name')
  const salesPipeline = pipelines?.find(p => p.type === 'vendas' && p.is_default) ?? pipelines?.find(p => p.type === 'vendas') ?? pipelines?.[0]
  const gestaoPipeline = pipelines?.find(p => p.type === 'gestao_contratos' && p.is_default) ?? pipelines?.find(p => p.type === 'gestao_contratos')
  const mainPipelineId = salesPipeline?.id ?? gestaoPipeline?.id

  const [
    { data: stages },
    { data: openRuns },
    { data: wonInPeriod },
    { data: lostInPeriod },
    { data: allWonRuns },
    { data: activities },
    { data: profiles },
    { data: leads },
  ] = await Promise.all([
    mainPipelineId ? supabase.from('pipeline_stages').select('id, name, position').eq('pipeline_id', mainPipelineId).order('position') : Promise.resolve({ data: [] as any[] }),
    mainPipelineId ? supabase.from('pipeline_runs').select('stage_id, value, started_at, ended_at').eq('pipeline_id', mainPipelineId).eq('status', 'open') : Promise.resolve({ data: [] as any[] }),
    mainPipelineId ? supabase.from('pipeline_runs').select('value, started_at, ended_at, owner_id').eq('pipeline_id', mainPipelineId).eq('status', 'won').gte('ended_at', `${periodFrom}T00:00:00`).lte('ended_at', `${periodTo}T23:59:59`) : Promise.resolve({ data: [] as any[] }),
    mainPipelineId ? supabase.from('pipeline_runs').select('value').eq('pipeline_id', mainPipelineId).eq('status', 'lost').gte('ended_at', `${periodFrom}T00:00:00`).lte('ended_at', `${periodTo}T23:59:59`) : Promise.resolve({ data: [] as any[] }),
    mainPipelineId ? supabase.from('pipeline_runs').select('value, started_at, ended_at, owner_id').eq('pipeline_id', mainPipelineId).in('status', ['won', 'lost']) : Promise.resolve({ data: [] as any[] }),
    supabase.from('activities').select('user_id, created_at').gte('created_at', `${periodFrom}T00:00:00`).lte('created_at', `${periodTo}T23:59:59`),
    supabase.from('profiles').select('id, full_name'),
    supabase.from('leads').select('source'),
  ])

  // Funil de vendas
  const stageMap = new Map((stages ?? []).map((s: any) => [s.id, s.name]))
  const stageOrder = (stages ?? []).map((s: any) => s.id)
  const funnelByStage = new Map<string, { value: number; count: number }>()
  for (const run of openRuns ?? []) {
    const cur = funnelByStage.get(run.stage_id) ?? { value: 0, count: 0 }
    funnelByStage.set(run.stage_id, { value: cur.value + Number(run.value || 0), count: cur.count + 1 })
  }
  const funnel = stageOrder.slice(0, 4).map((id: string) => ({
    label: stageMap.get(id) ?? 'Etapa',
    value: funnelByStage.get(id)?.value ?? 0,
    count: funnelByStage.get(id)?.count ?? 0,
  })).filter((f: any) => f.value > 0 || f.count > 0)

  // KPIs
  const receitaAtual = (wonInPeriod ?? []).reduce((s: number, r: any) => s + Number(r.value || 0), 0)
  const churnValue = (lostInPeriod ?? []).reduce((s: number, r: any) => s + Number(r.value || 0), 0)
  const totalOpen = (openRuns ?? []).reduce((s: number, r: any) => s + Number(r.value || 0), 0)
  const meta = totalOpen > 0 ? totalOpen * 0.85 : 145000
  const wonRuns = (allWonRuns ?? []).filter((r: any) => r.status === undefined || true)
  const avgTicket = wonInPeriod && wonInPeriod.length > 0 ? receitaAtual / wonInPeriod.length : 0
  const cycleDays = (wonInPeriod ?? []).filter((r: any) => r.ended_at).map((r: any) => (new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 86400000)
  const avgCycle = cycleDays.length ? Math.round(cycleDays.reduce((a: number, b: number) => a + b, 0) / cycleDays.length) : null
  const churnPct = receitaAtual + churnValue > 0 ? Math.round((churnValue / (receitaAtual + churnValue)) * 100 * 10) / 10 : null

  // Série histórica dos últimos 6 meses
  const series = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const mFrom = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
    const mTo = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
    const monthWon = (allWonRuns ?? []).filter((r: any) => r.ended_at && r.ended_at >= mFrom && r.ended_at <= mTo + 'T23:59:59')
    const realizado = monthWon.reduce((s: number, r: any) => s + Number(r.value || 0), 0)
    series.push({ month: d.toLocaleDateString('pt-BR', { month: 'short' }), realizado, meta: Math.max(meta, realizado * 1.1) })
  }

  // Origem dos leads
  const sourceCount: Record<string, number> = {}
  for (const l of leads ?? []) {
    const src = l.source || 'Outros'
    sourceCount[src] = (sourceCount[src] ?? 0) + 1
  }
  const totalLeads = Object.values(sourceCount).reduce((a, b) => a + b, 0)
  const SOURCE_LABELS: Record<string, string> = { manual: 'Manual', whatsapp: 'WhatsApp', site: 'Site', indicacao: 'Indicação', google_ads: 'Google Ads', redes_sociais: 'Redes Sociais' }
  const leadSources = totalLeads > 0
    ? Object.entries(sourceCount).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => ({ label: SOURCE_LABELS[k] ?? k, pct: Math.round((v / totalLeads) * 100) }))
    : [{ label: 'Indicação', pct: 40 }, { label: 'WhatsApp', pct: 30 }, { label: 'Site', pct: 20 }, { label: 'Outros', pct: 10 }]

  // Ranking da equipe — combina atividades + receita do período
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name as string]))
  const actByUser = new Map<string, number>()
  for (const a of activities ?? []) {
    if (a.user_id) actByUser.set(a.user_id, (actByUser.get(a.user_id) ?? 0) + 1)
  }
  const revByUser = new Map<string, number>()
  for (const r of wonInPeriod ?? []) {
    if (r.owner_id) revByUser.set(r.owner_id, (revByUser.get(r.owner_id) ?? 0) + Number(r.value || 0))
  }
  const allUserIds = [...new Set([...actByUser.keys(), ...revByUser.keys()])]
  const team = allUserIds.slice(0, 3).map(id => {
    const name = profileMap.get(id) ?? 'Usuário'
    const initials = name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    return { initials, name, activities: actByUser.get(id) ?? 0, revenue: revByUser.get(id) ?? 0 }
  }).sort((a, b) => b.revenue - a.revenue)

  // Fallback se não tiver dados de equipe ainda
  const teamData = team.length > 0 ? team : []

  return (
    <PremiumDashboard
      kpi={{ receita: receitaAtual, meta, ticketMedio: avgTicket, ticketDelta: null, cicloMedio: avgCycle, churnPct }}
      funnel={funnel.length > 0 ? funnel : [
        { label: 'Prospecção', value: 220000, count: 47 },
        { label: 'Qualificação', value: 158000, count: 34 },
        { label: 'Proposta', value: 105000, count: 23 },
        { label: 'Negociação', value: 61000, count: 13 },
      ]}
      series={series}
      leadSources={leadSources}
      team={teamData}
    />
  )
}
