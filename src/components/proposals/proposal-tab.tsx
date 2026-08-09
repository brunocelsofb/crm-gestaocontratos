'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProposalWorkflow } from './proposal-workflow'
import { ProposalTextsEditor } from './proposal-texts-editor'
import { ProposalsSection } from './proposals-section'

type ProposalRow = {
  id: string
  control_code: string
  version: number
  workflow_status: string | null
  proposal_value: number | null
  created_at: string
  updated_at: string | null
  proposal_validity_days: number | null
  // campos do workflow
  status: string
  technical_snapshot?: any
  review_token?: string | null
  submitted_at?: string | null
  submitted_by_name?: string | null
  technical_approved_at?: string | null
  technical_approved_by_name?: string | null
  technical_approved_by_role?: string | null
  technical_comment?: string | null
  technical_restrictions?: string | null
  commercial_approved_at?: string | null
  commercial_approved_by_name?: string | null
  commercial_approved_by_role?: string | null
  client_status?: string | null
  client_approved_at?: string | null
  client_approved_by_name?: string | null
  client_review_token?: string | null
  texto_objetivos?: string | null
  texto_atividades?: string | null
  texto_estrutura_apoio?: string | null
}

type Props = {
  contractId: string
  proposals: ProposalRow[]
  priceUrl: string
  currentUserRole: string
  currentUserName: string
  catalogItems: any[]
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  rascunho:               { label: 'Rascunho',             color: '#52514e', bg: '#f1f3f8' },
  em_aprovacao_tecnica:   { label: 'Análise Técnica',      color: '#92400e', bg: '#fff8e6' },
  aprovado_tecnico:       { label: 'OK Técnico',           color: '#3b5bdb', bg: '#eef3ff' },
  reprovado_tecnico:      { label: 'Reprovado',            color: '#b91c1c', bg: '#fdecea' },
  em_aprovacao_comercial: { label: 'Aprov. Comercial',     color: '#92400e', bg: '#fff8e6' },
  aprovado_comercial:     { label: 'Aguardando Cliente',   color: '#1a7c3e', bg: '#eaf5ee' },
  cliente_aprovado:       { label: '✅ Cliente Aprovou',    color: '#166534', bg: '#dcfce7' },
  cliente_recusado:       { label: '❌ Cliente Recusou',    color: '#b91c1c', bg: '#fdecea' },
}

export function ProposalTab({ contractId, proposals, priceUrl, currentUserRole, currentUserName, catalogItems }: Props) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const selected = proposals.find(p => p.id === selectedId)

  async function handleNewProposal() {
    setCreating(true)
    const res = await fetch('/api/proposals/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contract_id: contractId }),
    })
    const data = await res.json()
    if (data.id) {
      // Recarrega para buscar a nova proposta do servidor
      router.refresh()
      // Abre a nova proposta após refresh
      setTimeout(() => setSelectedId(data.id), 500)
    }
    setCreating(false)
  }

  // Vista de detalhes
  if (selectedId && selected) {
    // Monta o initialData no formato que ProposalWorkflow espera
    const initialData = {
      status: (selected.workflow_status ?? 'rascunho') as any,
      proposal_value: selected.proposal_value,
      actor_name: null,
      updated_at: selected.updated_at,
      technical_snapshot: selected.technical_snapshot,
      review_token: selected.review_token,
      submitted_at: selected.submitted_at,
      submitted_by_name: selected.submitted_by_name,
      technical_approved_at: selected.technical_approved_at,
      technical_approved_by_name: selected.technical_approved_by_name,
      technical_approved_by_role: selected.technical_approved_by_role,
      technical_comment: selected.technical_comment,
      technical_restrictions: selected.technical_restrictions,
      commercial_approved_at: selected.commercial_approved_at,
      commercial_approved_by_name: selected.commercial_approved_by_name,
      commercial_approved_by_role: selected.commercial_approved_by_role,
      client_status: selected.client_status,
      client_approved_at: selected.client_approved_at,
      client_approved_by_name: selected.client_approved_by_name,
      client_review_token: selected.client_review_token,
    }

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1a1f36', margin: 0 }}>
              {selected.control_code} · v{selected.version}
            </p>
            <p style={{ fontSize: 12, color: '#8892a4', margin: '2px 0 0' }}>
              Criada em {fmtDate(selected.created_at)}
            </p>
          </div>
          <button onClick={() => setSelectedId(null)} style={{
            padding: '8px 14px', fontSize: 12, fontWeight: 500,
            borderRadius: 8, border: '0.5px solid #d1d8e8',
            background: '#fff', color: '#52514e', cursor: 'pointer'
          }}>
            ← Voltar para lista
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ProposalWorkflow
            key={selectedId}
            contractId={contractId}
            proposalId={selectedId}
            initialData={initialData}
            priceUrl={priceUrl}
            currentUserRole={currentUserRole}
            currentUserName={currentUserName}
          />
          {/* Textos e montagem — exclusivos para Comercial e Admin */}
          {currentUserRole !== 'aprovador_tecnico' && (
            <ProposalTextsEditor
              contractId={contractId}
              proposalId={selectedId}
              initialData={{
                texto_objetivos: selected.texto_objetivos,
                texto_atividades: selected.texto_atividades,
                texto_estrutura_apoio: selected.texto_estrutura_apoio,
              }}
            />
          )}
          {selected.workflow_status === 'aprovado_comercial' && currentUserRole !== 'aprovador_tecnico' && (
            <div id="montagem-proposta">
              <ProposalsSection
                contractId={contractId}
                proposals={proposals as any}
                catalogItems={catalogItems}
                hideCreate={true}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Vista de lista
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1a1f36', margin: 0 }}>Propostas</p>
          <p style={{ fontSize: 12, color: '#8892a4', margin: '2px 0 0' }}>
            {proposals.length === 0 ? 'Nenhuma proposta criada ainda' : `${proposals.length} proposta${proposals.length > 1 ? 's' : ''} nesta oportunidade`}
          </p>
        </div>
        <button onClick={handleNewProposal} disabled={creating} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 18px', fontSize: 13, fontWeight: 600,
          borderRadius: 8, border: 'none',
          background: '#1B556B', color: '#fff', cursor: creating ? 'not-allowed' : 'pointer',
          opacity: creating ? 0.7 : 1
        }}>
          {creating ? 'Criando...' : '+ Nova Proposta'}
        </button>
      </div>

      {proposals.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '64px 24px', background: '#fff', borderRadius: 12,
          border: '0.5px dashed #d1d8e8', textAlign: 'center'
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1f36', margin: '0 0 6px' }}>Nenhuma proposta ainda</p>
          <p style={{ fontSize: 12, color: '#8892a4', margin: '0 0 20px', maxWidth: 320 }}>
            Crie uma proposta para iniciar o fluxo de aprovação técnica e comercial.
          </p>
          <button onClick={handleNewProposal} disabled={creating} style={{
            padding: '10px 24px', fontSize: 13, fontWeight: 600,
            borderRadius: 8, border: 'none',
            background: '#1B556B', color: '#fff', cursor: 'pointer'
          }}>
            {creating ? 'Criando...' : '+ Nova Proposta'}
          </button>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '140px 2fr 1fr 1fr 1fr 80px 60px',
            padding: '10px 20px', background: '#f8f9fb',
            borderBottom: '0.5px solid #e8edf5'
          }}>
            {['Código', 'Status', 'Data', 'Valor', 'Validade', '', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 10, fontWeight: 700, color: '#b0b8c8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{h}</span>
            ))}
          </div>

          {proposals.map(p => {
            const wStatus = p.workflow_status ?? 'rascunho'
            const s = STATUS_LABEL[wStatus] ?? STATUS_LABEL['rascunho']
            return (
              <div key={p.id} style={{
                display: 'grid', gridTemplateColumns: '140px 2fr 1fr 1fr 1fr 80px 60px',
                padding: '14px 20px',
                borderBottom: '0.5px solid #f1f3f8',
              }}>
                <span style={{ fontSize: 11, color: '#1a1f36', fontWeight: 600, display: 'flex', alignItems: 'center', fontFamily: 'monospace' }}>
                  {p.control_code}
                </span>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
                    {s.label}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: '#52514e', display: 'flex', alignItems: 'center' }}>
                  {p.updated_at ? fmtDate(p.updated_at) : fmtDate(p.created_at)}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a7c3e', display: 'flex', alignItems: 'center' }}>
                  {p.proposal_value ? fmt(p.proposal_value) : '—'}
                </span>
                <span style={{ fontSize: 12, color: '#52514e', display: 'flex', alignItems: 'center' }}>
                  {p.proposal_validity_days ?? 30} dias
                </span>
                <button onClick={() => setSelectedId(p.id)} style={{
                  padding: '5px 12px', fontSize: 11, fontWeight: 600,
                  borderRadius: 6, border: '0.5px solid #d1d8e8',
                  background: '#fff', color: '#1B556B', cursor: 'pointer'
                }}>
                  ✏️ Editar
                </button>
                {currentUserRole === 'admin' && (
                  <button onClick={async () => {
                    if (!confirm(`Excluir ${p.control_code}? Esta ação não pode ser desfeita.`)) return
                    await fetch(`/api/proposals/${p.id}/delete`, { method: 'POST' })
                    router.refresh()
                  }} style={{
                    padding: '5px 8px', fontSize: 11,
                    borderRadius: 6, border: '0.5px solid #fca5a5',
                    background: '#fff', color: '#b91c1c', cursor: 'pointer'
                  }} title="Excluir proposta">
                    🗑️
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
