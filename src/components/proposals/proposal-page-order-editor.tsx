'use client'

import { useState } from 'react'
import { setProposalPageOrder } from '@/lib/actions/proposals'

type Template = { id: string; name: string }
type PageEntry = { key: string; templateId: string | null; isStandardProposal: boolean }

export function ProposalPageOrderEditor({
  proposalId,
  contractId,
  templates,
  initialPages,
}: {
  proposalId: string
  contractId: string
  templates: Template[]
  initialPages: { template_id: string | null; is_standard_proposal: boolean }[]
}) {
  const [pages, setPages] = useState<PageEntry[]>(
    initialPages.length > 0
      ? initialPages.map((p) => ({ key: crypto.randomUUID(), templateId: p.template_id, isStandardProposal: p.is_standard_proposal }))
      : [{ key: crypto.randomUUID(), templateId: null, isStandardProposal: true }]
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addPage() {
    setPages((prev) => [...prev, { key: crypto.randomUUID(), templateId: templates[0]?.id ?? null, isStandardProposal: false }])
  }

  function removePage(key: string) {
    setPages((prev) => prev.filter((p) => p.key !== key))
  }

  function move(key: string, dir: 'up' | 'down') {
    setPages((prev) => {
      const idx = prev.findIndex((p) => p.key === key)
      const swapWith = dir === 'up' ? idx - 1 : idx + 1
      if (swapWith < 0 || swapWith >= prev.length) return prev
      const copy = [...prev]
      ;[copy[idx], copy[swapWith]] = [copy[swapWith], copy[idx]]
      return copy
    })
  }

  function setPageType(key: string, value: string) {
    setPages((prev) =>
      prev.map((p) =>
        p.key === key
          ? value === 'standard'
            ? { ...p, isStandardProposal: true, templateId: null }
            : { ...p, isStandardProposal: false, templateId: value }
          : p
      )
    )
  }

  async function handleSave() {
    if (!pages.some((p) => p.isStandardProposal)) {
      setError('A montagem precisa incluir a "Proposta padrão" em algum ponto.')
      return
    }
    setError(null)
    setBusy(true)
    const result = await setProposalPageOrder(
      proposalId,
      contractId,
      pages.map((p, i) => ({ position: i, templateId: p.templateId, isStandardProposal: p.isStandardProposal }))
    )
    setBusy(false)
    if (result.error) setError(result.error)
  }

  return (
    <div className="space-y-2">
      {pages.map((p, i) => (
        <div key={p.key} className="flex items-center gap-2 rounded-md border border-gray-200 bg-white p-2">
          <span className="w-5 text-xs text-gray-400">{i + 1}.</span>
          <select
            value={p.isStandardProposal ? 'standard' : p.templateId ?? ''}
            onChange={(e) => setPageType(p.key, e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-700 focus:outline-none"
          >
            <option value="standard">📄 Proposta padrão (dados/itens)</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button onClick={() => move(p.key, 'up')} disabled={i === 0} className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-20">▲</button>
          <button onClick={() => move(p.key, 'down')} disabled={i === pages.length - 1} className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-20">▼</button>
          <button onClick={() => removePage(p.key)} className="text-xs text-negative-600 hover:underline">Remover</button>
        </div>
      ))}
      <button onClick={addPage} className="text-xs text-brand-700 hover:underline">+ Adicionar página</button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div>
        <button onClick={handleSave} disabled={busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
          {busy ? 'Salvando...' : 'Salvar montagem'}
        </button>
      </div>
    </div>
  )
}
