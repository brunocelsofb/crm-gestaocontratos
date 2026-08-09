'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Transfer = {
  id: string
  from_name: string | null
  to_name: string | null
  to_department: string | null
  reason: string | null
  desired_deadline: string | null
  status: string
  assumed_by_name: string | null
  promised_deadline: string | null
  promised_comment: string | null
  created_at: string
}

function fmtDt(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function TransferSLABanner({
  transfer,
  contractId,
  currentUserName,
  currentUserId,
  toUserId,
}: {
  transfer: Transfer
  contractId: string
  currentUserName: string
  currentUserId: string
  toUserId?: string | null
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [comment, setComment] = useState('')
  const [deadline, setDeadline] = useState('')

  const isPending    = transfer.status === 'pending'
  const isInProgress = transfer.status === 'in_progress'
  const isRecipient  = toUserId === currentUserId

  async function handleAssume() {
    setLoading(true)
    await fetch(`/api/transfers/${transfer.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assume', name: currentUserName, comment, promised_deadline: deadline || null, contract_id: contractId }),
    })
    setLoading(false); setShowForm(false); router.refresh()
  }

  async function handleComplete() {
    setLoading(true)
    await fetch(`/api/transfers/${transfer.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', name: currentUserName, comment, contract_id: contractId }),
    })
    setLoading(false); setShowForm(false); router.refresh()
  }

  const bannerStyle = {
    borderRadius: 10, padding: '14px 18px', marginBottom: 16,
    border: isPending ? '1px solid #fed7aa' : '1px solid #bfdbfe',
    background: isPending ? '#fff7ed' : '#eff6ff',
  }

  return (
    <div style={bannerStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          {isPending && (
            <p style={{ fontSize: 13, fontWeight: 600, color: '#c2410c', margin: '0 0 4px' }}>
              ⏳ Em análise com {transfer.to_name ?? transfer.to_department}
            </p>
          )}
          {isInProgress && (
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8', margin: '0 0 4px' }}>
              🔄 Em andamento: {transfer.assumed_by_name} assumiu
            </p>
          )}
          <div style={{ fontSize: 12, color: '#52514e', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {transfer.reason && <span>Motivo: {transfer.reason}</span>}
            {isPending && transfer.desired_deadline && (
              <span>Prazo desejado: <strong>{fmtDt(transfer.desired_deadline)}</strong></span>
            )}
            {isInProgress && transfer.promised_deadline && (
              <span>Retorno prometido até: <strong style={{ color: '#1d4ed8' }}>{fmtDt(transfer.promised_deadline)}</strong></span>
            )}
            {isInProgress && transfer.promised_comment && (
              <span style={{ fontStyle: 'italic' }}>{transfer.promised_comment}</span>
            )}
          </div>
        </div>

        {/* Ações para o destinatário */}
        {isRecipient && !showForm && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {isPending && (
              <button onClick={() => setShowForm(true)} style={{
                padding: '6px 14px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                border: 'none', background: '#f97316', color: '#fff', cursor: 'pointer',
              }}>
                Assumir / Definir Prazo
              </button>
            )}
            {isInProgress && (
              <button onClick={() => setShowForm(true)} style={{
                padding: '6px 14px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                border: 'none', background: '#1d4ed8', color: '#fff', cursor: 'pointer',
              }}>
                Concluir e Devolver
              </button>
            )}
          </div>
        )}
      </div>

      {/* Formulário inline */}
      {showForm && (
        <div style={{ marginTop: 12, padding: '12px', background: '#fff', borderRadius: 8, border: '0.5px solid #e8edf5' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#1a1f36', margin: '0 0 8px' }}>
            {isPending ? 'Assumir análise' : 'Concluir e devolver'}
          </p>
          {isPending && (
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, color: '#8892a4' }}>Data de retorno prometida</label>
              <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '0.5px solid #d1d8e8', outline: 'none' }} />
            </div>
          )}
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: '#8892a4' }}>{isPending ? 'Comentário (opcional)' : 'Parecer final'}</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '0.5px solid #d1d8e8', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={isPending ? handleAssume : handleComplete} disabled={loading}
              style={{ padding: '6px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', background: '#1B556B', color: '#fff', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Salvando...' : isPending ? 'Confirmar assunção' : 'Confirmar conclusão'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, border: '0.5px solid #d1d8e8', background: '#fff', cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
