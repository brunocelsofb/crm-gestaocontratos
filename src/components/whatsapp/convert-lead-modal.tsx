'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Pipeline = { id: string; name: string; pipeline_stages: { id: string; name: string }[] }

export function ConvertLeadModal({
  phone, leadId, displayName, onClose,
}: {
  phone: string; leadId: string | null; displayName?: string | null; onClose: () => void
}) {
  const router = useRouter()
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [pipelineId, setPipelineId] = useState('')
  const [stageId, setStageId] = useState('')
  const [title, setTitle] = useState(displayName ?? phone)
  const [value, setValue] = useState('')
  const [companyQuery, setCompanyQuery] = useState('')
  const [companyResults, setCompanyResults] = useState<{ id: string; label: string }[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyLabel, setCompanyLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Carrega todos os pipelines com suas etapas de uma vez
  useEffect(() => {
    fetch('/api/pipelines-list?withStages=true', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const ps: Pipeline[] = d.pipelines ?? []
        setPipelines(ps)
        if (ps[0]) {
          setPipelineId(ps[0].id)
          if (ps[0].pipeline_stages?.[0]) setStageId(ps[0].pipeline_stages[0].id)
        }
      })
  }, [])

  // Stages derivados do pipeline selecionado
  const currentStages = pipelines.find(p => p.id === pipelineId)?.pipeline_stages ?? []

  function handlePipelineChange(id: string) {
    setPipelineId(id)
    const stages = pipelines.find(p => p.id === id)?.pipeline_stages ?? []
    setStageId(stages[0]?.id ?? '')
  }

  // Busca empresa com debounce
  useEffect(() => {
    if (companyQuery.length < 2) { setCompanyResults([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetch(`/api/whatsapp/link-account?q=${encodeURIComponent(companyQuery)}&type=company`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => setCompanyResults(d.results ?? []))
    }, 300)
  }, [companyQuery])

  async function handleSave() {
    if (!pipelineId || !stageId) { setError('Selecione o funil e a etapa.'); return }
    if (!title.trim()) { setError('Informe o título da oportunidade.'); return }
    setSaving(true); setError(null)

    const res = await fetch('/api/whatsapp/convert-lead', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone, leadId, pipelineId, stageId,
        title: title.trim(),
        value: parseFloat(value) || 0,
        companyId,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.error) { setError(data.error); return }
    onClose()
    if (data.contractId) router.push(`/contracts/${data.contractId}`)
    else router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="border-b px-6 py-4 sticky top-0 bg-white">
          <h2 className="text-base font-bold text-[#1B556B]">✅ Criar Oportunidade</h2>
          <p className="text-xs text-gray-400 mt-0.5">{phone}</p>
        </div>
        <div className="p-6 space-y-4">
          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Título / Nome do contato *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none" />
          </div>

          {/* Funil */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Funil *</label>
            <select value={pipelineId} onChange={e => handlePipelineChange(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none">
              <option value="">Selecione o funil...</option>
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Etapa — atualiza em cascata */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Etapa inicial *</label>
            <select value={stageId} onChange={e => setStageId(e.target.value)}
              disabled={!currentStages.length}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none disabled:bg-gray-50">
              {currentStages.length === 0
                ? <option value="">Selecione um funil primeiro</option>
                : currentStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
              }
            </select>
          </div>

          {/* Empresa — autocomplete */}
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Empresa (opcional)</label>
            {companyId ? (
              <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2">
                <span className="text-sm text-green-800 flex-1">{companyLabel}</span>
                <button onClick={() => { setCompanyId(null); setCompanyLabel(''); setCompanyQuery('') }}
                  className="text-green-600 hover:text-green-800 text-xs">✕</button>
              </div>
            ) : (
              <>
                <input value={companyQuery} onChange={e => setCompanyQuery(e.target.value)}
                  placeholder="Buscar empresa pelo nome..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none" />
                {companyQuery.length >= 2 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-md max-h-40 overflow-y-auto">
                    {companyResults.length > 0
                      ? companyResults.map(r => (
                        <button key={r.id} onClick={() => { setCompanyId(r.id); setCompanyLabel(r.label); setCompanyQuery(''); setCompanyResults([]) }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
                          {r.label}
                        </button>
                      ))
                      : <p className="px-3 py-2 text-xs text-gray-400">Nenhuma empresa encontrada</p>
                    }
                  </div>
                )}
              </>
            )}
          </div>

          {/* Valor */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Valor estimado (R$)</label>
            <input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="0,00"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none" />
          </div>

          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={handleSave} disabled={saving || !pipelineId || !stageId}
              className="flex-1 rounded-lg bg-[#1B556B] py-2.5 text-sm font-semibold text-white hover:bg-[#164659] disabled:opacity-50">
              {saving ? 'Criando...' : '✅ Criar Oportunidade'}
            </button>
            <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
