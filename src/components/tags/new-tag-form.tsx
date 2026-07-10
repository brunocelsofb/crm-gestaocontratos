'use client'

import { useActionState, useRef, useEffect } from 'react'
import { createTag, type ActionState } from '@/lib/actions/tags'

const initialState: ActionState = {}

export function NewTagForm() {
  const [state, formAction, pending] = useActionState(createTag, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset()
  }, [pending, state])

  return (
    <form ref={formRef} action={formAction} className="flex items-end gap-2 rounded-lg border border-dashed border-gray-300 bg-white p-4">
      <input type="color" name="color" defaultValue="#6B7280" className="h-9 w-9 cursor-pointer rounded border border-gray-300" />
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-700">Nome da tag</label>
        <input
          name="name"
          required
          placeholder="Ex: Engenharia Clínica"
          className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {pending ? 'Criando...' : '+ Criar Tag'}
      </button>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  )
}
