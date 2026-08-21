'use client'

import { useState } from 'react'

export function JobTitleForm({ currentJobTitle, userId }: { currentJobTitle: string | null; userId: string }) {
  const [value, setValue] = useState(currentJobTitle ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true); setSaved(false)
    await fetch('/api/profile/job-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobTitle: value }),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div>
        <label className="block text-sm font-semibold text-gray-700">Cargo / Função</label>
        <p className="text-xs text-gray-400 mt-0.5">Aparece na assinatura automática das mensagens de WhatsApp.</p>
      </div>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Ex: Diretor Comercial, Suporte, Consultor..."
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none"
        />
        <button onClick={handleSave} disabled={saving}
          className="rounded-lg bg-[#1B556B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#164659] disabled:opacity-50">
          {saving ? 'Salvando...' : saved ? '✓ Salvo' : 'Salvar'}
        </button>
      </div>
      {value && (
        <p className="text-xs text-gray-400">
          Prévia: <span className="font-medium text-gray-600">*Seu Nome - {value}:*</span> mensagem...
        </p>
      )}
    </div>
  )
}
