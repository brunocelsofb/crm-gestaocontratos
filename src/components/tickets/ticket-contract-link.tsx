'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { linkTicketToContract } from '@/lib/actions/tickets'
import { ContractSearchSelect } from '@/components/tickets/contract-search-select'

type ContractOption = { id: string; client_name: string; process_number: string }

export function TicketContractLink({
  ticketId,
  linkedContractId,
  linkedContractName,
  requesterCnpj,
}: {
  ticketId: string
  linkedContractId: string | null
  linkedContractName: string | null
  requesterCnpj?: string | null
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(!linkedContractId)
  const [picked, setPicked] = useState<ContractOption | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    if (!picked) {
      setError('Busque e escolha o contrato do cliente.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await linkTicketToContract(ticketId, picked.id)
      if (result.error) setError(result.error)
      else {
        setEditing(false)
        router.refresh()
      }
    })
  }

  if (!editing && linkedContractId) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
        <span>
          Contrato vinculado: <Link href={`/contracts/${linkedContractId}`} className="font-medium text-brand-700 hover:underline">{linkedContractName}</Link>
        </span>
        <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-600">Trocar</button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3">
      <p className="text-xs font-medium text-yellow-900">
        {linkedContractId ? 'Trocar o contrato vinculado' : '⚠️ Este ticket ainda não está vinculado a nenhum contrato — todo ticket precisa estar ligado a um cliente.'}
      </p>
      {!linkedContractId && requesterCnpj && (
        <p className="mt-1 text-xs text-yellow-700">CNPJ informado pelo solicitante: <strong>{requesterCnpj}</strong> — não achamos automaticamente (0 ou mais de 1 contrato pra esse CNPJ). Busque abaixo.</p>
      )}
      <div className="mt-2">
        <ContractSearchSelect name="_unused" onSelect={setPicked} />
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={handleSave} disabled={isPending} className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50">
          {isPending ? 'Salvando...' : 'Vincular'}
        </button>
        {linkedContractId && (
          <button onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
