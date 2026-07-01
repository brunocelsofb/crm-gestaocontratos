'use client'

import { useActionState } from 'react'
// NOTA DE INCERTEZA: mesma ressalva já feita antes — se `useActionState`
// não existir no 'react' instalado, troque para `useFormState` de 'react-dom'.
import { createNote, type ActivityActionState } from '@/lib/actions/activities'

const initialState: ActivityActionState = {}

export function NoteForm({ contractId }: { contractId: string }) {
  const [state, formAction, pending] = useActionState(createNote, initialState)

  return (
    <form action={formAction} className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
      <input type="hidden" name="contract_id" value={contractId} />
      <input type="hidden" name="type" value="note" />
      <textarea
        name="content"
        rows={3}
        placeholder="Escreva uma nota, ex: 'Processo recebido com impugnação, respondido no prazo.'"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? 'Salvando...' : 'Adicionar nota'}
      </button>
    </form>
  )
}
