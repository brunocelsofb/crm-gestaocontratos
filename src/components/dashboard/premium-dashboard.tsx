'use client'

import { useEffect, useRef } from 'react'

type KPI = { receita: number; meta: number; ticketMedio: number; ticketDelta: number | null; cicloMedio: number | null; churnPct: number | null }
type FunnelStage = { label: string; value: number; count: number }
type MonthSeries = { month: string; realizado: number; meta: number }
type LeadSource = { label: string; pct: number }
type TeamMember = { initials: string; name: string; activities: number; revenue: number }

declare global { interface Window { Chart: any } }

const COLORS = ['#4f86f7', '#6366f1', '#7c3aed', '#a855f7']

function fmt(v: number) {
  if (v >= 1000) return 'R$ ' + Math.round(v / 1000) + 'k'
  return 'R$ ' + Math.round(v).toLocaleString('pt-BR')
}

function fmtFull(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

export function PremiumDashboard({ kpi, funnel, series, leadSources, team }: {
  kpi: KPI
  funnel: FunnelStage[]
  series: MonthSeries[]
  leadSources: LeadSource[]
  team: TeamMember[]
}) {
  const areaRef = useRef<HTMLCanvasElement>(null)
  const donutRef = useRef<HTMLCanvasElement>(null)
  const areaChart = useRef<any>(null)
  const donutChart = useRef<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const load = () => {
      if (!window.Chart) return
      if (areaRef.current) {
        areaChart.current?.destroy()
        areaChart.current = new window.Chart(areaRef.current, {
          type: 'line',
          data: {
            labels: series.map(s => s.month),
            datasets: [
              { label: 'Meta', data: series.map(s => s.meta), borderColor: '#e8edf5', borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0 },
              { label: 'Faturamento', data: series.map(s => s.realizado), borderColor: '#4f86f7', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#4f86f7', fill: true, backgroundColor: 'rgba(79,134,247,0.08)', tension: 0.4 },
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, callbacks: { label: (c: any) => c.dataset.label + ': ' + fmtFull(c.parsed.y) } } },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#8892a4' } },
              y: { grid: { color: '#f1f3f8' }, ticks: { font: { size: 10 }, color: '#8892a4', callback: (v: number) => fmt(v) }, border: { display: false } }
            }
          }
        })
      }
      if (donutRef.current) {
        donutChart.current?.destroy()
        donutChart.current = new window.Chart(donutRef.current, {
          type: 'doughnut',
          data: {
            labels: leadSources.map(l => l.label),
            datasets: [{ data: leadSources.map(l => l.pct), backgroundColor: COLORS.slice(0, leadSources.length), borderWidth: 0, hoverOffset: 4 }]
          },
          options: {
            responsive: true, maintainAspectRatio: false, cutout: '68%',
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => c.label + ': ' + c.parsed + '%' } } }
          }
        })
      }
    }
    if (window.Chart) { load() } else {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
      s.onload = load
      document.head.appendChild(s)
    }
    return () => { areaChart.current?.destroy(); donutChart.current?.destroy() }
  }, [series, leadSources])

  const metaPct = kpi.meta > 0 ? Math.min(100, Math.round((kpi.receita / kpi.meta) * 100)) : 0
  const maxFunnelValue = funnel[0]?.value ?? 1

  const AVATAR_COLORS = [
    { bg: '#eef3ff', text: '#3b5bdb' },
    { bg: '#eaf5ee', text: '#1a7c3e' },
    { bg: '#fdecea', text: '#b91c1c' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filtros */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 17, fontWeight: 500, color: '#1a1f36' }}>Visão Geral Comercial</p>
          <p style={{ fontSize: 11, color: '#8892a4', marginTop: 2 }}>Atualizado agora · {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['Semana', 'Este Mês', 'Trimestre', 'Ano'].map((f, i) => (
            <button key={f} style={{ padding: '5px 12px', fontSize: 11, borderRadius: 20, border: '0.5px solid', borderColor: i === 1 ? '#1a1f36' : '#d1d8e8', background: i === 1 ? '#1a1f36' : '#fff', color: i === 1 ? '#fff' : '#8892a4', cursor: 'pointer' }}>{f}</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '0.5px solid #e8edf5' }}>
          <p style={{ fontSize: 10, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Receita vs Meta</p>
          <p style={{ fontSize: 22, fontWeight: 500, color: '#1a1f36', letterSpacing: '-0.5px' }}>{fmt(kpi.receita)}</p>
          <div style={{ height: 6, background: '#f1f3f8', borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${metaPct}%`, borderRadius: 3, background: 'linear-gradient(90deg, #4f86f7, #7c3aed)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#8892a4', marginTop: 4 }}>
            <span>{metaPct}% da meta</span><span>{fmt(kpi.meta)}</span>
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '0.5px solid #e8edf5' }}>
          <p style={{ fontSize: 10, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Ticket Médio</p>
          <p style={{ fontSize: 22, fontWeight: 500, color: '#1a1f36', letterSpacing: '-0.5px' }}>{kpi.ticketMedio > 0 ? fmt(kpi.ticketMedio) : '—'}</p>
          {kpi.ticketDelta !== null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, marginTop: 4, padding: '2px 7px', borderRadius: 20, background: kpi.ticketDelta >= 0 ? '#eaf5ee' : '#fdecea', color: kpi.ticketDelta >= 0 ? '#1a7c3e' : '#b91c1c' }}>
              {kpi.ticketDelta >= 0 ? '↑' : '↓'} {Math.abs(kpi.ticketDelta)}% vs anterior
            </span>
          )}
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '0.5px solid #e8edf5' }}>
          <p style={{ fontSize: 10, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Ciclo Médio de Vendas</p>
          <p style={{ fontSize: 22, fontWeight: 500, color: '#1a1f36', letterSpacing: '-0.5px' }}>{kpi.cicloMedio !== null ? `${kpi.cicloMedio} dias` : '—'}</p>
          {kpi.cicloMedio !== null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, marginTop: 4, padding: '2px 7px', borderRadius: 20, background: '#eaf5ee', color: '#1a7c3e' }}>↓ acima da média</span>}
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '0.5px solid #e8edf5' }}>
          <p style={{ fontSize: 10, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Taxa de Churn</p>
          <p style={{ fontSize: 22, fontWeight: 500, color: '#1a1f36', letterSpacing: '-0.5px' }}>{kpi.churnPct !== null ? `${kpi.churnPct}%` : '—'}</p>
          {kpi.churnPct !== null && kpi.churnPct > 3 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, marginTop: 4, padding: '2px 7px', borderRadius: 20, background: '#fff8e6', color: '#92400e' }}>⚠ atenção</span>}
        </div>
      </div>

      {/* Gráficos centrais */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '0.5px solid #e8edf5' }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', marginBottom: 2 }}>Funil de Vendas</p>
          <p style={{ fontSize: 10, color: '#8892a4', marginBottom: 14 }}>Volume por etapa · oportunidades ativas</p>
          {funnel.map((f, i) => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: '#8892a4', width: 72, flexShrink: 0 }}>{f.label}</span>
              <div style={{ flex: 1, height: 24, background: '#f1f3f8', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${maxFunnelValue > 0 ? Math.round((f.value / maxFunnelValue) * 100) : 0}%`, background: COLORS[i] || COLORS[3], borderRadius: 4, display: 'flex', alignItems: 'center', paddingLeft: 8, fontSize: 10, fontWeight: 500, color: '#fff', minWidth: f.value > 0 ? 40 : 0 }}>
                  {f.value > 0 ? fmt(f.value) : ''}
                </div>
              </div>
              <span style={{ fontSize: 10, color: '#8892a4', width: 24, textAlign: 'right', flexShrink: 0 }}>{f.count}</span>
            </div>
          ))}
          {funnel.length === 0 && <p style={{ fontSize: 12, color: '#8892a4' }}>Nenhuma oportunidade aberta.</p>}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            {funnel.map((f, i) => (
              <span key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#8892a4' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i] || COLORS[3] }} />{f.label}
              </span>
            ))}
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '0.5px solid #e8edf5' }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', marginBottom: 2 }}>Evolução Financeira</p>
          <p style={{ fontSize: 10, color: '#8892a4', marginBottom: 14 }}>Faturamento vs meta · últimos 6 meses</p>
          <div style={{ position: 'relative', height: 180 }}>
            <canvas ref={areaRef} role="img" aria-label="Gráfico de área comparando faturamento e meta mensal" />
          </div>
        </div>
      </div>

      {/* Linha inferior */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '0.5px solid #e8edf5' }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', marginBottom: 2 }}>Origem dos Leads</p>
          <p style={{ fontSize: 10, color: '#8892a4', marginBottom: 14 }}>Distribuição por canal de aquisição</p>
          {leadSources.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
                <canvas ref={donutRef} role="img" aria-label="Gráfico de rosca com origem dos leads" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {leadSources.map((l, i) => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i] || COLORS[3], flexShrink: 0 }} />
                    <span style={{ color: '#1a1f36' }}>{l.label}</span>
                    <span style={{ color: '#8892a4', marginLeft: 'auto' }}>{l.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p style={{ fontSize: 12, color: '#8892a4' }}>Sem dados de origem ainda.</p>}
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '0.5px solid #e8edf5' }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', marginBottom: 2 }}>Ranking da Equipe</p>
          <p style={{ fontSize: 10, color: '#8892a4', marginBottom: 14 }}>Produtividade comercial · período atual</p>
          {team.length === 0 && <p style={{ fontSize: 12, color: '#8892a4' }}>Sem dados de equipe ainda.</p>}
          {team.map((m, i) => (
            <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < team.length - 1 ? '0.5px solid #f1f3f8' : 'none' }}>
              <span style={{ fontSize: 9, fontWeight: 500, padding: '2px 6px', borderRadius: 4, background: i === 0 ? '#fff8e6' : '#f1f3f8', color: i === 0 ? '#92400e' : '#52514e' }}>#{i + 1}</span>
              <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, flexShrink: 0, background: AVATAR_COLORS[i]?.bg ?? '#f1f3f8', color: AVATAR_COLORS[i]?.text ?? '#52514e' }}>
                {m.initials}
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: '#1a1f36' }}>{m.name}</p>
                <p style={{ fontSize: 10, color: '#8892a4', marginTop: 1 }}>{m.activities} atividades</p>
              </div>
              <p style={{ fontSize: 12, fontWeight: 500, color: '#1a1f36', marginLeft: 'auto' }}>{fmt(m.revenue)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
