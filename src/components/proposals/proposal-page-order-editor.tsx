'use client'

import { useState } from 'react'
import { setProposalPageOrder } from '@/lib/actions/proposals'

type Template = { id: string; name: string; sort_order?: number; is_miolo_after?: boolean; service_type?: string }
type PageEntry = { key: string; templateId: string | null; isStandardProposal: boolean; name: string }

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
      ? initialPages.map((p) => {
          const tmpl = templates.find(t => t.id === p.template_id)
          return { key: crypto.randomUUID(), templateId: p.template_id, isStandardProposal: p.is_standard_proposal, name: tmpl?.name ?? 'PDF' }
        })
      : [{ key: crypto.randomUUID(), templateId: null, isStandardProposal: true, name: 'Proposta padrão' }]
  )
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function applyServiceTemplate(service: string) {
    if (!service) return
    setLoading(true)
    try {
      // Busca templates reais do banco para este service_type, em sort_order
      const res = await fetch(`/api/proposals/templates-by-type?service_type=${service}`)
      const { templates: serviceTemplates, miolo_after_id } = await res.json()

      if (!serviceTemplates || serviceTemplates.length === 0) {
        // Sem templates configurados — só a proposta padrão
        setPages([{ key: crypto.randomUUID(), templateId: null, isStandardProposal: true, name: 'Proposta padrão' }])
        setLoading(false)
        return
      }

      // Reconstrói a lista respeitando a posição do miolo configurada no admin
      const newPages: PageEntry[] = []
      let mioloInserted = false

      if (miolo_after_id === 'start') {
        newPages.push({ key: crypto.randomUUID(), templateId: null, isStandardProposal: true, name: 'Proposta padrão' })
        mioloInserted = true
      }

      for (const t of serviceTemplates) {
        newPages.push({ key: crypto.randomUUID(), templateId: t.id, isStandardProposal: false, name: t.name })
        if (t.is_miolo_after && !mioloInserted) {
          newPages.push({ key: crypto.randomUUID(), templateId: null, isStandardProposal: true, name: 'Proposta padrão' })
          mioloInserted = true
        }
      }

      if (!mioloInserted) {
        // Miolo no final (padrão se não configurado)
        newPages.push({ key: crypto.randomUUID(), templateId: null, isStandardProposal: true, name: 'Proposta padrão' })
      }

      setPages(newPages)

      // Salva service_type na proposta
      await fetch('/api/proposals/service-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: proposalId, service_type: service }),
      })
    } catch (e) {
      setError('Erro ao carregar template. Tente novamente.')
    }
    setLoading(false)
  }

  function addPage() {
    const t = templates[0]
    setPages((prev) => [...prev, { key: crypto.randomUUID(), templateId: t?.id ?? null, isStandardProposal: false, name: t?.name ?? 'PDF' }])
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
      prev.map((p) => {
        if (p.key !== key) return p
        if (value === 'standard') return { ...p, isStandardProposal: true, templateId: null, name: 'Proposta padrão' }
        const tmpl = templates.find(t => t.id === value)
        return { ...p, isStandardProposal: false, templateId: value, name: tmpl?.name ?? 'PDF' }
      })
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
    <div className="space-y-3">
      {/* Template de serviço */}
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-brand-300 bg-brand-50 px-4 py-3">
        <div className="flex-1">
          <p className="text-xs font-semibold text-brand-700 mb-1">Template de Serviço</p>
          <p className="text-xs text-brand-500">Selecione para carregar a ordem configurada no painel de Modelos.</p>
        </div>
        <select
          onChange={e => applyServiceTemplate(e.target.value)}
          defaultValue=""
          disabled={loading}
          className="rounded-md border border-brand-300 px-2 py-1.5 text-xs font-medium text-brand-700 bg-white focus:outline-none disabled:opacity-50">
          <option value="">{loading ? 'Carregando...' : 'Selecionar template...'}</option>
          <option value="clinica">Engenharia Clínica</option>
          <option value="hospitalar">Engenharia Hospitalar</option>
          <option value="avulso">Avulso</option>
        </select>
      </div>
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
    </div>
  )
}
