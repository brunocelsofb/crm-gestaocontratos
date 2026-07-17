'use client'

import { useState } from 'react'
import { deleteContact } from '@/lib/actions/companies'

export function RemoveContactButton({ contactId, companyId }: { contactId: string; companyId: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRemove() {
    if (!confirm('Remover este contato da empresa?')) return
    setBusy(true)
    setError(null)
    const result = await deleteContact(contactId, companyId)
    setBusy(false)
    if (result.error) setError(result.error)
  }

  return (
    <div className="text-right">
      <button type="button" onClick={handleRemove} disabled={busy} className="text-xs text-gray-400 hover:text-negative-600 disabled:opacity-50">
        {busy ? 'Removendo...' : 'Remover'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
