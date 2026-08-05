'use client'

import { useState, useTransition, useEffect } from 'react'
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

const STATUS_CONFIG: Record<ProposalStatus, { label: string; color: string; bg: string; dot: string }> = {
  rascunho:               { label: 'Rascunho',                bg: '#f1f3f8', color: '#52514e', dot: '#b0b8c8' },
  em_aprovacao_tecnica:   { label: 'Em Análise Técnica',      bg: '#fff8e6', color: '#92400e', dot: '#f59e0b' },
  aprovado_tecnico:       { label: 'Aprovado Tecnicamente',   bg: '#eef3ff', color: '#3b5bdb', dot: '#3b5bdb' },
  reprovado_tecnico:      { label: 'Reprovado — Em Revisão',  bg: '#fdecea', color: '#b91c1c', dot: '#b91c1c' },
  em_aprovacao_comercial: { label: 'Em Aprovação Comercial',  bg: '#fff8e6', color: '#92400e', dot: '#f59e0b' },
  aprovado_comercial:     { label: 'Aprovado Comercialmente', bg: '#eaf5ee', color: '#1a7c3e', dot: '#22c55e' },
}

const STEPS = [
  { key: 'rascunho',               label: 'Rascunho',       short: '1' },
  { key: 'em_aprovacao_tecnica',   label: 'Análise Técnica',short: '2' },
  { key: 'aprovado_tecnico',       label: 'OK Técnico',     short: '3' },
  { key: 'em_aprovacao_comercial', label: 'Aprov. Comercial',short: '4' },
  { key: 'aprovado_comercial',     label: 'Ag. Cliente',    short: '5' },
]
const STEP_ORDER = STEPS.map(s => s.key)

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  member: 'Comercial',
  aprovador_tecnico: 'Aprovador Técnico',
  aprovador_comercial: 'Aprovador Comercial',
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtDt(d: string | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

async function postStatus(contractId: string, status: ProposalStatus, actorName?: string, comment?: string, actorRole?: string, proposalId?: string) {
  const res = await fetch('/api/proposals/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contract_id: contractId, status, actor_name: actorName, comment, actor_role: actorRole, proposal_id: proposalId }),
  })
  return res.ok
}

// ── Subcomponente: Badge de status ─────────────────────────────────────────
function StatusBadge({ status }: { status: ProposalStatus }) {
  const c = STATUS_CONFIG[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.color, letterSpacing: '0.3px',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, display: 'inline-block' }} />
      {c.label}
    </span>
  )
}

// ── Subcomponente: Auditoria ────────────────────────────────────────────────
function AuditRow({ icon, label, by, role, at, comment, restriction }: {
  icon: string; label: string; by: string; role?: string; at?: string | null; comment?: string | null; restriction?: string | null
}) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '0.5px solid #f1f3f8' }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%', background: '#f8f9fb',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, flexShrink: 0, border: '0.5px solid #e8edf5'
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1f36', margin: '0 0 2px' }}>{label}</p>
        <p style={{ fontSize: 11, color: '#8892a4', margin: 0 }}>
          <strong style={{ color: '#52514e' }}>{by}</strong>
          {role && <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 10, background: '#f1f3f8', fontSize: 10 }}>{role}</span>}
          {at && <span style={{ marginLeft: 8 }}>· {at}</span>}
        </p>
        {comment && (
          <p style={{ fontSize: 12, color: '#52514e', margin: '8px 0 0', padding: '8px 12px', background: '#f8f9fb', borderRadius: 6, borderLeft: '2px solid #d1d8e8', lineHeight: 1.5 }}>
            "{comment}"
          </p>
        )}
        {restriction && (
          <p style={{ fontSize: 11, color: '#92400e', margin: '6px 0 0', padding: '6px 10px', background: '#fff8e6', borderRadius: 6, borderLeft: '2px solid #f59e0b' }}>
            ⚠ {restriction}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Subcomponente: Modal de confirmação com comentário ──────────────────────
function ConfirmModal({ title, subtitle, requireComment = false, onConfirm, onCancel, confirmLabel, confirmColor, role, name }: {
  title: string; subtitle?: string; requireComment?: boolean
  onConfirm: (comment: string) => void; onCancel: () => void
  confirmLabel: string; confirmColor: string; role: string; name: string
}) {
  const [comment, setComment] = useState('')
  const canConfirm = !requireComment || comment.trim().length >= 5

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(10,12,20,0.6)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)'
      }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#1a1f36', margin: '0 0 6px' }}>{title}</p>
        {subtitle && <p style={{ fontSize: 12, color: '#8892a4', margin: '0 0 20px' }}>{subtitle}</p>}

        <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: '#8892a4', margin: '0 0 2px' }}>REGISTRADO COMO</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1f36', margin: 0 }}>{name}</p>
          <p style={{ fontSize: 11, color: '#8892a4', margin: '2px 0 0' }}>{ROLE_LABELS[role] ?? role}</p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#52514e', marginBottom: 6, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            {requireComment ? 'Parecer / Comentário *' : 'Comentário (opcional)'}
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            placeholder={requireComment ? 'Descreva seu parecer sobre esta proposta...' : 'Observações adicionais...'}
            style={{
              width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8,
              border: `1.5px solid ${comment.length > 0 ? '#1b556b' : '#d1d8e8'}`,
              outline: 'none', color: '#1a1f36', resize: 'vertical', fontFamily: 'inherit',
              lineHeight: 1.5, boxSizing: 'border-box', transition: 'border-color 0.15s'
            }}
          />
          {requireComment && comment.trim().length < 5 && comment.length > 0 && (
            <p style={{ fontSize: 11, color: '#b91c1c', margin: '4px 0 0' }}>Mínimo de 5 caracteres</p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '10px', fontSize: 13, fontWeight: 500, borderRadius: 8,
            border: '0.5px solid #d1d8e8', background: '#fff', color: '#52514e', cursor: 'pointer'
          }}>Cancelar</button>
          <button
            onClick={() => canConfirm && onConfirm(comment)}
            disabled={!canConfirm}
            style={{
              flex: 2, padding: '10px', fontSize: 13, fontWeight: 600, borderRadius: 8,
              border: 'none', background: canConfirm ? confirmColor : '#d1d8e8',
              color: '#fff', cursor: canConfirm ? 'pointer' : 'not-allowed', transition: 'background 0.15s'
            }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

// ── SnapshotViewer: exibe dados técnicos do Price para o aprovador ─────────
function SnapshotViewer({ snapshot: s }: { snapshot: any }) {
  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  const kpi = (label: string, value: string | number, color = '#1a1f36') => (
    <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '10px 14px', flex: 1 }}>
      <p style={{ fontSize: 9, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 2px' }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color, margin: 0 }}>{value}</p>
    </div>
  )

  const profs = (s.professionals ?? []).filter((p: any) => p.role?.trim())
  const escopo: string[] = s.escopoSanitizado ?? s.escopoServicos ?? []
  const dim = s.dimensionamento

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KPIs principais */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {s.revenueMonthly > 0 && kpi('Valor Mensal', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.revenueMonthly), '#1a7c3e')}
        {s.hospitalBeds > 0 && kpi('Leitos', s.hospitalBeds)}
        {s.equipamentos?.total > 0 && kpi('Equipamentos', s.equipamentos.total)}
        {s.totalFTE > 0 && kpi('Profissionais', s.totalFTE)}
        {dim?.fteDemandado > 0 && kpi('FTE Demandado', dim.fteDemandado, '#3b5bdb')}
        {s.contractDuration > 0 && kpi('Duração', `${s.contractDuration} meses`)}
      </div>

      {/* Escopo */}
      {escopo.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#b0b8c8', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px' }}>Escopo de Serviços</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {escopo.map((e: string, i: number) => (
              <span key={i} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, background: '#eaf5ee', color: '#1a7c3e', border: '0.5px solid #bbddc8' }}>✓ {e}</span>
            ))}
          </div>
        </div>
      )}

      {/* Equipe */}
      {profs.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#b0b8c8', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px' }}>Equipe Alocada</p>
          <div style={{ borderRadius: 8, overflow: 'hidden', border: '0.5px solid #e8edf5' }}>
            {profs.map((p: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: i % 2 === 0 ? '#fff' : '#f8f9fb', borderBottom: '0.5px solid #f1f3f8' }}>
                <span style={{ fontSize: 12, color: '#1a1f36', fontWeight: 500 }}>{p.role}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#8892a4' }}>{p.quantity}x</span>
                  <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: p.contractType === 'CLT' ? '#eef3ff' : '#f1f3f8', color: p.contractType === 'CLT' ? '#3b5bdb' : '#52514e' }}>{p.contractType}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dimensionamento */}
      {dim?.familias?.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#b0b8c8', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px' }}>Principais Famílias</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {dim.familias.slice(0, 8).map((f: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', background: '#f8f9fb', borderRadius: 6 }}>
                <span style={{ fontSize: 11, color: '#52514e' }}>{f.familia}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#1b556b' }}>{f.qty}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ────────────────────────────────────────────────────
export function ProposalWorkflow({ contractId, proposalId, initialData, priceUrl, currentUserRole, currentUserName }: {
  contractId: string
  proposalId?: string
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
  const [reviewToken, setReviewToken] = useState<string | null>(initialData?.review_token ?? null)
  const [modal, setModal] = useState<{ action: 'approve_tech' | 'reject_tech' | 'approve_comm' | 'reject_comm' | 'send_tech' | 'send_comm' } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generatingLink, setGeneratingLink] = useState(false)

  // Busca review_token atualizado — pode ter sido salvo pelo Price após o carregamento
  useEffect(() => {
    if (!proposalId) return
    fetch(`/api/proposals/${proposalId}/token`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.review_token) setReviewToken(d.review_token) })
      .catch(() => {})
  }, [proposalId])

  const isAdmin = currentUserRole === 'admin'
  const isTech  = currentUserRole === 'aprovador_tecnico' || isAdmin
  const isComm  = currentUserRole === 'aprovador_comercial' || isAdmin
  const isCommMember = ['member', 'admin', 'aprovador_comercial'].includes(currentUserRole)
  const currentIdx = STEP_ORDER.indexOf(data.status)

  async function doAction(nextStatus: ProposalStatus, comment?: string) {
    setError(null)
    startTransition(async () => {
      const ok = await postStatus(contractId, nextStatus, currentUserName, comment, currentUserRole, proposalId)
      if (!ok) { setError('Erro ao atualizar. Tente novamente.'); return }
      setData(prev => ({
        ...prev,
        status: nextStatus,
        actor_name: currentUserName,
        updated_at: new Date().toISOString(),
        ...(nextStatus === 'em_aprovacao_tecnica' ? { submitted_by_name: currentUserName, submitted_at: new Date().toISOString() } : {}),
        ...(nextStatus === 'aprovado_tecnico' ? { technical_approved_by_name: currentUserName, technical_approved_at: new Date().toISOString(), technical_comment: comment ?? null } : {}),
        ...(nextStatus === 'reprovado_tecnico' ? { technical_approved_by_name: currentUserName, technical_approved_at: new Date().toISOString(), technical_comment: comment ?? null } : {}),
        ...(nextStatus === 'aprovado_comercial' ? { commercial_approved_by_name: currentUserName, commercial_approved_at: new Date().toISOString() } : {}),
      }))
      router.refresh()
    })
  }

  async function handleEnviarAnalise() {
    setGeneratingLink(true)
    try {
      await doAction('em_aprovacao_tecnica')
    } finally { setGeneratingLink(false) }
  }

  const card = (children: React.ReactNode, noPad = false) => (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', ...(noPad ? {} : { padding: '20px 24px' }) }}>
      {children}
    </div>
  )

  const sectionLabel = (t: string) => (
    <p style={{ fontSize: 9, fontWeight: 700, color: '#b0b8c8', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 14px' }}>{t}</p>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Modal */}
      {modal?.action === 'send_tech' && (
        <ConfirmModal
          title="Enviar para Análise Técnica"
          subtitle="A proposta será encaminhada para o aprovador técnico."
          requireComment={false}
          onConfirm={async () => {
            setModal(null)
            await handleEnviarAnalise()
          }}
          onCancel={() => setModal(null)}
          confirmLabel="Confirmar envio"
          confirmColor="#1b556b"
          role={currentUserRole}
          name={currentUserName}
        />
      )}
      {modal?.action === 'approve_tech' && (
        <ConfirmModal
          title="Aprovar Tecnicamente"
          subtitle="Confirme que o dimensionamento e o escopo estão corretos."
          requireComment
          onConfirm={async (comment) => {
            setModal(null)
            setData(prev => ({ ...prev, technical_comment: comment, technical_approved_by_name: currentUserName, technical_approved_at: new Date().toISOString() }))
            await doAction('aprovado_tecnico', comment)
          }}
          onCancel={() => setModal(null)}
          confirmLabel="✅ Confirmar Aprovação Técnica"
          confirmColor="#1a7c3e"
          role={currentUserRole}
          name={currentUserName}
        />
      )}
      {modal?.action === 'reject_tech' && (
        <ConfirmModal
          title="Reprovar Dimensionamento"
          subtitle="O processo retornará ao rascunho para revisão."
          requireComment
          onConfirm={async (comment) => {
            setModal(null)
            await doAction('reprovado_tecnico', comment)
          }}
          onCancel={() => setModal(null)}
          confirmLabel="❌ Confirmar Reprovação"
          confirmColor="#b91c1c"
          role={currentUserRole}
          name={currentUserName}
        />
      )}
      {modal?.action === 'send_comm' && (
        <ConfirmModal
          title="Enviar para Aprovação Comercial"
          subtitle="A proposta será encaminhada ao gerente comercial para aprovação final."
          requireComment={false}
          onConfirm={async () => { setModal(null); await doAction('em_aprovacao_comercial') }}
          onCancel={() => setModal(null)}
          confirmLabel="Enviar"
          confirmColor="#1b556b"
          role={currentUserRole}
          name={currentUserName}
        />
      )}
      {modal?.action === 'approve_comm' && (
        <ConfirmModal
          title="Aprovação Comercial"
          subtitle="Confirme os termos e valores antes de liberar a proposta ao cliente."
          requireComment
          onConfirm={async (comment) => {
            setModal(null)
            setData(prev => ({ ...prev, commercial_approved_by_name: currentUserName, commercial_approved_at: new Date().toISOString() }))
            await doAction('aprovado_comercial', comment)
          }}
          onCancel={() => setModal(null)}
          confirmLabel="✅ Aprovar Comercialmente"
          confirmColor="#1a7c3e"
          role={currentUserRole}
          name={currentUserName}
        />
      )}
      {modal?.action === 'reject_comm' && (
        <ConfirmModal
          title="Reprovar Proposta Comercial"
          subtitle="A proposta retornará para revisão."
          requireComment
          onConfirm={async (comment) => { setModal(null); await doAction('reprovado_tecnico', comment) }}
          onCancel={() => setModal(null)}
          confirmLabel="❌ Reprovar"
          confirmColor="#b91c1c"
          role={currentUserRole}
          name={currentUserName}
        />
      )}

      {/* ── Cabeçalho: Status + Valor + Price ────────────────────── */}
      {card(
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <div>
              {sectionLabel('Status da Proposta')}
              <StatusBadge status={data.status} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <a href={(() => {
                const url = new URL(priceUrl)
                if (proposalId) url.searchParams.set('proposal_id', proposalId)
                // Se tem snapshot, passa também para o Price carregar o estado exato
                if (reviewToken) url.searchParams.set('snapshot_id', reviewToken)
                return url.toString()
              })()} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  fontSize: 11, fontWeight: 600, borderRadius: 7, border: 'none',
                  background: 'linear-gradient(135deg,#1b556b,#2a8a7a)', color: '#fff',
                  textDecoration: 'none', letterSpacing: '0.3px'
                }}>
                <span style={{ fontSize: 14 }}>⚡</span> Abrir Price
              </a>
            </div>
          </div>

          {data.proposal_value && (isAdmin || isComm || isTech) && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'linear-gradient(135deg,#1B556B,#1e6a82)', borderRadius: 10,
              padding: '14px 18px', marginTop: 12,
            }}>
              <div>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '1px' }}>Valor Mensal</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: '#32af9d', margin: 0 }}>{fmt(data.proposal_value)}<span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>/mês</span></p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '0 0 2px' }}>ATUALIZADO EM</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: 0 }}>{fmtDt(data.updated_at)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Fluxo visual ──────────────────────────────────────────── */}
      {card(
        <div>
          {sectionLabel('Progresso de Aprovação')}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {STEPS.map((step, i) => {
              const stepIdx = STEP_ORDER.indexOf(step.key)
              const isDone = stepIdx < currentIdx
              const isActive = step.key === data.status
              return (
                <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 'none' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                      background: isActive ? '#1b556b' : isDone ? '#eaf5ee' : '#f1f3f8',
                      color: isActive ? '#fff' : isDone ? '#1a7c3e' : '#b0b8c8',
                      border: isActive ? '2px solid #32af9d' : '2px solid transparent',
                      boxShadow: isActive ? '0 0 0 4px rgba(50,175,157,0.15)' : 'none',
                      transition: 'all 0.2s'
                    }}>
                      {isDone ? '✓' : step.short}
                    </div>
                    <p style={{ fontSize: 9, color: isActive ? '#1b556b' : isDone ? '#1a7c3e' : '#b0b8c8', fontWeight: isActive ? 700 : 400, margin: 0, textAlign: 'center', lineHeight: 1.3, maxWidth: 60 }}>
                      {step.label}
                    </p>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ flex: 1, height: 2, background: isDone ? '#32af9d' : '#f1f3f8', margin: '0 4px', marginBottom: 20, borderRadius: 1 }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Histórico de aprovações ───────────────────────────────── */}
      {(data.submitted_by_name || data.technical_approved_by_name || data.commercial_approved_by_name || data.client_approved_by_name) && card(
        <div>
          {sectionLabel('Histórico de Aprovações')}
          <div style={{ marginTop: -4 }}>
            {data.submitted_by_name && (
              <AuditRow icon="📤" label="Enviada para Análise Técnica"
                by={data.submitted_by_name} role={ROLE_LABELS['member']}
                at={fmtDt(data.submitted_at) ?? undefined} />
            )}
            {data.technical_approved_by_name && (
              <AuditRow icon="🔧" label="Aprovada Tecnicamente"
                by={data.technical_approved_by_name}
                role={ROLE_LABELS[(data as any).technical_approved_by_role ?? 'aprovador_tecnico']}
                at={fmtDt(data.technical_approved_at) ?? undefined}
                comment={data.technical_comment ?? undefined}
                restriction={data.technical_restrictions ?? undefined} />
            )}
            {data.commercial_approved_by_name && (
              <AuditRow icon="✅" label="Aprovada Comercialmente"
                by={data.commercial_approved_by_name}
                role={ROLE_LABELS[(data as any).commercial_approved_by_role ?? 'aprovador_comercial']}
                at={fmtDt(data.commercial_approved_at) ?? undefined} />
            )}
            {data.client_approved_by_name && (
              <AuditRow
                icon={data.client_status === 'aprovado' ? '🤝' : '❌'}
                label={data.client_status === 'aprovado' ? 'Aceita pelo Cliente' : 'Declinada pelo Cliente'}
                by={data.client_approved_by_name}
                at={fmtDt(data.client_approved_at) ?? undefined} />
            )}
          </div>
        </div>
      )}

      {/* ── Dados técnicos para aprovador analisar ───────────────── */}
      {['em_aprovacao_tecnica', 'aprovado_tecnico', 'reprovado_tecnico', 'em_aprovacao_comercial', 'aprovado_comercial'].includes(data.status) && data.technical_snapshot && card(
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            {sectionLabel('Dimensionamento Técnico — ORBIS Price')}
            {initialData?.review_token && (
              <a href={`https://orbis-price.vercel.app?snapshot_id=${initialData.review_token}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, background: '#f1f3f8', color: '#52514e', textDecoration: 'none', fontWeight: 500 }}>
                🔍 Ver no Price
              </a>
            )}
          </div>
          <SnapshotViewer snapshot={data.technical_snapshot} />
        </div>
      )}

      {/* ── Ações ─────────────────────────────────────────────────── */}
      {data.status !== 'aprovado_comercial' && card(
        <div>
          {sectionLabel('Ações Disponíveis')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* Rascunho → Enviar para análise técnica */}
            {data.status === 'rascunho' && isCommMember && (
              <button
                onClick={() => data.proposal_value ? setModal({ action: 'send_tech' }) : setError('Envie o valor do Price antes de iniciar.')}
                disabled={isPending || generatingLink}
                style={{ padding: '11px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: '#1b556b', color: '#fff', cursor: 'pointer', textAlign: 'left' as const, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>📋</span> Enviar para Análise Técnica
              </button>
            )}
            {data.status === 'rascunho' && !data.proposal_value && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fff8e6', border: '0.5px solid #fde68a' }}>
                <p style={{ fontSize: 12, color: '#92400e', margin: 0 }}>⚠ Abra o Price pelo botão acima, dimensione e envie o valor ao CRM antes de iniciar o fluxo de aprovação.</p>
              </div>
            )}

            {/* Em análise → Aprovação técnica */}
            {data.status === 'em_aprovacao_tecnica' && isTech && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setModal({ action: 'approve_tech' })} disabled={isPending}
                  style={{ flex: 1, padding: '11px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: '#1a7c3e', color: '#fff', cursor: 'pointer' }}>
                  ✅ Aprovar Tecnicamente
                </button>
                <button onClick={() => setModal({ action: 'reject_tech' })} disabled={isPending}
                  style={{ flex: 1, padding: '11px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '0.5px solid #fca5a5', background: '#fff', color: '#b91c1c', cursor: 'pointer' }}>
                  ❌ Reprovar
                </button>
              </div>
            )}
            {data.status === 'em_aprovacao_tecnica' && !isTech && (
              <div style={{ padding: '12px 16px', borderRadius: 8, background: '#f8f9fb', border: '0.5px solid #e8edf5' }}>
                <p style={{ fontSize: 12, color: '#8892a4', margin: 0 }}>⏳ Aguardando aprovação técnica. O <strong>Aprovador Técnico</strong> deve acessar esta oportunidade no CRM e registrar o parecer.</p>
              </div>
            )}

            {/* Reprovado → Voltar ao rascunho */}
            {data.status === 'reprovado_tecnico' && isCommMember && (
              <button onClick={() => doAction('rascunho')} disabled={isPending}
                style={{ padding: '11px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#fff', color: '#52514e', cursor: 'pointer' }}>
                📝 Retornar para Rascunho
              </button>
            )}

            {/* Aprovado técnico → Enviar para comercial */}
            {data.status === 'aprovado_tecnico' && isCommMember && (
              <button onClick={() => setModal({ action: 'send_comm' })} disabled={isPending}
                style={{ padding: '11px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: '#1b556b', color: '#fff', cursor: 'pointer', textAlign: 'left' as const, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>💼</span> Enviar para Aprovação Comercial
              </button>
            )}

            {/* Em aprovação comercial */}
            {data.status === 'em_aprovacao_comercial' && isComm && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setModal({ action: 'approve_comm' })} disabled={isPending}
                  style={{ flex: 1, padding: '11px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: '#1a7c3e', color: '#fff', cursor: 'pointer' }}>
                  ✅ Aprovar Comercialmente
                </button>
                <button onClick={() => setModal({ action: 'reject_comm' })} disabled={isPending}
                  style={{ flex: 1, padding: '11px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '0.5px solid #fca5a5', background: '#fff', color: '#b91c1c', cursor: 'pointer' }}>
                  ❌ Reprovar
                </button>
              </div>
            )}
            {data.status === 'em_aprovacao_comercial' && !isComm && (
              <div style={{ padding: '12px 16px', borderRadius: 8, background: '#f8f9fb', border: '0.5px solid #e8edf5' }}>
                <p style={{ fontSize: 12, color: '#8892a4', margin: 0 }}>⏳ Aguardando aprovação comercial. Apenas <strong>Aprovadores Comerciais</strong> podem prosseguir.</p>
              </div>
            )}

            {error && <p style={{ fontSize: 12, color: '#b91c1c', margin: 0 }}>{error}</p>}
          </div>
        </div>
      )}

      {/* ── Pós-aprovação comercial ──────────────────────────────── */}
      {data.status === 'aprovado_comercial' && card(
        <div>
          {sectionLabel('Próxima Etapa')}
          <div style={{ padding: '14px 16px', borderRadius: 10, background: '#eaf5ee', border: '0.5px solid #bbddc8', marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1a7c3e', margin: '0 0 3px' }}>✅ Aprovação interna concluída</p>
            <p style={{ fontSize: 12, color: '#52514e', margin: 0 }}>Monte a proposta comercial e gere o link para o cliente assinar.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('montagem-proposta')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', fontSize: 13, fontWeight: 600, borderRadius: 9, border: 'none', background: '#1B556B', color: '#fff', cursor: 'pointer' }}>
              📄 Montar Proposta ↓
            </button>
            <button
              onClick={async () => {
                const res = await fetch('/api/proposals/client-token', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ contract_id: contractId }),
                })
                const json = await res.json()
                if (json.token) window.open(`${window.location.origin}/proposals/client/${json.token}`, '_blank')
                else alert(json.error ?? 'Erro ao gerar link')
              }}
              style={{ flex: 1, padding: '12px', fontSize: 13, fontWeight: 600, borderRadius: 9, border: '0.5px solid #d1d8e8', background: '#fff', color: '#1a1f36', cursor: 'pointer' }}>
              🔗 Portal do Cliente
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
