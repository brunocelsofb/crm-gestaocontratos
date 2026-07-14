'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitForTechnicalApproval, decideInternalApproval } from '@/lib/actions/proposals'

export function ProposalApprovalPanel({
  proposalId,
  contractId,
  status,
}: {
  proposalId: string
  contractId: string
  status: string
}) {
  const router = useRouter()
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmitForApproval() {
    setBusy(true)
    const result = await submitForTechnicalApproval(proposalId, contractId)
    setBusy(false)
    if (result.error) setError(result.error)
    else router.refresh()
  }

  async function handleDecide(stage: 'technical' | 'commercial', decision: 'approved' | 'declined') {
    if (!comment.trim()) {
      setError('O comentário é obrigatório pra aprovar ou declinar.')
      return
    }
    setError(null)
    setBusy(true)
    const result = await decideInternalApproval(proposalId, contractId, stage, decision, comment)
    setBusy(false)
    if (result.error) {
      setError(result.error)
    } else {
      setComment('')
      router.refresh()
    }
  }

  if (status === 'draft') {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-600">Proposta em rascunho. Monte as páginas acima e envie pra pré-aprovação técnica.</p>
        <button onClick={handleSubmitForApproval} disabled={busy} className="mt-2 rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
          {busy ? 'Enviando...' : 'Enviar para pré-aprovação técnica'}
        </button>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  const stageForStatus = status === 'pending_technical' ? 'technical' : status === 'pending_commercial' ? 'commercial' : null

  if (!stageForStatus) return null

  const stageLabel = stageForStatus === 'technical' ? 'Pré-aprovação Técnica' : 'Aprovação Comercial'

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-medium text-gray-900">{stageLabel}</p>
      <p className="mt-1 text-xs text-gray-500">O comentário é obrigatório em qualquer decisão — fica gravado no histórico da oportunidade.</p>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Seu comentário sobre essa avaliação..."
        className="mt-2 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => handleDecide(stageForStatus, 'approved')}
          disabled={busy}
          className="rounded-md bg-positive-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-positive-700 disabled:opacity-50"
        >
          Aprovar
        </button>
        <button
          onClick={() => handleDecide(stageForStatus, 'declined')}
          disabled={busy}
          className="rounded-md bg-negative-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-negative-700 disabled:opacity-50"
        >
          Declinar
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
