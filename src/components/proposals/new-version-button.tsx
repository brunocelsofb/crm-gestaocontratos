'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createProposalVersion } from '@/lib/actions/proposals'

export function NewVersionButton({ proposalId, contractId }: { proposalId: string; contractId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    if (!confirm('Criar uma nova versão desta proposta (copiando os itens, pra editar a partir daí)?')) return
    setError(null)
    startTransition(async () => {
      const result = await createProposalVersion(proposalId, contractId)
      if (result.error) {
        setError(result.error)
      } else if (result.proposalId) {
        router.push(`/contracts/${contractId}/proposals/${result.proposalId}`)
      }
    })
  }

  return (
    <div className="text-right">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {isPending ? 'Criando...' : '+ Nova versão (negociação)'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
