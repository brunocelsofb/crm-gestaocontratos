'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitForTechnicalApproval, decideInternalApproval } from '@/lib/actions/proposals'

type UserOption = { id: string; full_name: string }

export function ProposalApprovalPanel({
  proposalId,
  contractId,
  status,
  technicalUsers,
  commercialUsers,
  assignedTechnicalName,
  assignedCommercialName,
}: {
  proposalId: string
  contractId: string
  status: string
  technicalUsers: UserOption[]
  commercialUsers: UserOption[]
  assignedTechnicalName: string | null
  assignedCommercialName: string | null
}) {
  const router = useRouter()
  const [comment, setComment] = useState('')
  const [technicalApprover, setTechnicalApprover] = useState('')
  const [nextCommercialApprover, setNextCommercialApprover] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmitForApproval() {
    if (!technicalApprover) {
      setError('Escolha quem vai fazer a pré-aprovação técnica.')
      return
    }
    setError(null)
    setBusy(true)
    const result = await submitForTechnicalApproval(proposalId, contractId, technicalApprover)
    setBusy(false)
    if (result.error) setError(result.error)
    else router.refresh()
  }

  async function handleDecide(stage: 'technical' | 'commercial', decision: 'approved' | 'declined') {
    if (!comment.trim()) {
      setError('O comentário é obrigatório pra aprovar ou declinar.')
      return
    }
    if (stage === 'technical' && decision === 'approved' && !nextCommercialApprover) {
      setError('Escolha quem vai fazer a aprovação comercial.')
      return
    }
    setError(null)
    setBusy(true)
    const result = await decideInternalApproval(proposalId, contractId, stage, decision, comment, nextCommercialApprover || undefined)
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
        <p className="text-sm text-gray-600">Proposta em rascunho. Monte as páginas acima e escolha quem faz a pré-aprovação técnica.</p>
        <div className="mt-2">
          <label className="block text-[10px] text-gray-500">Aprovador técnico</label>
          <select
            value={technicalApprover}
            onChange={(e) => setTechnicalApprover(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
          >
            <option value="">Selecione...</option>
            {technicalUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </div>
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
  const assignedName = stageForStatus === 'technical' ? assignedTechnicalName : assignedCommercialName

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-medium text-gray-900">{stageLabel}</p>
      <p className="mt-0.5 text-xs text-gray-500">Designado(a): <span className="font-medium text-gray-700">{assignedName ?? '—'}</span></p>
      <p className="mt-1 text-xs text-gray-500">O comentário é obrigatório em qualquer decisão — fica gravado no histórico da oportunidade.</p>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Seu comentário sobre essa avaliação..."
        className="mt-2 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
      />

      {stageForStatus === 'technical' && (
        <div className="mt-2">
          <label className="block text-[10px] text-gray-500">Se aprovar, designar aprovação comercial pra</label>
          <select
            value={nextCommercialApprover}
            onChange={(e) => setNextCommercialApprover(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
          >
            <option value="">Selecione...</option>
            {commercialUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </div>
      )}

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
