'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { importExistingWhatsAppChats } from '@/lib/actions/whatsapp'

export function ImportWhatsAppChatsButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleImport() {
    if (!confirm('Importar todas as conversas que já existem nesse WhatsApp (de antes de conectar o CRM)? Grupos são ignorados automaticamente.')) return
    setBusy(true)
    setResult(null)
    const res = await importExistingWhatsAppChats()
    setBusy(false)
    if (res.error) {
      setResult(`Erro: ${res.error}`)
    } else {
      setResult(`✅ ${res.imported} conversa(s) importada(s), ${res.skipped} já existiam ou eram grupo.`)
      router.refresh()
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={handleImport} disabled={busy} className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
        {busy ? 'Importando...' : '📥 Importar conversas existentes do WhatsApp'}
      </button>
      {result && <span className="text-xs text-gray-500">{result}</span>}
    </div>
  )
}
