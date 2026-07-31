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
  updated_at: string | null
  technical_comment?: string | null
  technical_restrictions?: string | null
  review_token?: string | null
  technical_snapshot?: any
  submitted_at?: string | null
  submitted_by_name?: string | null
  technical_approved_at?: string | null
  technical_approved_by_name?: string | null
  commercial_approved_at?: string | null
  commercial_approved_by_name?: string | null
  client_status?: string | null
  client_approved_by_name?: string | null
  client_approved_at?: string | null
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

const fmtDate = (d: string | null | undefined) => d
  ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : null

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
    initialData ?? { status: 'rascunho', proposal_value: null, actor_name: null, updated_at: null }
  )
  const [confirm, setConfirm] = useState<{ label: string; nextStatus: ProposalStatus } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reviewLink, setReviewLink] = useState<string | null>(
    initialData?.review_token ? `https://orbis-price.vercel.app?snapshot_id=${initialData.review_token}` : null
  )
  const [copyDone, setCopyDone] = useState(false)
  const [generatingLink, setGeneratingLink] = useState(false)

  const si = STATUS_INFO[data.status]
  const currentIdx = STEP_ORDER.indexOf(data.status)
  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  const canApproveTechnical = currentUserRole === 'aprovador_tecnico' || currentUserRole === 'admin'
  const canApproveCommercial = currentUserRole === 'aprovador_comercial' || currentUserRole === 'admin'
  const canSubmit = ['admin', 'member', 'aprovador_comercial'].includes(currentUserRole)

  async function handleGenerateLink() {
    setGeneratingLink(true)
    try {
      const res = await fetch('/api/proposals/generate-review-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract_id: contractId }),
      })
      const json = await res.json()
      if (json.token) {
        const link = `https://orbis-price.vercel.app?snapshot_id=${json.token}`
        setReviewLink(link)
        setData(prev => ({ ...prev, status: 'em_aprovacao_tecnica' }))
        await fetch('/api/proposals/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contract_id: contractId, status: 'em_aprovacao_tecnica' }),
        })
        router.refresh()
      }
    } finally { setGeneratingLink(false) }
  }

  function copyLink() {
    if (!reviewLink) return
    navigator.clipboard.writeText(reviewLink)
    setCopyDone(true)
    setTimeout(() => setCopyDone(false), 2000)
  }

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

  const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', padding: 20, marginBottom: 0 }

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
              <button onClick={() => setConfirm(null)} style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#fff', color: '#52514e', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleConfirm} style={{ padding: '8px 20px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: 'none', background: '#1a1f36', color: '#fff', cursor: 'pointer' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Status atual + Ver no Price */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#1a1f36', margin: 0 }}>Status da Proposta</p>
          <a href="https://orbis-price.vercel.app" target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#1b556b,#32af9d)', color: '#fff', textDecoration: 'none' }}>
            💰 Ver no Price
          </a>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 28 }}>{si.icon}</span>
          <span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: si.bg, color: si.color }}>{si.label}</span>
        </div>

        {/* Valor — só admin e comercial */}
        {data.proposal_value && (currentUserRole === 'admin' || currentUserRole === 'aprovador_comercial') && (
          <div style={{ background: '#f8f9fb', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#8892a4' }}>Valor da proposta</span>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#1a1f36' }}>{fmt(data.proposal_value)}/mês</span>
          </div>
        )}
      </div>

      {/* Histórico de aprovações */}
      {(data.submitted_by_name || data.technical_approved_by_name || data.commercial_approved_by_name) && (
        <div style={card}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', marginBottom: 16 }}>Histórico de Aprovações</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              data.submitted_by_name && {
                icon: '📤', label: 'Enviada para aprovação técnica',
                by: data.submitted_by_name, at: data.submitted_at,
                bg: '#f8f9fb', color: '#52514e',
              },
              data.technical_approved_by_name && {
                icon: '🔧', label: 'Aprovada tecnicamente',
                by: data.technical_approved_by_name, at: data.technical_approved_at,
                bg: '#eef3ff', color: '#3b5bdb',
              },
              data.commercial_approved_by_name && {
                icon: '✅', label: 'Aprovada comercialmente',
                by: data.commercial_approved_by_name, at: data.commercial_approved_at,
                bg: '#eaf5ee', color: '#1a7c3e',
              },
              data.client_approved_by_name && {
                icon: data.client_status === 'aprovado' ? '🤝' : '❌',
                label: data.client_status === 'aprovado' ? 'Aceita pelo cliente' : 'Declinada pelo cliente',
                by: data.client_approved_by_name, at: data.client_approved_at,
                bg: data.client_status === 'aprovado' ? '#eaf5ee' : '#fdecea',
                color: data.client_status === 'aprovado' ? '#1a7c3e' : '#b91c1c',
              },
            ].filter(Boolean).map((step: any, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '0.5px solid #f1f3f8' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: step.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                  {step.icon}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: step.color, margin: 0 }}>{step.label}</p>
                  <p style={{ fontSize: 11, color: '#8892a4', margin: '2px 0 0' }}>
                    por <strong>{step.by}</strong>
                    {step.at && ` · ${fmtDate(step.at)}`}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Parecer técnico */}
          {data.technical_comment && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: '#f8f9fb', border: '0.5px solid #e8edf5' }}>
              <p style={{ fontSize: 11, color: '#8892a4', margin: '0 0 4px', fontWeight: 500 }}>Parecer técnico</p>
              <p style={{ fontSize: 13, color: '#52514e', margin: 0 }}>{data.technical_comment}</p>
              {data.technical_restrictions && (
                <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 6, background: '#fff8e6', border: '0.5px solid #fde68a' }}>
                  <p style={{ fontSize: 11, color: '#92400e', fontWeight: 500, margin: '0 0 2px' }}>⚠ Restrições apontadas</p>
                  <p style={{ fontSize: 12, color: '#92400e', margin: 0 }}>{data.technical_restrictions}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Ações */}
      {data.status !== 'aprovado_comercial' && (
        <div style={card}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', marginBottom: 12 }}>Ações</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {data.status === 'rascunho' && canSubmit && (<>
              <button onClick={handleGenerateLink} disabled={isPending || generatingLink || !data.proposal_value}
                style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: 'none', background: data.proposal_value ? '#1b556b' : '#d1d8e8', color: '#fff', cursor: data.proposal_value ? 'pointer' : 'not-allowed', textAlign: 'left' as const }}>
                {generatingLink ? 'Gerando...' : '🔗 Gerar link de revisão técnica'}
              </button>
              {!data.proposal_value && <p style={{ fontSize: 11, color: '#b91c1c' }}>⚠ Envie o valor do Price antes de iniciar.</p>}
            </>)}

            {reviewLink && data.status === 'em_aprovacao_tecnica' && (
              <div style={{ padding: '12px 14px', borderRadius: 8, background: '#f8f9fb', border: '0.5px solid #e8edf5' }}>
                <p style={{ fontSize: 11, color: '#8892a4', margin: '0 0 8px' }}>Envie ao aprovador técnico (precisa de login no Price):</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input readOnly value={reviewLink} style={{ flex: 1, padding: '7px 10px', fontSize: 11, borderRadius: 6, border: '0.5px solid #d1d8e8', background: '#fff', fontFamily: 'monospace' }} />
                  <button onClick={copyLink} style={{ padding: '7px 14px', fontSize: 12, borderRadius: 6, border: '0.5px solid #d1d8e8', background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                    {copyDone ? '✅ Copiado' : '📋 Copiar'}
                  </button>
                </div>
              </div>
            )}

            {data.status === 'em_aprovacao_tecnica' && !reviewLink && (
              <p style={{ fontSize: 12, color: '#8892a4' }}>⏳ Aguardando aprovação técnica no Price.</p>
            )}

            {data.status === 'aprovado_tecnico' && canApproveCommercial && (
              <button onClick={() => handleAction('em_aprovacao_comercial', 'Enviar para Aprovação Comercial')} disabled={isPending}
                style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: 'none', background: '#1b556b', color: '#fff', cursor: 'pointer', textAlign: 'left' as const }}>
                ⏳ Enviar para Aprovação Comercial
              </button>
            )}

            {data.status === 'reprovado_tecnico' && canSubmit && (
              <button onClick={() => handleAction('rascunho', 'Retornar para Rascunho')} disabled={isPending}
                style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#fff', color: '#52514e', cursor: 'pointer', textAlign: 'left' as const }}>
                📝 Voltar para Rascunho
              </button>
            )}

            {data.status === 'em_aprovacao_comercial' && canApproveCommercial && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleAction('aprovado_comercial', 'Confirmar Aprovação Comercial')} disabled={isPending}
                  style={{ flex: 1, padding: '10px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: 'none', background: '#1a7c3e', color: '#fff', cursor: 'pointer' }}>
                  ✅ Aprovar Comercialmente
                </button>
                <button onClick={() => handleAction('reprovado_tecnico', 'Reprovar')} disabled={isPending}
                  style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: '0.5px solid #fca5a5', background: '#fff', color: '#b91c1c', cursor: 'pointer' }}>
                  ❌ Reprovar
                </button>
              </div>
            )}

            {data.status === 'em_aprovacao_comercial' && !canApproveCommercial && (
              <p style={{ fontSize: 12, color: '#8892a4' }}>⏳ Aguardando aprovação de um Aprovador Comercial.</p>
            )}

            {error && <p style={{ fontSize: 12, color: '#b91c1c' }}>{error}</p>}
          </div>
        </div>
      )}

      {/* Após aprovação comercial — gerar proposta */}
      {data.status === 'aprovado_comercial' && (
        <div style={card}>
          <div style={{ padding: '14px 16px', borderRadius: 10, background: '#eaf5ee', border: '0.5px solid #bbddc8', marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#1a7c3e', margin: '0 0 2px' }}>✅ Proposta aprovada internamente</p>
            <p style={{ fontSize: 12, color: '#52514e', margin: 0 }}>Gere o documento de proposta para enviar ao cliente.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={async () => {
                window.open(`/api/proposals/generate-pdf/${contractId}`, '_blank')
              }}
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', fontSize: 13, fontWeight: 500, borderRadius: 10, border: 'none', background: '#1a1f36', color: '#fff', cursor: 'pointer' }}>
              📄 Gerar Proposta PDF
            </button>
            <button
              onClick={async () => {
                // Busca a proposta gerada para este contrato
                const res = await fetch(`/api/proposals/client-token`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ contract_id: contractId }),
                })
                const json = await res.json()
                if (json.proposal_url) {
                  await navigator.clipboard.writeText(json.proposal_url)
                  alert(`✅ Link copiado!\n\n${json.proposal_url}`)
                } else if (json.token) {
                  const link = `${window.location.origin}/proposals/client/${json.token}`
                  await navigator.clipboard.writeText(link)
                  alert(`✅ Link copiado!\n\n${link}`)
                } else {
                  alert(json.error ?? 'Gere o PDF primeiro antes de enviar ao cliente.')
                }
              }}
              style={{ flex: 1, padding: '12px 20px', fontSize: 13, fontWeight: 500, borderRadius: 10, border: '0.5px solid #d1d8e8', background: '#fff', color: '#1a1f36', cursor: 'pointer' }}>
              🔗 Gerar link para cliente
            </button>
          </div>
        </div>
      )}

      {/* Fluxo visual */}
      <div style={card}>
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
                {i < STEPS.length - 1 && <div style={{ width: 28, height: 2, background: isDone ? '#32af9d' : '#e8edf5', marginBottom: 20, flexShrink: 0 }} />}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
