'use client'

import { useState } from 'react'
import { updateEmailSignature } from '@/lib/actions/email'

export function EmailSignatureForm({ currentSignature }: { currentSignature: string }) {
  const [signature, setSignature] = useState(currentSignature)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setBusy(true)
    setSaved(false)
    await updateEmailSignature(signature)
    setBusy(false)
    setSaved(true)
  }

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-medium text-gray-900">✍️ Assinatura de e-mail</h3>
      <p className="text-xs text-gray-400">Anexada automaticamente no fim de todo e-mail que você enviar pelo CRM (manual ou automático). Pode usar HTML simples.</p>
      <textarea
        value={signature}
        onChange={(e) => setSignature(e.target.value)}
        rows={5}
        placeholder={'Ex:\nAtenciosamente,\nBruno Barbosa\nORBIS Gestão de Tecnologia em Saúde\n(62) 0000-0000'}
        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm font-mono focus:border-brand-700 focus:outline-none"
      />
      <button onClick={handleSave} disabled={busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
        {busy ? 'Salvando...' : 'Salvar assinatura'}
      </button>
      {saved && <span className="ml-2 text-xs text-positive-700">Salvo!</span>}
    </div>
  )
}
