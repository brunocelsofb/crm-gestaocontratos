'use client'

import { useActionState, useRef, useEffect } from 'react'
import { createContact, type ActionState } from '@/lib/actions/companies'

const initialState: ActionState = {}

export function AddContactForm({ companyId }: { companyId: string }) {
  const createWithId = createContact.bind(null, companyId)
  const [state, formAction, pending] = useActionState(createWithId, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  // Limpa o formulário depois de um envio bem-sucedido (sem erro nem
  // fieldErrors), já que essa action não redireciona como as outras.
  useEffect(() => {
    if (!pending && !state.error && !state.fieldErrors) {
      formRef.current?.reset()
    }
  }, [pending, state])

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-gray-700">Nome *</label>
        <input
          name="name"
          required
          className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
        />
        {state.fieldErrors?.name && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.name[0]}</p>}
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-gray-700">Cargo</label>
        <input
          name="role"
          placeholder="Ex: Financeiro, Jurídico..."
          className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-gray-700">E-mail</label>
        <input
          name="email"
          type="email"
          className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-gray-700">Telefone</label>
        <input
          name="phone"
          className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
        />
      </div>

      {state.error && <p className="col-span-2 text-xs text-red-600">{state.error}</p>}

      <div className="col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {pending ? 'Adicionando...' : '+ Adicionar Contato'}
        </button>
      </div>
    </form>
  )
}
