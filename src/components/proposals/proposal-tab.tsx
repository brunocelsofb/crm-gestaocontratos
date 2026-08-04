'use client'

import { useState } from 'react'
import { ProposalWorkflow } from './proposal-workflow'
import { ProposalTextsEditor } from './proposal-texts-editor'
import { ProposalsSection } from './proposals-section'

type Props = {
  contractId: string
  proposalStatus: any | null
  priceUrl: string
  currentUserRole: string
  currentUserName: string
  proposals: any[]
  catalogItems: any[]
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  rascunho:               { label: 'Rascunho',                color: '#52514e', bg: '#f1f3f8' },
  em_aprovacao_tecnica:   { label: 'Análise Técnica',         color: '#92400e', bg: '#fff8e6' },
  aprovado_tecnico:       { label: 'OK Técnico',              color: '#3b5bdb', bg: '#eef3ff' },
  reprovado_tecnico:      { label: 'Reprovado',               color: '#b91c1c', bg: '#fdecea' },
  em_aprovacao_comercial: { label: 'Aprov. Comercial',        color: '#92400e', bg: '#fff8e6' },
  aprovado_comercial:     { label: 'Aguardando Cliente',      color: '#1a7c3e', bg: '#eaf5ee' },
  cliente_aprovado:       { label: 'Cliente Aprovou ✓',       color: '#1a7c3e', bg: '#d1fae5' },
  cliente_recusado:       { label: 'Cliente Recusou',         color: '#b91c1c', bg: '#fdecea' },
}

export function ProposalTab({ contractId, proposalStatus, priceUrl, currentUserRole, currentUserName, proposals, catalogItems }: Props) {
  const [open, setOpen] = useState(false)

  // Se já existe proposta no fluxo, mostra na lista
  const hasProposal = !!proposalStatus

  return (
    <div>
      {/* Header da aba */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1a1f36', margin: 0 }}>Propostas</p>
          <p style={{ fontSize: 12, color: '#8892a4', margin: '2px 0 0' }}>
            {hasProposal ? '1 proposta nesta oportunidade' : 'Nenhuma proposta criada ainda'}
          </p>
        </div>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', fontSize: 13, fontWeight: 600,
              borderRadius: 8, border: 'none',
              background: '#1a1f36', color: '#fff', cursor: 'pointer'
            }}>
            {hasProposal ? '📄 Abrir Proposta' : '+ Criar Proposta'}
          </button>
        )}
        {open && (
          <button
            onClick={() => setOpen(false)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', fontSize: 12, fontWeight: 500,
              borderRadius: 8, border: '0.5px solid #d1d8e8',
              background: '#fff', color: '#52514e', cursor: 'pointer'
            }}>
            ← Voltar para lista
          </button>
        )}
      </div>

      {/* Lista / Empty State */}
      {!open && (
        <>
          {!hasProposal ? (
            // Empty state
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
              <button
                onClick={() => setOpen(true)}
                style={{
                  padding: '10px 24px', fontSize: 13, fontWeight: 600,
                  borderRadius: 8, border: 'none',
                  background: 'linear-gradient(135deg,#1b556b,#2a8a7a)', color: '#fff', cursor: 'pointer'
                }}>
                + Criar Proposta
              </button>
            </div>
          ) : (
            // Tabela com a proposta existente
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', overflow: 'hidden' }}>
              {/* Header da tabela */}
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                padding: '10px 20px', background: '#f8f9fb',
                borderBottom: '0.5px solid #e8edf5'
              }}>
                {['Status', 'Data', 'Valor', 'Validade', ''].map((h, i) => (
                  <span key={i} style={{ fontSize: 10, fontWeight: 700, color: '#b0b8c8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{h}</span>
                ))}
              </div>

              {/* Linha da proposta */}
              <div
                onClick={() => setOpen(true)}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                  padding: '14px 20px', cursor: 'pointer',
                  borderBottom: '0.5px solid #f1f3f8',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fb')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                {/* Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {(() => {
                    const s = STATUS_LABEL[proposalStatus.status] ?? STATUS_LABEL['rascunho']
                    return (
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: s.bg, color: s.color
                      }}>{s.label}</span>
                    )
                  })()}
                </div>

                {/* Data */}
                <span style={{ fontSize: 12, color: '#52514e', display: 'flex', alignItems: 'center' }}>
                  {proposalStatus.updated_at ? fmtDate(proposalStatus.updated_at) : '—'}
                </span>

                {/* Valor */}
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a7c3e', display: 'flex', alignItems: 'center' }}>
                  {proposalStatus.proposal_value ? fmt(proposalStatus.proposal_value) + '/mês' : '—'}
                </span>

                {/* Validade */}
                <span style={{ fontSize: 12, color: '#52514e', display: 'flex', alignItems: 'center' }}>
                  {proposalStatus.proposal_validity_days ? `${proposalStatus.proposal_validity_days} dias` : '30 dias'}
                </span>

                {/* Ação */}
                <span style={{ fontSize: 12, color: '#1b556b', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
                  Abrir →
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Workflow completo (ao clicar em criar/abrir) */}
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ProposalWorkflow
            contractId={contractId}
            initialData={proposalStatus}
            priceUrl={priceUrl}
            currentUserRole={currentUserRole}
            currentUserName={currentUserName}
          />
          <ProposalTextsEditor
            contractId={contractId}
            initialData={proposalStatus}
          />
          {proposalStatus?.status === 'aprovado_comercial' && (
            <div id="montagem-proposta">
              <ProposalsSection
                contractId={contractId}
                proposals={proposals}
                catalogItems={catalogItems}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
