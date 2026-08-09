'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type ProposalRow = {
  id: string
  control_code: string
  version: number
  workflow_status: string | null
  proposal_value: number | null
  created_at: string
  updated_at: string | null
  proposal_validity_days: number | null
  client_review_token: string | null
  client_approved_by_name: string | null
  contract_title: string
  contract_id: string
  responsible: string
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  em_aprovacao_tecnica:   { label: 'Análise Técnica',    color: '#92400e', bg: '#fff8e6' },
  aprovado_tecnico:       { label: 'OK Técnico',         color: '#3b5bdb', bg: '#eef3ff' },
  reprovado_tecnico:      { label: 'Reprovado',          color: '#b91c1c', bg: '#fdecea' },
  em_aprovacao_comercial: { label: 'Aprov. Comercial',   color: '#92400e', bg: '#fff8e6' },
  aprovado_comercial:     { label: 'Aguardando Cliente', color: '#1a7c3e', bg: '#eaf5ee' },
  cliente_aprovado:       { label: '✅ Aprovada',        color: '#166534', bg: '#dcfce7' },
  cliente_recusado:       { label: '❌ Recusada',        color: '#b91c1c', bg: '#fdecea' },
  rascunho:               { label: 'Rascunho',           color: '#52514e', bg: '#f1f3f8' },
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function validityDate(created: string, days: number | null) {
  if (!days) return null
  const d = new Date(created)
  d.setDate(d.getDate() + days)
  return d
}
function isExpired(created: string, days: number | null) {
  const v = validityDate(created, days)
  return v ? v < new Date() : false
}

function DropdownMenu({
  p, currentUserRole,
}: {
  p: ProposalRow
  currentUserRole: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const wStatus = p.workflow_status ?? 'rascunho'
  const isApproved = wStatus === 'cliente_aprovado'
  const isDeclined = wStatus === 'cliente_recusado'
  const canReopen  = (isApproved || isDeclined) && !!p.client_approved_by_name && ['admin','member','aprovador_comercial'].includes(currentUserRole)
  const canEdit    = !isApproved

  async function handleReopen() {
    setOpen(false)
    if (!confirm(`Reabrir ${p.control_code}? A assinatura do cliente será invalidada.`)) return
    await fetch(`/api/proposals/${p.id}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor_name: 'Gestor' }),
    })
    router.refresh()
  }

  const Item = ({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) => {
    const [hov, setHov] = useState(false)
    return (
      <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px',
          fontSize: 12, fontWeight: 500, textAlign: 'left', border: 'none', cursor: 'pointer',
          background: hov ? (danger ? '#fef2f2' : '#f8f9fb') : 'transparent',
          color: danger ? '#b91c1c' : '#1a1f36' }}>
        <span>{icon}</span>{label}
      </button>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6,
        border: '0.5px solid #d1d8e8', background: '#fff', color: '#1a1f36', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        Ações <span style={{ fontSize: 9 }}>▾</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 50,
            background: '#fff', borderRadius: 10, border: '0.5px solid #e8edf5',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 180, overflow: 'hidden' }}>
            {/* Abre a oportunidade na aba de propostas */}
            {canEdit && (
              <Item icon="✏️" label="Ver na oportunidade"
                onClick={() => { setOpen(false); window.open(`/contracts/${p.contract_id}?tab=propostas&proposal=${p.id}`, '_blank') }} />
            )}
            {isApproved && <Item icon="🔒" label="Proposta assinada" onClick={() => {}} />}
            {canReopen && (
              <Item icon="🔄" label="Reabrir proposta" onClick={handleReopen} />
            )}
            {p.client_review_token && (
              <Item icon="🔗" label="Ver link público"
                onClick={() => { setOpen(false); window.open(`/proposals/client/${p.client_review_token}`, '_blank') }} />
            )}
            <Item icon="📄" label="Gerar PDF"
              onClick={() => { setOpen(false); window.open(`/api/proposals/generate-pdf/${p.contract_id}?proposal_id=${p.id}`, '_blank') }} />
          </div>
        </>
      )}
    </div>
  )
}

const FILTERS = [
  { key: 'all',      label: 'Todas' },
  { key: 'cliente_aprovado',     label: '✅ Aprovadas' },
  { key: 'aprovado_comercial',   label: '⏳ Aguardando' },
  { key: 'em_aprovacao_tecnica', label: '🔧 Análise Téc.' },
  { key: 'cliente_recusado',     label: '❌ Recusadas' },
]

export function PropostasTable({ proposals, currentUserRole }: {
  proposals: ProposalRow[]
  currentUserRole: string
}) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const rows = proposals.filter(p => {
    const matchFilter = filter === 'all' || p.workflow_status === filter
    const q = search.toLowerCase()
    const matchSearch = !q || p.control_code.toLowerCase().includes(q) ||
      p.contract_title.toLowerCase().includes(q) || p.responsible.toLowerCase().includes(q)
    return matchFilter && matchSearch
  })

  const th: React.CSSProperties = {
    padding: '10px 14px', fontSize: 10, fontWeight: 700, color: '#b0b8c8',
    textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'left',
    borderBottom: '0.5px solid #e8edf5', background: '#f8f9fb', whiteSpace: 'nowrap',
  }
  const td: React.CSSProperties = {
    padding: '12px 14px', fontSize: 12, color: '#1a1f36',
    borderBottom: '0.5px solid #f1f3f8', verticalAlign: 'middle',
  }

  return (
    <div>
      {/* Filtros + busca */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 0, background: '#f1f3f8', borderRadius: 8, padding: 3 }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6,
              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              background: filter === f.key ? '#fff' : 'transparent',
              color: filter === f.key ? '#1a1f36' : '#8892a4',
              boxShadow: filter === f.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>
              {f.label}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por código, cliente ou responsável..."
          style={{ flex: 1, minWidth: 200, padding: '7px 12px', fontSize: 12,
            borderRadius: 8, border: '0.5px solid #d1d8e8', outline: 'none' }} />
        <span style={{ fontSize: 12, color: '#b0b8c8', whiteSpace: 'nowrap' }}>
          {rows.length} resultado{rows.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabela */}
      <div style={{ borderRadius: 12, border: '0.5px solid #e8edf5', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
          <thead>
            <tr>
              <th style={th}>Status</th>
              <th style={th}>Código</th>
              <th style={th}>Oportunidade</th>
              <th style={th}>Responsável</th>
              <th style={th}>Criação</th>
              <th style={th}>Validade</th>
              <th style={th}>Valor Total</th>
              <th style={{ ...th, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ ...td, textAlign: 'center', color: '#b0b8c8', padding: '48px 0' }}>
                  Nenhuma proposta encontrada.
                </td>
              </tr>
            ) : rows.map(p => {
              const s = STATUS[p.workflow_status ?? 'rascunho'] ?? STATUS['rascunho']
              const expired = isExpired(p.created_at, p.proposal_validity_days)
              const vDate = validityDate(p.created_at, p.proposal_validity_days)
              return (
                <tr key={p.id} style={{ background: '#fff' }}>
                  <td style={td}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11,
                      fontWeight: 600, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
                      {s.label}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: '#1a1f36' }}>
                      {p.control_code}
                    </span>
                  </td>
                  <td style={td}>
                    <Link href={`/contracts/${p.contract_id}`}
                      style={{ color: '#3b5bdb', textDecoration: 'none', fontWeight: 500 }}
                      onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
                      onMouseOut={e => (e.currentTarget.style.textDecoration = 'none')}>
                      {p.contract_title}
                    </Link>
                  </td>
                  <td style={{ ...td, color: '#52514e' }}>{p.responsible}</td>
                  <td style={{ ...td, color: '#8892a4' }}>{fmtDate(p.created_at)}</td>
                  <td style={td}>
                    {vDate ? (
                      <span style={{ color: expired ? '#b91c1c' : '#52514e', fontWeight: expired ? 600 : 400 }}>
                        {fmtDate(vDate.toISOString())}
                        {expired && <span style={{ fontSize: 9, marginLeft: 4, color: '#b91c1c' }}>VENCIDA</span>}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ ...td, fontWeight: 600, color: '#1a7c3e' }}>
                    {p.proposal_value ? fmt(p.proposal_value) : '—'}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <DropdownMenu p={p} currentUserRole={currentUserRole} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
