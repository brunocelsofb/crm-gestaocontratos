'use client'

import { useActionState } from 'react'
import { updateCompany, type ActionState } from '@/lib/actions/companies'

const initialState: ActionState = {}

export function EditCompanyForm({
  companyId,
  initial,
}: {
  companyId: string
  initial: { name: string; cnpj: string | null; notes: string | null }
}) {
  const updateWithId = updateCompany.bind(null, companyId)
  const [state, formAction, pending] = useActionState(updateWithId, initialState)

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Nome <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          required
          defaultValue={initial.name}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
        />
        {state.fieldErrors?.name && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.name[0]}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">CNPJ</label>
        <input
          name="cnpj"
          defaultValue={initial.cnpj ?? ''}
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
