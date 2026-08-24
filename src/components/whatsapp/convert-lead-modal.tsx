'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Pipeline = { id: string; name: string }
type Stage = { id: string; name: string; pipeline_id: string }

export function ConvertLeadModal({
  phone, leadId, displayName, onClose,
}: {
  phone: string; leadId: string | null; displayName?: string | null; onClose: () => void
}) {
  const router = useRouter()

  // Dados do contato (pré-preenchidos do WhatsApp)
  const [contactName, setContactName] = useState(displayName ?? '')
  const [contactPhone] = useState(phone) // readonly
  const [contactEmail, setContactEmail] = useState('')
  const [contactRole, setContactRole] = useState('')

  // Empresa
  const [companyQuery, setCompanyQuery] = useState('')
  const [companyResults, setCompanyResults] = useState<{ id: string; label: string }[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyLabel, setCompanyLabel] = useState('')
  const [companyCnpj, setCompanyCnpj] = useState('')
  const [companyNew, setCompanyNew] = useState(false) // criar nova empresa

  // Pipeline
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [allStages, setAllStages] = useState<Stage[]>([])
  const [pipelineId, setPipelineId] = useState('')
  const [stageId, setStageId] = useState('')
  const [value, setValue] = useState('')

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetch('/api/pipelines-list?withStages=true', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const ps: Pipeline[] = d.pipelines ?? []
        const ss: Stage[] = d.stages ?? []
        setPipelines(ps); setAllStages(ss)
        if (ps[0]) {
          setPipelineId(ps[0].id)
          const first = ss.find(s => s.pipeline_id === ps[0].id)
          if (first) setStageId(first.id)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const currentStages = allStages.filter(s => s.pipeline_id === pipelineId)

  function handlePipelineChange(id: string) {
    setPipelineId(id)
    const first = allStages.find(s => s.pipeline_id === id)
    setStageId(first?.id ?? '')
  }

  // Busca empresa
  useEffect(() => {
    if (companyQuery.length < 2) { setCompanyResults([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const r = await fetch(`/api/whatsapp/link-account?q=${encodeURIComponent(companyQuery)}&type=company`, { credentials: 'include' })
      const d = await r.json()
      setCompanyResults(d.results ?? [])
    }, 300)
  }, [companyQuery])

  async function handleSave() {
    if (!contactName.trim()) { setError('Informe o nome do contato.'); return }
    if (!pipelineId || !stageId) { setError('Selecione o funil e a etapa.'); return }
    setSaving(true); setError(null)

    const res = await fetch('/api/whatsapp/convert-lead', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone, leadId,
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim() || null,
        contactRole: contactRole.trim() || null,
        companyId: companyNew ? null : companyId,
        companyCnpj: companyNew ? companyCnpj.trim() || null : null,
        companyName: companyNew ? companyLabel.trim() || null : null,
        pipelineId, stageId,
        value: parseFloat(value) || 0,
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
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[92vh] flex flex-col">
        <div className="border-b px-6 py-4 flex-shrink-0">
          <h2 className="text-base font-bold text-[#1B556B]">✅ Converter em Oportunidade</h2>
          <p className="text-xs text-gray-400 mt-0.5">{phone}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Dados do contato */}
          <div>
            <p className="text-xs font-bold text-[#1B556B] uppercase tracking-wide mb-3">👤 Dados do Contato</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome *</label>
                <input value={contactName} onChange={e => setContactName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Telefone</label>
                <input value={contactPhone} readOnly
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Cargo</label>
                <input value={contactRole} onChange={e => setContactRole(e.target.value)}
                  placeholder="Ex: Diretor, Gerente..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">E-mail</label>
                <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                  placeholder="contato@empresa.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Empresa */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-[#1B556B] uppercase tracking-wide">🏢 Empresa</p>
              <button onClick={() => { setCompanyNew(!companyNew); setCompanyId(null); setCompanyLabel(''); setCompanyQuery('') }}
                className="text-xs text-[#1B556B] hover:underline">
                {companyNew ? '← Buscar existente' : '+ Criar nova'}
              </button>
            </div>

            {companyNew ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nome da empresa</label>
                  <input value={companyLabel} onChange={e => setCompanyLabel(e.target.value)}
                    placeholder="Razão social ou nome fantasia"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">CNPJ</label>
                  <input value={companyCnpj} onChange={e => setCompanyCnpj(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none" />
                </div>
              </div>
            ) : companyId ? (
              <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2">
                <span className="text-sm text-green-800 flex-1">✓ {companyLabel}</span>
                <button onClick={() => { setCompanyId(null); setCompanyLabel('') }} className="text-green-600 text-xs">✕</button>
              </div>
            ) : (
              <div className="relative">
                <input value={companyQuery} onChange={e => setCompanyQuery(e.target.value)}
                  placeholder="Buscar pelo nome da empresa..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none" />
                {companyQuery.length >= 2 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-md max-h-36 overflow-y-auto">
                    {companyResults.length > 0
                      ? companyResults.map(r => (
                        <button key={r.id} onClick={() => { setCompanyId(r.id); setCompanyLabel(r.label); setCompanyQuery(''); setCompanyResults([]) }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
                          {r.label}
                        </button>
                      ))
                      : <p className="px-3 py-2 text-xs text-gray-400">Nenhuma empresa encontrada — use "+ Criar nova" acima</p>
                    }
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pipeline */}
          <div>
            <p className="text-xs font-bold text-[#1B556B] uppercase tracking-wide mb-3">🎯 Oportunidade</p>
            {loading ? (
              <div className="h-20 rounded-lg bg-gray-100 animate-pulse" />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Funil *</label>
                  <select value={pipelineId} onChange={e => handlePipelineChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none">
                    {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Etapa *</label>
                  <select value={stageId} onChange={e => setStageId(e.target.value)}
                    disabled={!currentStages.length}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none disabled:bg-gray-50">
                    {currentStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Valor estimado (R$)</label>
                  <input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="0,00"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none" />
                </div>
              </div>
            )}
          </div>

          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex gap-3 p-6 border-t flex-shrink-0">
          <button onClick={handleSave} disabled={saving || loading}
            className="flex-1 rounded-lg bg-[#1B556B] py-2.5 text-sm font-semibold text-white hover:bg-[#164659] disabled:opacity-50">
            {saving ? 'Criando...' : '✅ Criar Oportunidade'}
          </button>
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600">Cancelar</button>
        </div>
      </div>
    </div>
  )
}
