'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TechnicalDocument } from './technical-document'

type ProposalStatus = 
  | 'rascunho'
  | 'em_aprovacao_tecnica'
  | 'aprovado_tecnico'
  | 'reprovado_tecnico'
  | 'em_aprovacao_comercial'
  | 'aprovado_comercial'

type ProposalData = {
  status: ProposalStatus
  proposal_value: number | null
  actor_name: string | null
  actor_email: string | null
  updated_at: string | null
}

const STATUS_INFO: Record<ProposalStatus, { label: string; bg: string; color: string; icon: string }> = {
  rascunho:               { label: 'Rascunho',                   bg: '#f1f3f8', color: '#8892a4', icon: '📝' },
  em_aprovacao_tecnica:   { label: 'Em Aprovação Técnica',       bg: '#fff8e6', color: '#92400e', icon: '⏳' },
  aprovado_tecnico:       { label: 'Aprovado Tecnicamente',      bg: '#eef3ff', color: '#3b5bdb', icon: '🔧' },
  reprovado_tecnico:      { label: 'Reprovado — Em Revisão',     bg: '#fdecea', color: '#b91c1c', icon: '❌' },
  em_aprovacao_comercial: { label: 'Em Aprovação Comercial',     bg: '#fff8e6', color: '#92400e', icon: '⏳' },
  aprovado_comercial:     { label: 'Aprovado Comercialmente',    bg: '#eaf5ee', color: '#1a7c3e', icon: '✅' },
}

const STEPS = [
  { key: 'rascunho',               label: 'Rascunho',        icon: '📝' },
  { key: 'em_aprovacao_tecnica',   label: 'Aprov. Técnica',  icon: '⏳' },
  { key: 'aprovado_tecnico',       label: 'OK Técnico',      icon: '🔧' },
  { key: 'em_aprovacao_comercial', label: 'Aprov. Comercial',icon: '⏳' },
  { key: 'aprovado_comercial',     label: 'OK Comercial',    icon: '✅' },
]
const STEP_ORDER = STEPS.map(s => s.key)

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  member: 'Membro',
  aprovador_tecnico: 'Aprovador Técnico',
  aprovador_comercial: 'Aprovador Comercial',
}

async function updateStatus(contractId: string, status: ProposalStatus) {
  const res = await fetch('/api/proposals/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contract_id: contractId, status }),
  })
  return res.ok
}

export function ProposalWorkflow({ contractId, initialData, priceUrl, currentUserRole, currentUserName }: {
  contractId: string
  initialData: ProposalData | null
  priceUrl: string
  currentUserRole: string
  currentUserName: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [data, setData] = useState<ProposalData>(
    initialData ?? { status: 'rascunho', proposal_value: null, actor_name: null, actor_email: null, updated_at: null }
  )
  const [confirm, setConfirm] = useState<{ label: string; nextStatus: ProposalStatus } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const si = STATUS_INFO[data.status]
  const currentIdx = STEP_ORDER.indexOf(data.status)
  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  const canApproveTechnical = currentUserRole === 'aprovador_tecnico' || currentUserRole === 'admin'
  const canApproveCommercial = currentUserRole === 'aprovador_comercial' || currentUserRole === 'admin'
  const canSubmit = currentUserRole === 'admin' || currentUserRole === 'member' || currentUserRole === 'aprovador_comercial'

  function handleAction(nextStatus: ProposalStatus, label: string) {
    setConfirm({ label, nextStatus })
  }

  function handleConfirm() {
    const nextStatus = confirm!.nextStatus
    setConfirm(null)
    setError(null)
    startTransition(async () => {
      const ok = await updateStatus(contractId, nextStatus)
      if (!ok) { setError('Erro ao atualizar. Tente novamente.'); return }
      setData(prev => ({ ...prev, status: nextStatus, actor_name: currentUserName, updated_at: new Date().toISOString() }))
      router.refresh()
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Modal de confirmação */}
      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <p style={{ fontSize: 15, fontWeight: 500, color: '#1a1f36', marginBottom: 8 }}>{confirm.label}</p>
            <p style={{ fontSize: 12, color: '#8892a4', marginBottom: 20 }}>
              Ação registrada como <strong>{currentUserName}</strong> ({ROLE_LABELS[currentUserRole] ?? currentUserRole})
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirm(null)} style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#fff', color: '#52514e', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleConfirm} style={{ padding: '8px 20px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: 'none', background: '#1a1f36', color: '#fff', cursor: 'pointer' }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status atual */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#1a1f36', margin: 0 }}>Status da Proposta</p>
          <a href={priceUrl} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#1b556b,#32af9d)', color: '#fff', textDecoration: 'none' }}>
            💰 {data.proposal_value ? 'Abrir no Price' : 'Criar proposta no Price'}
          </a>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: data.proposal_value ? 12 : 0 }}>
          <span style={{ fontSize: 28 }}>{si.icon}</span>
          <div>
            <span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: si.bg, color: si.color }}>
              {si.label}
            </span>
            {data.actor_name && (
              <p style={{ fontSize: 11, color: '#8892a4', marginTop: 4 }}>
                por {data.actor_name} · {data.updated_at ? new Date(data.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
              </p>
            )}
          </div>
        </div>

        {/* Valor — visível só para admin e aprovador_comercial */}
        {data.proposal_value && (currentUserRole === 'admin' || currentUserRole === 'aprovador_comercial') && (
          <div style={{ background: '#f8f9fb', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#8892a4' }}>Valor da proposta</span>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#1a1f36' }}>{fmt(data.proposal_value)}/mês</span>
          </div>
        )}
        {data.proposal_value && currentUserRole === 'aprovador_tecnico' && (
          <div style={{ background: '#f8f9fb', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#8892a4' }}>
            💡 Sua aprovação é sobre a viabilidade técnica e operacional — o valor comercial é gerenciado pela equipe comercial.
          </div>
        )}
      </div>

      {/* Documento técnico — aparece quando há snapshot */}
      {(initialData as any)?.technical_snapshot && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #e8edf5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', margin: 0 }}>Documento Técnico</p>
            <span style={{ fontSize: 11, color: '#8892a4' }}>Gerado pelo ORBIS Price</span>
          </div>
          <div style={{ padding: 20 }}>
            <TechnicalDocument
              snapshot={(initialData as any).technical_snapshot}
              showFinancials={currentUserRole === 'admin' || currentUserRole === 'aprovador_comercial'}
            />
          </div>
        </div>
      )}

      {/* Ações */}
      {data.status !== 'aprovado_comercial' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', marginBottom: 12 }}>Ações disponíveis</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>

            {data.status === 'rascunho' && canSubmit && (
              <button onClick={() => handleAction('em_aprovacao_tecnica', 'Enviar para Aprovação Técnica')}
                disabled={isPending || !data.proposal_value}
                style={{ padding: '9px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: 'none', background: data.proposal_value ? '#1b556b' : '#d1d8e8', color: '#fff', cursor: data.proposal_value ? 'pointer' : 'not-allowed' }}>
                ⏳ Enviar para Aprovação Técnica
              </button>
            )}

            {data.status === 'em_aprovacao_tecnica' && canApproveTechnical && (<>
              <button onClick={() => handleAction('aprovado_tecnico', 'Confirmar Aprovação Técnica')} disabled={isPending}
                style={{ padding: '9px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: 'none', background: '#1b556b', color: '#fff', cursor: 'pointer' }}>
                🔧 Aprovar Tecnicamente
              </button>
              <button onClick={() => handleAction('reprovado_tecnico', 'Reprovar — Retornar para Revisão')} disabled={isPending}
                style={{ padding: '9px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: '0.5px solid #fca5a5', background: '#fff', color: '#b91c1c', cursor: 'pointer' }}>
                ❌ Reprovar
              </button>
            </>)}

            {data.status === 'em_aprovacao_tecnica' && !canApproveTechnical && (
              <p style={{ fontSize: 12, color: '#8892a4', padding: '8px 0' }}>
                ⏳ Aguardando aprovação de um <strong>Aprovador Técnico</strong>.
              </p>
            )}

            {data.status === 'aprovado_tecnico' && canApproveCommercial && (
              <button onClick={() => handleAction('em_aprovacao_comercial', 'Enviar para Aprovação Comercial')} disabled={isPending}
                style={{ padding: '9px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: 'none', background: '#1b556b', color: '#fff', cursor: 'pointer' }}>
                ⏳ Enviar para Aprovação Comercial
              </button>
            )}

            {data.status === 'reprovado_tecnico' && canSubmit && (
              <button onClick={() => handleAction('rascunho', 'Retornar para Rascunho')} disabled={isPending}
                style={{ padding: '9px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#fff', color: '#52514e', cursor: 'pointer' }}>
                📝 Voltar para Rascunho
              </button>
            )}

            {data.status === 'em_aprovacao_comercial' && canApproveCommercial && (<>
              <button onClick={() => handleAction('aprovado_comercial', 'Confirmar Aprovação Comercial')} disabled={isPending}
                style={{ padding: '9px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: 'none', background: '#1a7c3e', color: '#fff', cursor: 'pointer' }}>
                ✅ Aprovar Comercialmente
              </button>
              <button onClick={() => handleAction('reprovado_tecnico', 'Reprovar — Retornar para Revisão')} disabled={isPending}
                style={{ padding: '9px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: '0.5px solid #fca5a5', background: '#fff', color: '#b91c1c', cursor: 'pointer' }}>
                ❌ Reprovar
              </button>
            </>)}

            {data.status === 'em_aprovacao_comercial' && !canApproveCommercial && (
              <p style={{ fontSize: 12, color: '#8892a4', padding: '8px 0' }}>
                ⏳ Aguardando aprovação de um <strong>Aprovador Comercial</strong>.
              </p>
            )}
          </div>
          {!data.proposal_value && data.status === 'rascunho' && (
            <p style={{ fontSize: 11, color: '#b91c1c', marginTop: 8 }}>⚠ Envie o valor do Price antes de iniciar a aprovação.</p>
          )}
          {error && <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 8 }}>{error}</p>}
        </div>
      )}

      {data.status === 'aprovado_comercial' && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: '#eaf5ee', border: '0.5px solid #bbddc8', fontSize: 12, color: '#1a7c3e' }}>
          ✅ Proposta aprovada comercialmente. Você pode agora dar <strong>Ganho</strong> na oportunidade.
        </div>
      )}

      {/* Fluxo visual */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', padding: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', marginBottom: 16 }}>Fluxo de Aprovação</p>
        <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', paddingBottom: 4 }}>
          {STEPS.map((step, i) => {
            const stepIdx = STEP_ORDER.indexOf(step.key)
            const isDone = stepIdx < currentIdx
            const isActive = step.key === data.status
            return (
              <div key={step.key} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 80 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                    background: isActive ? '#1b556b' : isDone ? '#eaf5ee' : '#f1f3f8',
                    border: isActive ? '2px solid #32af9d' : '2px solid transparent',
                    boxShadow: isActive ? '0 0 0 4px rgba(50,175,157,0.15)' : 'none' }}>
                    {step.icon}
                  </div>
                  <p style={{ fontSize: 10, color: isActive ? '#1b556b' : isDone ? '#1a7c3e' : '#b0b8c8', textAlign: 'center', fontWeight: isActive ? 600 : 400, margin: 0, lineHeight: 1.3 }}>
                    {step.label}
                  </p>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ width: 28, height: 2, background: isDone ? '#32af9d' : '#e8edf5', marginBottom: 20, flexShrink: 0 }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
