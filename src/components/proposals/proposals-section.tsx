'use client'

import { useState } from 'react'
import Link from 'next/link'
import { NewProposalForm } from '@/components/proposals/new-proposal-form'

type Proposal = { id: string; control_code: string; status: string; version: number; created_at: string }

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  pending_technical: 'Aguardando pré-aprovação técnica',
  pending_commercial: 'Aguardando aprovação comercial',
  declined_internal: 'Declinada internamente',
  pending_client: 'Aguardando o cliente',
  approved: 'Aprovada pelo cliente',
  declined_client: 'Declinada pelo cliente',
}
const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_technical: 'bg-yellow-100 text-yellow-800',
  pending_commercial: 'bg-yellow-100 text-yellow-800',
  declined_internal: 'bg-negative-100 text-negative-700',
  pending_client: 'bg-blue-100 text-blue-700',
  approved: 'bg-positive-100 text-positive-700',
  declined_client: 'bg-negative-100 text-negative-700',
}

type CatalogItem = { id: string; name: string; category: string | null; type: string | null; characteristics: string | null; unit_value: number }

export function ProposalsSection({
  contractId,
  proposals,
  catalogItems,
}: {
  contractId: string
  proposals: Proposal[]
  catalogItems: CatalogItem[]
}) {
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-900">Propostas Comerciais</h2>
        {!creating && (
          <button onClick={() => setCreating(true)} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800">
            + Nova Proposta
          </button>
        )}
      </div>

      {creating && <NewProposalForm contractId={contractId} catalogItems={catalogItems} onCancel={() => setCreating(false)} />}

      <div className="space-y-1.5">
        {proposals.map((p) => (
          <Link
            key={p.id}
            href={`/contracts/${contractId}/proposals/${p.id}`}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            <div>
              <span className="font-medium text-gray-900">{p.control_code}</span>
              <span className="ml-2 text-xs text-gray-400">v{p.version} · {new Date(p.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[p.status]}`}>
              {STATUS_LABELS[p.status]}
            </span>
          </Link>
        ))}
        {proposals.length === 0 && !creating && <p className="text-sm text-gray-400">Nenhuma proposta criada ainda.</p>}
      </div>
    </div>
  )
}
