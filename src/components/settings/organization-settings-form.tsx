'use client'

import { useActionState } from 'react'
import { updateOrganizationSettings, type ActionState } from '@/lib/actions/settings'

const initialState: ActionState = {}

export function OrganizationSettingsForm({ currentName }: { currentName: string }) {
  const [state, formAction, pending] = useActionState(updateOrganizationSettings, initialState)

  return (
    <form action={formAction} className="max-w-md space-y-4 rounded-lg border border-gray-200 bg-white p-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">Nome da organização</label>
        <input
          name="name"
          required
          defaultValue={currentName}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-400">Aparece no menu lateral do sistema.</p>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {pending ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  )
}
