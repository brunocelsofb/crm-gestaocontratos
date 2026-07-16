'use client'

import { useState } from 'react'
import { saveContractCustomFieldValues } from '@/lib/actions/custom-fields'

type CustomField = { id: string; name: string; field_key: string; field_type: string; select_options: string[] | null }

export function ContractCustomFieldsSection({
  contractId,
  fields,
  values,
}: {
  contractId: string
  fields: CustomField[]
  values: Record<string, string>
}) {
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave(formData: FormData) {
    setBusy(true)
    setSaved(false)
    await saveContractCustomFieldValues(contractId, formData)
    setBusy(false)
    setSaved(true)
  }

  if (fields.length === 0) return null

  return (
    <form action={handleSave} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-medium text-gray-900">Campos customizados</p>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.id}>
            <label className="block text-xs text-gray-500">{f.name}</label>
            {f.field_type === 'select' ? (
              <select name={`field_${f.id}`} defaultValue={values[f.field_key] ?? ''} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
                <option value="">—</option>
                {(f.select_options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : (
              <input
                name={`field_${f.id}`}
                type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                defaultValue={values[f.field_key] ?? ''}
                className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
              />
            )}
          </div>
        ))}
      </div>
      <button type="submit" disabled={busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
        {busy ? 'Salvando...' : 'Salvar'}
      </button>
      {saved && <span className="ml-2 text-xs text-positive-700">Salvo!</span>}
    </form>
  )
}
