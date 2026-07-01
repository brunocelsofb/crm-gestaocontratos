'use client'

import { useActionState, useRef, useEffect } from 'react'
import { createPipeline, type ActionState } from '@/lib/actions/pipelines'

const initialState: ActionState = {}

export function NewPipelineForm() {
  const [state, formAction, pending] = useActionState(createPipeline, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!pending && !state.error && !state.fieldErrors) {
      formRef.current?.reset()
    }
  }, [pending, state])

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-gray-300 bg-white p-4">
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs font-medium text-gray-700">Nome do novo funil</label>
        <input
          name="name"
          required
          placeholder="Ex: Contratos Emergenciais"
          className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
        />
        {state.fieldErrors?.name && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.name[0]}</p>}
      </div>
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs font-medium text-gray-700">Descrição (opcional)</label>
        <input
          name="description"
          className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
        />
      </div>
      <div className="min-w-[180px]">
        <label className="block text-xs font-medium text-gray-700">Tipo (define as métricas do Dashboard)</label>
        <select
          name="type"
          defaultValue="gestao_contratos"
          className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
        >
          <option value="gestao_contratos">Gestão de Contratos</option>
          <option value="vendas">Vendas</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {pending ? 'Criando...' : '+ Criar Funil'}
      </button>
      {state.error && <p className="w-full text-xs text-red-600">{state.error}</p>}
    </form>
  )
}
