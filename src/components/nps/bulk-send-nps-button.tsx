'use client'

import { useActionState } from 'react'
import { sendNpsToAllActiveContracts, type BulkSendState } from '@/lib/actions/nps'

const initialState: BulkSendState = {}

export function BulkSendNpsButton() {
  const [state, formAction, pending] = useActionState(sendNpsToAllActiveContracts, initialState)

  return (
    <form action={formAction} className="flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!confirm('Enviar pesquisa NPS para todos os contratos ativos que ainda não têm uma pesquisa pendente?')) {
            e.preventDefault()
          }
        }}
        className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {pending ? 'Enviando...' : '+ Enviar NPS para todos os contratos ativos'}
      </button>
      {state.sent !== undefined && (
        <span className="text-xs text-gray-500">
          Enviado para {state.sent} contrato{state.sent === 1 ? '' : 's'}
          {state.skipped ? ` · ${state.skipped} já tinha${state.skipped === 1 ? '' : 'm'} pesquisa pendente (pulado${state.skipped === 1 ? '' : 's'})` : ''}
        </span>
      )}
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  )
}
