'use client'

import { useState } from 'react'

type Tab = { id: string; label: string }
type Pipeline = { id: string; name: string; defaultHidden?: string[] }
type PipelineConfig = { order: string[]; hidden: string[] }

export function TabOrderEditorByPipeline({
  allTabs, pipelines, savedConfig, getDefaultHidden,
}: {
  allTabs: Tab[]; pipelines: Pipeline[]; savedConfig: Record<string, PipelineConfig>
}) {
  const [selectedPipeline, setSelectedPipeline] = useState(pipelines[0]?.id ?? '')
  const [configs, setConfigs] = useState<Record<string, PipelineConfig>>(savedConfig)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const getConfig = (pid: string): PipelineConfig => {
    if (configs[pid]) return configs[pid]
    // Default inteligente: aplica hidden baseado no nome do pipeline
    const pipeline = pipelines.find(p => p.id === pid)
    return { order: allTabs.map(t => t.id), hidden: pipeline?.defaultHidden ?? [] }
  }

  const getSortedTabs = (pid: string) => {
    const { order } = getConfig(pid)
    const sorted = order.map(id => allTabs.find(t => t.id === id)).filter(Boolean) as Tab[]
    allTabs.forEach(t => { if (!sorted.find(s => s.id === t.id)) sorted.push(t) })
    return sorted
  }

  function move(pid: string, i: number, dir: -1 | 1) {
    const tabs = getSortedTabs(pid)
    const j = i + dir
    if (j < 0 || j >= tabs.length) return
    const newOrder = tabs.map(t => t.id)
    ;[newOrder[i], newOrder[j]] = [newOrder[j], newOrder[i]]
    setConfigs(prev => ({ ...prev, [pid]: { ...getConfig(pid), order: newOrder } }))
    setSaved(false)
  }

  function toggleHidden(pid: string, tabId: string) {
    const cfg = getConfig(pid)
    const hidden = cfg.hidden.includes(tabId)
      ? cfg.hidden.filter(h => h !== tabId)
      : [...cfg.hidden, tabId]
    setConfigs(prev => ({ ...prev, [pid]: { ...cfg, hidden } }))
    setSaved(false)
  }

  async function handleSave() {
    if (!selectedPipeline) return
    setSaving(true)
    const cfg = getConfig(selectedPipeline)
    await fetch('/api/settings/tab-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipelineId: selectedPipeline, order: cfg.order, hidden: cfg.hidden }),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const tabs = getSortedTabs(selectedPipeline)
  const cfg = getConfig(selectedPipeline)

  return (
    <div className="space-y-5">
      {/* Seletor de funil */}
      <div className="flex gap-2 flex-wrap">
        {pipelines.map(p => (
          <button key={p.id} onClick={() => { setSelectedPipeline(p.id); setSaved(false) }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              selectedPipeline === p.id
                ? 'bg-[#1B556B] text-white'
                : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}>
            {p.name}
          </button>
        ))}
      </div>

      {/* Lista de abas */}
      {selectedPipeline && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <p className="text-xs text-gray-400">
            Arraste com ↑↓ para reordenar. Use o 👁️ para ocultar uma aba neste funil.
          </p>
          {tabs.map((tab, i) => {
            const isHidden = cfg.hidden.includes(tab.id)
            return (
              <div key={tab.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all ${
                isHidden ? 'border-dashed border-gray-200 bg-gray-50 opacity-50' : 'border-gray-200 bg-gray-50'
              }`}>
                <span className="text-xs font-mono text-gray-400 w-4">{i + 1}</span>
                <span className={`flex-1 text-sm font-medium ${isHidden ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                  {tab.label}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleHidden(selectedPipeline, tab.id)}
                    title={isHidden ? 'Mostrar aba' : 'Ocultar aba'}
                    className={`rounded p-1.5 text-sm transition-colors ${isHidden ? 'text-gray-300 hover:text-gray-500' : 'text-gray-500 hover:text-[#1B556B]'}`}>
                    {isHidden ? '🙈' : '👁️'}
                  </button>
                  <button onClick={() => move(selectedPipeline, i, -1)} disabled={i === 0 || isHidden}
                    className="rounded p-1 text-gray-400 hover:bg-gray-200 disabled:opacity-20">↑</button>
                  <button onClick={() => move(selectedPipeline, i, 1)} disabled={i === tabs.length - 1 || isHidden}
                    className="rounded p-1 text-gray-400 hover:bg-gray-200 disabled:opacity-20">↓</button>
                </div>
              </div>
            )
          })}

          <button onClick={handleSave} disabled={saving}
            className="mt-2 rounded-lg bg-[#1B556B] px-5 py-2 text-sm font-semibold text-white hover:bg-[#164659] disabled:opacity-50">
            {saving ? 'Salvando...' : saved ? '✓ Salvo' : 'Salvar Configuração'}
          </button>
        </div>
      )}
    </div>
  )
}

// Mantém export legado para não quebrar imports existentes
export const TabOrderEditor = TabOrderEditorByPipeline
