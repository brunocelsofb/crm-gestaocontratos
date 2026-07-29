'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

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
  reprovado_tecnico:      { label: 'Reprovado Tecnicamente',     bg: '#fdecea', color: '#b91c1c', icon: '❌' },
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

async function updateProposalStatus(
  contractId: string,
  status: ProposalStatus,
  actorName: string,
  actorEmail: string,
  proposalValue?: number | null,
) {
  const res = await fetch('/api/proposals/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contract_id: contractId,
      status,
      actor_name: actorName,
      actor_email: actorEmail,
      proposal_value: proposalValue,
    }),
  })
  return res.ok
}

function ActorModal({ title, onConfirm, onCancel }: {
  title: string
  onConfirm: (name: string, email: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const valid = name.trim().length > 0 && email.includes('@')
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '0.5px solid #d1d8e8', outline: 'none', color: '#1a1f36' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
        <p style={{ fontSize: 15, fontWeight: 500, color: '#1a1f36', marginBottom: 16 }}>{title}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#8892a4', marginBottom: 4 }}>Seu nome</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Carlos Mendes" style={inp} autoFocus />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#8892a4', marginBottom: 4 }}>Seu e-mail</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="carlos@orbis.com.br" style={inp} type="email" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#fff', color: '#52514e', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={() => valid && onConfirm(name.trim(), email.trim())} disabled={!valid}
            style={{ padding: '8px 20px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: 'none', background: valid ? '#1a1f36' : '#d1d8e8', color: '#fff', cursor: valid ? 'pointer' : 'not-allowed' }}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

export function ProposalWorkflow({ contractId, initialData, priceUrl }: {
  contractId: string
  initialData: ProposalData | null
  priceUrl: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [data, setData] = useState<ProposalData>(initialData ?? { status: 'rascunho', proposal_value: null, actor_name: null, actor_email: null, updated_at: null })
  const [modal, setModal] = useState<{ title: string; nextStatus: ProposalStatus } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const si = STATUS_INFO[data.status]
  const currentIdx = STEP_ORDER.indexOf(data.status)

  function handleAction(nextStatus: ProposalStatus, title: string) {
    setModal({ title, nextStatus })
  }

  function handleConfirm(name: string, email: string) {
    const nextStatus = modal!.nextStatus
    setModal(null)
    setError(null)
    startTransition(async () => {
      const ok = await updateProposalStatus(contractId, nextStatus, name, email, data.proposal_value)
      if (!ok) { setError('Erro ao atualizar status. Tente novamente.'); return }
      setData(prev => ({ ...prev, status: nextStatus, actor_name: name, actor_email: email, updated_at: new Date().toISOString() }))
      router.refresh()
    })
  }

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {modal && <ActorModal title={modal.title} onConfirm={handleConfirm} onCancel={() => setModal(null)} />}

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

        {data.proposal_value && (
          <div style={{ background: '#f8f9fb', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#8892a4' }}>Valor da proposta</span>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#1a1f36' }}>{fmt(data.proposal_value)}/mês</span>
          </div>
        )}
      </div>

      {/* Ações disponíveis */}
      {data.status !== 'aprovado_comercial' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', marginBottom: 12 }}>Ações</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {data.status === 'rascunho' && (
              <button onClick={() => handleAction('em_aprovacao_tecnica', 'Enviar para Aprovação Técnica')} disabled={isPending || !data.proposal_value}
                style={{ padding: '9px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: 'none', background: data.proposal_value ? '#1b556b' : '#d1d8e8', color: '#fff', cursor: data.proposal_value ? 'pointer' : 'not-allowed', opacity: isPending ? 0.6 : 1 }}>
                ⏳ Enviar para Aprovação Técnica
              </button>
            )}
            {data.status === 'em_aprovacao_tecnica' && (<>
              <button onClick={() => handleAction('aprovado_tecnico', 'Confirmar Aprovação Técnica')} disabled={isPending}
                style={{ padding: '9px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: 'none', background: '#1b556b', color: '#fff', cursor: 'pointer', opacity: isPending ? 0.6 : 1 }}>
                🔧 Aprovar Tecnicamente
              </button>
              <button onClick={() => handleAction('reprovado_tecnico', 'Reprovar Tecnicamente')} disabled={isPending}
                style={{ padding: '9px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: '0.5px solid #fca5a5', background: '#fff', color: '#b91c1c', cursor: 'pointer', opacity: isPending ? 0.6 : 1 }}>
                ❌ Reprovar
              </button>
            </>)}
            {data.status === 'aprovado_tecnico' && (
              <button onClick={() => handleAction('em_aprovacao_comercial', 'Enviar para Aprovação Comercial')} disabled={isPending}
                style={{ padding: '9px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: 'none', background: '#1b556b', color: '#fff', cursor: 'pointer', opacity: isPending ? 0.6 : 1 }}>
                ⏳ Enviar para Aprovação Comercial
              </button>
            )}
            {data.status === 'reprovado_tecnico' && (
              <button onClick={() => handleAction('rascunho', 'Retornar para Rascunho')} disabled={isPending}
                style={{ padding: '9px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#fff', color: '#52514e', cursor: 'pointer', opacity: isPending ? 0.6 : 1 }}>
                📝 Voltar para Rascunho
              </button>
            )}
            {data.status === 'em_aprovacao_comercial' && (<>
              <button onClick={() => handleAction('aprovado_comercial', 'Confirmar Aprovação Comercial')} disabled={isPending}
                style={{ padding: '9px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: 'none', background: '#1a7c3e', color: '#fff', cursor: 'pointer', opacity: isPending ? 0.6 : 1 }}>
                ✅ Aprovar Comercialmente
              </button>
              <button onClick={() => handleAction('reprovado_tecnico', 'Reprovar — Retornar para Revisão')} disabled={isPending}
                style={{ padding: '9px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: '0.5px solid #fca5a5', background: '#fff', color: '#b91c1c', cursor: 'pointer', opacity: isPending ? 0.6 : 1 }}>
                ❌ Reprovar
              </button>
            </>)}
          </div>
          {!data.proposal_value && data.status === 'rascunho' && (
            <p style={{ fontSize: 11, color: '#b91c1c', marginTop: 8 }}>⚠ Envie o valor do Price antes de iniciar a aprovação.</p>
          )}
          {error && <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 8 }}>{error}</p>}
        </div>
      )}

      {data.status === 'aprovado_comercial' && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: '#eaf5ee', border: '0.5px solid #bbddc8', fontSize: 12, color: '#1a7c3e' }}>
          ✅ Proposta aprovada comercialmente. Você pode agora dar <strong>Ganho</strong> na oportunidade para iniciar a gestão do contrato.
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

      {/* Histórico de audit log */}
      {data.actor_name && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', marginBottom: 12 }}>Última Ação</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: si.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
              {si.icon}
            </div>
            <div>
              <p style={{ fontSize: 13, color: '#1a1f36', margin: 0, fontWeight: 500 }}>{si.label}</p>
              <p style={{ fontSize: 11, color: '#8892a4', marginTop: 2 }}>
                {data.actor_name} · {data.actor_email}
              </p>
              {data.updated_at && (
                <p style={{ fontSize: 10, color: '#b0b8c8', marginTop: 2 }}>
                  {new Date(data.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
