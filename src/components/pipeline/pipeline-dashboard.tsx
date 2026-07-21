'use client'

import Link from 'next/link'
import type { RunCard } from './kanban-board'

type Stage = { id: string; name: string; order_index: number; sla_days: number | null }

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export function PipelineDashboard({
  pipelineId,
  pipelineName,
  stages,
  cards,
  allPipelines,
  selectedPipeline,
}: {
  pipelineId: string
  pipelineName: string
  stages: Stage[]
  cards: RunCard[]
  allPipelines: { id: string; name: string }[]
  selectedPipeline: string
}) {
  const open = cards.filter(c => c.status === 'open')
  const totalPipeline = open.reduce((s, c) => s + c.value, 0)

  // Oportunidades estagnadas: sem atividade há +10 dias (usamos stageEnteredAt como proxy)
  const stagnated = open
    .map(c => ({ ...c, days: daysSince(c.stageEnteredAt) }))
    .filter(c => c.days >= 10)
    .sort((a, b) => b.days - a.days)
    .slice(0, 5)

  // Negócios quentes: alto valor nas últimas 2 etapas
  const lastStageIds = stages.slice(-2).map(s => s.id)
  const hot = open
    .filter(c => lastStageIds.includes(c.stageId))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  // Volume e valor por etapa
  const byStage = stages.map(s => {
    const stageCards = open.filter(c => c.stageId === s.id)
    return { ...s, n: stageCards.length, val: stageCards.reduce((sum, c) => sum + c.value, 0) }
  })
  const maxN = Math.max(...byStage.map(s => s.n), 1)

  // Passagem entre etapas (simplificado: % de cards que chegaram pelo menos até esta etapa)
  const totalCards = open.length
  const passRate = (stageIdx: number) => {
    if (stageIdx === 0 || totalCards === 0) return null
    const cardsFromHere = byStage.slice(stageIdx).reduce((s, st) => s + st.n, 0)
    const cardsBefore = byStage.slice(stageIdx - 1).reduce((s, st) => s + st.n, 0)
    if (cardsBefore === 0) return null
    return Math.round((cardsFromHere / cardsBefore) * 100)
  }

  const kpis = [
    { label: 'Valor em pipeline', value: fmt(totalPipeline), sub: `${open.length} oportunidades` },
    { label: 'Oportunidades ativas', value: String(open.length), sub: `em ${stages.length} etapas` },
    { label: 'Negócios quentes', value: String(hot.length), sub: 'etapas finais', alert: hot.length > 0 },
    { label: 'Estagnadas +10d', value: String(stagnated.length), sub: 'sem atividade', warn: stagnated.length > 0 },
  ]

  const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', padding: '16px 20px' }
  const muted: React.CSSProperties = { fontSize: 10, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.6px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...card, padding: '14px 16px', borderColor: k.alert ? '#a7f3d0' : k.warn ? '#fde68a' : '#e8edf5' }}>
            <p style={{ ...muted, marginBottom: 6 }}>{k.label}</p>
            <p style={{ fontSize: 22, fontWeight: 500, color: k.alert ? '#1a7c3e' : k.warn ? '#92400e' : '#1a1f36', letterSpacing: '-0.5px', margin: 0 }}>{k.value}</p>
            <p style={{ fontSize: 11, color: '#8892a4', marginTop: 4 }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Funil + Estagnadas/Quentes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Funil por etapa */}
        <div style={card}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', marginBottom: 16 }}>
            Volume por etapa
            <span style={{ fontSize: 11, color: '#8892a4', fontWeight: 400, marginLeft: 6 }}>· % de passagem</span>
          </p>
          {byStage.length === 0 && <p style={{ fontSize: 12, color: '#8892a4' }}>Nenhuma etapa configurada.</p>}
          {byStage.map((s, i) => {
            const pct = passRate(i)
            const barW = maxN > 0 ? Math.round((s.n / maxN) * 100) : 0
            return (
              <div key={s.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#52514e', minWidth: 100 }}>{s.name}</span>
                  {pct !== null && (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: '#eaf5ee', color: '#1a7c3e' }}>{pct}% passam</span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8892a4' }}>
                    {s.n} · {fmt(s.val)}
                  </span>
                </div>
                <div style={{ height: 8, background: '#f1f3f8', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${barW}%`, background: '#2a78d6', borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Listas acionáveis */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Estagnadas */}
          <div style={{ ...card, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', margin: 0 }}>⚠ Estagnadas</p>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#fff8e6', color: '#92400e' }}>+10 dias sem atividade</span>
            </div>
            {stagnated.length === 0 && <p style={{ fontSize: 12, color: '#8892a4' }}>Nenhuma estagnada. Bom sinal!</p>}
            {stagnated.map(c => (
              <div key={c.runId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid #f8f9fb' }}>
                <div>
                  <Link href={`/contracts/${c.contractId}`} style={{ fontSize: 12, fontWeight: 500, color: '#1a1f36', textDecoration: 'none' }}>
                    {c.clientName || c.title}
                  </Link>
                  <p style={{ fontSize: 10, color: '#8892a4', marginTop: 1 }}>
                    {stages.find(s => s.id === c.stageId)?.name ?? '—'} · há {c.days}d
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 12, color: '#1a1f36', margin: 0 }}>{fmt(c.value)}</p>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: '#fff8e6', color: '#92400e' }}>{c.days}d parado</span>
                </div>
              </div>
            ))}
          </div>

          {/* Quentes */}
          <div style={{ ...card, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', margin: 0 }}>🔥 Negócios quentes</p>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#eaf5ee', color: '#1a7c3e' }}>alto valor · etapa final</span>
            </div>
            {hot.length === 0 && <p style={{ fontSize: 12, color: '#8892a4' }}>Nenhum nas etapas finais ainda.</p>}
            {hot.map(c => (
              <div key={c.runId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid #f8f9fb' }}>
                <div>
                  <Link href={`/contracts/${c.contractId}`} style={{ fontSize: 12, fontWeight: 500, color: '#1a1f36', textDecoration: 'none' }}>
                    {c.clientName || c.title}
                  </Link>
                  <p style={{ fontSize: 10, color: '#8892a4', marginTop: 1 }}>
                    {stages.find(s => s.id === c.stageId)?.name ?? '—'}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: '#1a7c3e', margin: 0 }}>{fmt(c.value)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
