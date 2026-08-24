'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function ConvertLeadModal({
  phone, leadId, onClose,
}: {
  phone: string; leadId: string | null; onClose: () => void
}) {
  const router = useRouter()
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([])
  const [stages, setStages] = useState<{ id: string; name: string }[]>([])
  const [pipelineId, setPipelineId] = useState('')
  const [stageId, setStageId] = useState('')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Carrega pipelines
  useEffect(() => {
    fetch('/api/pipelines-list', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setPipelines(d.pipelines ?? [])
        if (d.pipelines?.[0]) setPipelineId(d.pipelines[0].id)
      })
  }, [])

  // Carrega stages quando pipeline muda
  useEffect(() => {
    if (!pipelineId) { setStages([]); return }
    fetch(`/api/pipelines-list?pipelineId=${pipelineId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setStages(d.stages ?? [])
        if (d.stages?.[0]) setStageId(d.stages[0].id)
      })
  }, [pipelineId])

  async function handleSave() {
    if (!pipelineId || !stageId) { setError('Selecione o funil e a etapa.'); return }
    setSaving(true); setError(null)
    const res = await fetch('/api/whatsapp/convert-lead', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, leadId, pipelineId, stageId, value: parseFloat(value) || 0 }),
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
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="border-b px-6 py-4">
          <h2 className="text-base font-bold text-[#1B556B]">✅ Criar Oportunidade</h2>
          <p className="text-xs text-gray-400 mt-0.5">{phone}</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Funil (Pipeline)</label>
            <select value={pipelineId} onChange={e => setPipelineId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none">
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Etapa inicial</label>
            <select value={stageId} onChange={e => setStageId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none">
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Valor estimado (R$)</label>
            <input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="0"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none" />
          </div>
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 rounded-lg bg-[#1B556B] py-2.5 text-sm font-semibold text-white hover:bg-[#164659] disabled:opacity-50">
              {saving ? 'Criando...' : '✅ Criar Oportunidade'}
            </button>
            <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
