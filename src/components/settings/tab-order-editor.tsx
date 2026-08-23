'use client'

import { useState } from 'react'

type Tab = { id: string; label: string }

export function TabOrderEditor({ allTabs, currentOrder }: { allTabs: Tab[]; currentOrder: string[] }) {
  const sorted = [...currentOrder]
    .map(id => allTabs.find(t => t.id === id))
    .filter(Boolean) as Tab[]
  // Adiciona tabs que não estão na ordem salva
  allTabs.forEach(t => { if (!sorted.find(s => s.id === t.id)) sorted.push(t) })

  const [tabs, setTabs] = useState(sorted)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function move(i: number, dir: -1 | 1) {
    const next = [...tabs]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    setTabs(next)
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    await fetch('/api/settings/tab-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: tabs.map(t => t.id) }),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="space-y-2">
        {tabs.map((tab, i) => (
          <div key={tab.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
            <span className="text-xs font-mono text-gray-400 w-4">{i + 1}</span>
            <span className="flex-1 text-sm font-medium text-gray-800">{tab.label}</span>
            <div className="flex gap-1">
              <button onClick={() => move(i, -1)} disabled={i === 0}
                className="rounded p-1 text-gray-400 hover:bg-gray-200 disabled:opacity-20">↑</button>
              <button onClick={() => move(i, 1)} disabled={i === tabs.length - 1}
                className="rounded p-1 text-gray-400 hover:bg-gray-200 disabled:opacity-20">↓</button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={handleSave} disabled={saving}
        className="rounded-lg bg-[#1B556B] px-5 py-2 text-sm font-semibold text-white hover:bg-[#164659] disabled:opacity-50">
        {saving ? 'Salvando...' : saved ? '✓ Salvo' : 'Salvar Ordem'}
      </button>
    </div>
  )
}
