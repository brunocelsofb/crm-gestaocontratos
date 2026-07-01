'use client'

// NOTA DE INCERTEZA: estou usando o hook `useActionState` (de 'react'),
// que é o padrão mais recente para ligar formulários a Server Actions
// no App Router. Em versões mais antigas do Next.js/React, o hook
// equivalente se chamava `useFormState` e vinha de 'react-dom'.
// Se `useActionState` não existir no pacote 'react' que você instalar,
// troque a importação para `useFormState` de 'react-dom' — a API é
// quase idêntica. Verifique a documentação atual do Next.js para
// confirmar qual está correto na versão que você está usando.

import { useActionState } from 'react'
import { useEffect, useState } from 'react'
import { createContract, type ActionState } from '@/lib/actions/contracts'
import { createClient } from '@/lib/supabase/client'

type Stage = { id: string; name: string }

const initialState: ActionState = {}

export default function NewContractPage() {
  const [state, formAction, pending] = useActionState(createContract, initialState)
  const [stages, setStages] = useState<Stage[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('stages')
      .select('id, name')
      .order('order_index')
      .then(({ data }) => setStages(data ?? []))
  }, [])

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-lg font-semibold text-gray-900">Novo Contrato</h1>

      <form action={formAction} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Número do Processo <span className="text-red-500">*</span>
          </label>
          <input
            name="process_number"
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
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
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Cliente</label>
          <input
            name="client_name"
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
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
              defaultValue={0}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Etapa</label>
            <select
              name="stage_id"
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            >
              <option value="">Selecione...</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Data prevista de fechamento</label>
          <input
            name="expected_close_date"
            type="date"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Descrição</label>
          <textarea
            name="description"
            rows={3}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {pending ? 'Salvando...' : 'Salvar Contrato'}
        </button>
      </form>
    </div>
  )
}
