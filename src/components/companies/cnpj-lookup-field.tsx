'use client'

import { useState } from 'react'
import { lookupCnpj } from '@/lib/actions/cnpj-lookup'

export function CnpjLookupField({
  defaultValue,
  onFound,
}: {
  defaultValue?: string
  onFound: (data: { razaoSocial: string; nomeFantasia: string | null }) => void
}) {
  const [value, setValue] = useState(defaultValue ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLookup() {
    setError(null)
    setLoading(true)
    const result = await lookupCnpj(value)
    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    onFound({ razaoSocial: result.razaoSocial, nomeFantasia: result.nomeFantasia })
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">CNPJ</label>
      <div className="mt-1 flex gap-2">
        <input
          name="cnpj"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="00.000.000/0000-00"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleLookup}
          disabled={loading || value.replace(/\D/g, '').length !== 14}
          className="whitespace-nowrap rounded-md border border-brand-700 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? 'Buscando...' : 'Buscar dados'}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <p className="mt-1 text-xs text-gray-400">
        Busca razão social e nome fantasia automaticamente (fonte pública, comunitária — confira os dados antes de salvar).
      </p>
    </div>
  )
}
