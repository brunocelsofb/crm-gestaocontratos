'use client'

import { useState, useTransition } from 'react'
import { deleteCompany } from '@/lib/actions/companies'

export function DeleteCompanyButton({ companyId }: { companyId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    if (!confirm('Excluir esta empresa PARA SEMPRE? Isso apaga também os contatos ligados a ela. Não tem como desfazer.')) return
    setError(null)
    startTransition(async () => {
      const result = await deleteCompany(companyId)
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
        {isPending ? 'Excluindo...' : 'Excluir empresa'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
