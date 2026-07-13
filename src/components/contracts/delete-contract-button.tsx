'use client'

import { useState, useTransition } from 'react'
import { deleteContract } from '@/lib/actions/contracts'

export function DeleteContractButton({ contractId }: { contractId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    if (!confirm('Excluir este contrato PARA SEMPRE? Isso apaga também todo o histórico, arquivos, pesquisas e faturamento ligados a ele. Não tem como desfazer.')) return
    setError(null)
    startTransition(async () => {
      const result = await deleteContract(contractId, '/pipeline')
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="text-right">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="rounded-md border border-negative-300 px-3 py-1.5 text-sm font-medium text-negative-700 hover:bg-negative-100 disabled:opacity-50"
      >
        {isPending ? 'Excluindo...' : 'Excluir contrato'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
