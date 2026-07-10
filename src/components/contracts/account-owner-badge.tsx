'use client'

import { useState } from 'react'
import { updateAccountOwner } from '@/lib/actions/workflow'

type UserOption = { id: string; full_name: string }

export function AccountOwnerBadge({
  contractId,
  ownerName,
  isAdmin,
  users,
}: {
  contractId: string
  ownerName: string | null
  isAdmin: boolean
  users: UserOption[]
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(formData: FormData) {
    setSaving(true)
    setError(null)
    const result = await updateAccountOwner(contractId, formData)
    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      setEditing(false)
    }
  }

  if (!isAdmin) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-700">
        👤 Dono da conta: {ownerName ?? 'Não definido'}
      </span>
    )
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100/70"
        title="Clique para trocar o dono da conta"
      >
        👤 Dono da conta: {ownerName ?? 'Não definido'}
      </button>
    )
  }

  return (
    <form action={handleSave} className="inline-flex items-center gap-1.5">
      <select
        name="owner_id"
        defaultValue=""
        className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-brand-700 focus:outline-none"
      >
        <option value="">Selecione...</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.full_name}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-brand-700 px-2 py-1 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {saving ? '...' : 'Salvar'}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">
        Cancelar
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  )
}
