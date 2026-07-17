'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addContractContact, removeContractContact, setPrimaryContractContact, type ContractContact } from '@/lib/actions/contract-contacts'

type CompanyContact = { id: string; name: string; role: string | null }

export function ContractContactsSection({
  contractId,
  contacts,
  companyContacts,
}: {
  contractId: string
  contacts: ContractContact[]
  companyContacts: CompanyContact[]
}) {
  const router = useRouter()
  const [selectedToAdd, setSelectedToAdd] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const linkedIds = new Set(contacts.map((c) => c.contact_id))
  const availableToAdd = companyContacts.filter((c) => !linkedIds.has(c.id))

  async function handleAdd() {
    if (!selectedToAdd) return
    setBusy(true)
    setError(null)
    const result = await addContractContact(contractId, selectedToAdd)
    setBusy(false)
    if (result.error) setError(result.error)
    else {
      setSelectedToAdd('')
      router.refresh()
    }
  }

  async function handleSetPrimary(contactId: string) {
    setBusy(true)
    await setPrimaryContractContact(contractId, contactId)
    setBusy(false)
    router.refresh()
  }

  async function handleRemove(contactId: string) {
    if (!confirm('Remover esse contato deste contrato?')) return
    setBusy(true)
    await removeContractContact(contractId, contactId)
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-medium text-gray-900">Contatos desta oportunidade</p>
      <p className="text-xs text-gray-400">O principal é usado por padrão em e-mail, WhatsApp e propostas — mas todos os contatos aqui contam pro vínculo de mensagens recebidas.</p>

      <div className="space-y-1.5">
        {contacts.map((c) => (
          <div key={c.contact_id} className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
            <div>
              <span className="font-medium text-gray-800">{c.name}</span>
              {c.role && <span className="ml-1.5 text-xs text-gray-400">({c.role})</span>}
              {c.is_primary && <span className="ml-2 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">Principal</span>}
              <p className="text-xs text-gray-400">{[c.email, c.phone].filter(Boolean).join(' · ') || 'Sem e-mail/telefone'}</p>
            </div>
            <div className="flex items-center gap-2">
              {!c.is_primary && (
                <button onClick={() => handleSetPrimary(c.contact_id)} disabled={busy} className="text-xs text-brand-700 hover:underline disabled:opacity-50">
                  Tornar principal
                </button>
              )}
              <button onClick={() => handleRemove(c.contact_id)} disabled={busy} className="text-xs text-negative-600 hover:underline disabled:opacity-50">
                Remover
              </button>
            </div>
          </div>
        ))}
        {contacts.length === 0 && <p className="text-sm text-gray-400">Nenhum contato vinculado ainda.</p>}
      </div>

      {availableToAdd.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <select value={selectedToAdd} onChange={(e) => setSelectedToAdd(e.target.value)} className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
            <option value="">+ Adicionar contato da empresa...</option>
            {availableToAdd.map((c) => <option key={c.id} value={c.id}>{c.name}{c.role ? ` (${c.role})` : ''}</option>)}
          </select>
          <button onClick={handleAdd} disabled={!selectedToAdd || busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
            Adicionar
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
