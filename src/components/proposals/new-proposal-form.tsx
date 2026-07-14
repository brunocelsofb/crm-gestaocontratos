'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProposal, type ProposalItemInput } from '@/lib/actions/proposals'

function emptyItem(): ProposalItemInput {
  return { quantity: 1, category: '', item: '', characteristics: '', type: '', delivery_forecast: '', unit_value: 0, discount: 0 }
}

export function NewProposalForm({ contractId, onCancel }: { contractId: string; onCancel: () => void }) {
  const router = useRouter()
  const [currency, setCurrency] = useState('BRL')
  const [poNumber, setPoNumber] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [items, setItems] = useState<ProposalItemInput[]>([emptyItem()])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateItem(i: number, patch: Partial<ProposalItemInput>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }

  async function handleSubmit() {
    setError(null)
    if (items.some((it) => !it.item.trim())) {
      setError('Preencha o nome de todos os itens.')
      return
    }
    setBusy(true)
    const result = await createProposal(contractId, currency, poNumber || null, validUntil || null, items)
    setBusy(false)
    if (result.error) {
      setError(result.error)
    } else if (result.proposalId) {
      router.push(`/contracts/${contractId}/proposals/${result.proposalId}`)
    }
  }

  const total = items.reduce((sum, it) => sum + it.quantity * it.unit_value - it.discount, 0)

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[10px] text-gray-500">Moeda</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="mt-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
            <option value="BRL">BRL — Real</option>
            <option value="USD">USD — Dólar</option>
            <option value="EUR">EUR — Euro</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500">Nº OC do cliente (opcional)</label>
          <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="mt-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500">Válida até</label>
          <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="mt-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-700">Itens</p>
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-8 gap-1.5 rounded-md bg-gray-50 p-2">
            <input placeholder="Qtd" type="number" value={it.quantity} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} className="col-span-1 rounded border border-gray-300 px-1.5 py-1 text-xs" />
            <input placeholder="Categoria" value={it.category} onChange={(e) => updateItem(i, { category: e.target.value })} className="col-span-1 rounded border border-gray-300 px-1.5 py-1 text-xs" />
            <input placeholder="Item" value={it.item} onChange={(e) => updateItem(i, { item: e.target.value })} className="col-span-2 rounded border border-gray-300 px-1.5 py-1 text-xs" />
            <input placeholder="Tipo" value={it.type} onChange={(e) => updateItem(i, { type: e.target.value })} className="col-span-1 rounded border border-gray-300 px-1.5 py-1 text-xs" />
            <input placeholder="Vlr unit." type="number" value={it.unit_value} onChange={(e) => updateItem(i, { unit_value: Number(e.target.value) })} className="col-span-1 rounded border border-gray-300 px-1.5 py-1 text-xs" />
            <input placeholder="Desconto" type="number" value={it.discount} onChange={(e) => updateItem(i, { discount: Number(e.target.value) })} className="col-span-1 rounded border border-gray-300 px-1.5 py-1 text-xs" />
            <button onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} className="col-span-1 text-xs text-negative-600 hover:underline">
              Remover
            </button>
            <input placeholder="Características / escopo" value={it.characteristics} onChange={(e) => updateItem(i, { characteristics: e.target.value })} className="col-span-5 rounded border border-gray-300 px-1.5 py-1 text-xs" />
            <input placeholder="Previsão de entrega" value={it.delivery_forecast} onChange={(e) => updateItem(i, { delivery_forecast: e.target.value })} className="col-span-3 rounded border border-gray-300 px-1.5 py-1 text-xs" />
          </div>
        ))}
        <button onClick={() => setItems((prev) => [...prev, emptyItem()])} className="text-xs text-brand-700 hover:underline">
          + Adicionar item
        </button>
      </div>

      <p className="text-sm font-medium text-gray-700">Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(total)}</p>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
          {busy ? 'Criando...' : 'Criar proposta (rascunho)'}
        </button>
        <button onClick={onCancel} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </div>
  )
}
