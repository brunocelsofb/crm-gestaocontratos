'use client'

import { useActionState } from 'react'
import { updateContract, type ActionState } from '@/lib/actions/contracts'

const initialState: ActionState = {}

export function EditContractForm({
  contractId,
  initial,
}: {
  contractId: string
  initial: {
    process_number: string
    title: string
    client_name: string
    description: string | null
    value: number
    expected_close_date: string | null
    hasOpenRun: boolean
  }
}) {
  const updateWithId = updateContract.bind(null, contractId)
  const [state, formAction, pending] = useActionState(updateWithId, initialState)

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Número do Processo <span className="text-red-500">*</span>
        </label>
        <input
          name="process_number"
          required
          defaultValue={initial.process_number}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
        />
        {state.fieldErrors?.process_number && (
          <p className="mt-1 text-xs text-red-600">{state.fieldErrors.process_number[0]}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Título</label>
        <input
          name="title"
          required
          defaultValue={initial.title}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Cliente</label>
        <input
          name="client_name"
          required
          defaultValue={initial.client_name}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Valor (R$)</label>
          <input
            name="value"
            type="number"
            step="0.01"
            min="0"
            defaultValue={initial.value}
            disabled={!initial.hasOpenRun}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
          />
          {!initial.hasOpenRun && (
            <p className="mt-1 text-xs text-gray-400">Contrato sem passagem de funil aberta — valor não editável aqui.</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Data prevista de fechamento</label>
          <input
            name="expected_close_date"
            type="date"
            defaultValue={initial.expected_close_date ?? ''}
            disabled={!initial.hasOpenRun}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Descrição</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={initial.description ?? ''}
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
