'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createTicket } from '@/lib/actions/tickets'
import { ContractSearchSelect } from '@/components/tickets/contract-search-select'

export default function NewTicketPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefilledContractId = searchParams.get('contract_id')
  const prefilledClientName = searchParams.get('client_name')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setBusy(true)
    setError(null)
    formData.set('source', 'manual')
    const result = await createTicket(formData)
    setBusy(false)
    if (result.error) {
      setError(result.error)
    } else if (result.ticketId) {
      router.push(`/tickets/${result.ticketId}`)
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <Link href="/tickets" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700">
        ← Voltar
      </Link>
      <h1 className="text-[17px] font-medium text-foreground">Novo Ticket</h1>
      <form action={handleSubmit} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <ContractSearchSelect
          name="contract_id"
          required
          initialValue={prefilledContractId && prefilledClientName ? { id: prefilledContractId, client_name: prefilledClientName, process_number: '' } : undefined}
        />
        <div>
          <label className="block text-xs font-medium text-gray-600">Nome do solicitante</label>
          <input name="requester_name" required className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">E-mail</label>
          <input name="requester_email" type="email" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Assunto</label>
          <input name="subject" required className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Descrição</label>
          <textarea name="description" rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Prioridade</label>
          <select name="priority" defaultValue="media" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
            <option value="baixa">Baixa (5 dias)</option>
            <option value="media">Média (48h)</option>
            <option value="alta">Alta (24h)</option>
            <option value="urgente">Urgente (4h)</option>
          </select>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
          {busy ? 'Criando...' : 'Criar ticket'}
        </button>
      </form>
    </div>
  )
}
