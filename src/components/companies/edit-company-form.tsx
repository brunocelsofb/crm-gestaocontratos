'use client'

import { useActionState, useState } from 'react'
import { updateCompany, type ActionState } from '@/lib/actions/companies'
import { CnpjLookupField } from '@/components/companies/cnpj-lookup-field'

const initialState: ActionState = {}

export function EditCompanyForm({
  companyId,
  initial,
}: {
  companyId: string
  initial: { name: string; trade_name: string | null; cnpj: string | null; notes: string | null }
}) {
  const updateWithId = updateCompany.bind(null, companyId)
  const [state, formAction, pending] = useActionState(updateWithId, initialState)
  const [name, setName] = useState(initial.name)
  const [tradeName, setTradeName] = useState(initial.trade_name ?? '')

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
      <CnpjLookupField
        defaultValue={initial.cnpj ?? ''}
        onFound={({ razaoSocial, nomeFantasia }) => {
          setName(razaoSocial)
          setTradeName(nomeFantasia ?? '')
        }}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Razão Social (Nome) <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
        />
        {state.fieldErrors?.name && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.name[0]}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Nome Fantasia</label>
        <input
          name="trade_name"
          value={tradeName}
          onChange={(e) => setTradeName(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Observações</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={initial.notes ?? ''}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {pending ? 'Salvando...' : 'Salvar Alterações'}
      </button>
    </form>
  )
}
