'use client'

import { useState } from 'react'
import { updateNumberingPrefixes, setNextTicketNumber, setNextProposalNumber } from '@/lib/actions/settings'

export function NumberingSettingsForm({
  currentTicketPrefix,
  currentProposalPrefix,
}: {
  currentTicketPrefix: string
  currentProposalPrefix: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [nextTicket, setNextTicket] = useState('')
  const [nextProposal, setNextProposal] = useState('')

  async function handleSavePrefixes(formData: FormData) {
    setBusy(true)
    setError(null)
    setSaved(false)
    const result = await updateNumberingPrefixes(formData)
    setBusy(false)
    if (result.error) setError(result.error)
    else setSaved(true)
  }

  async function handleSetNextTicket() {
    if (!nextTicket) return
    if (!confirm(`Confirma que o PRÓXIMO ticket criado vai começar em ${nextTicket}? Isso não pode ser desfeito.`)) return
    setBusy(true)
    setError(null)
    const result = await setNextTicketNumber(Number(nextTicket))
    setBusy(false)
    if (result.error) setError(result.error)
    else setNextTicket('')
  }

  async function handleSetNextProposal() {
    if (!nextProposal) return
    if (!confirm(`Confirma que a PRÓXIMA proposta criada vai começar em ${nextProposal}? Isso não pode ser desfeito.`)) return
    setBusy(true)
    setError(null)
    const result = await setNextProposalNumber(Number(nextProposal))
    setBusy(false)
    if (result.error) setError(result.error)
    else setNextProposal('')
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
      <div>
        <h3 className="text-sm font-medium text-gray-900">Numeração de ticket (protocolo) e proposta</h3>
        <p className="mt-0.5 text-xs text-gray-400">
          O número segue o formato PREFIXO-ANO-0000 (ex: TICKET-2026-0001) — o ano é adicionado automaticamente, <strong>não inclua o ano no prefixo abaixo</strong>. Reinicia em 0001 a cada ano novo, sem risco de repetir mesmo com dois criados ao mesmo tempo.
        </p>
      </div>

      <form action={handleSavePrefixes} className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600">Prefixo do ticket/protocolo</label>
          <input name="ticket_number_prefix" defaultValue={currentTicketPrefix} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Prefixo da proposta</label>
          <input name="proposal_number_prefix" defaultValue={currentProposalPrefix} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        <div className="col-span-2">
          <button type="submit" disabled={busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50">
            {busy ? 'Salvando...' : 'Salvar prefixos'}
          </button>
          {saved && <span className="ml-2 text-xs text-positive-700">Salvo!</span>}
        </div>
      </form>

      <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
        <div>
          <label className="block text-xs font-medium text-gray-600">Definir o próximo número de ticket (ano atual)</label>
          <div className="mt-1 flex gap-1.5">
            <input type="number" min="1" value={nextTicket} onChange={(e) => setNextTicket(e.target.value)} placeholder="Ex: 1000" className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
            <button onClick={handleSetNextTicket} disabled={busy} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Definir
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Definir o próximo número de proposta (ano atual)</label>
          <div className="mt-1 flex gap-1.5">
            <input type="number" min="1" value={nextProposal} onChange={(e) => setNextProposal(e.target.value)} placeholder="Ex: 1000" className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
            <button onClick={handleSetNextProposal} disabled={busy} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Definir
            </button>
          </div>
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
