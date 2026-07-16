'use client'

import { useState } from 'react'
import { connectZApi, disconnectZApi } from '@/lib/actions/whatsapp'

export function WhatsAppSettingsForm({ isConnected }: { isConnected: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConnect(formData: FormData) {
    setBusy(true)
    setError(null)
    const result = await connectZApi(formData)
    setBusy(false)
    if (result.error) setError(result.error)
    else window.location.reload()
  }

  async function handleDisconnect() {
    if (!confirm('Desconectar o WhatsApp? Envio e automações por WhatsApp param de funcionar até reconectar.')) return
    setBusy(true)
    await disconnectZApi()
    setBusy(false)
    window.location.reload()
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-6">
      <div>
        <h3 className="text-sm font-medium text-gray-900">📱 WhatsApp (via Z-API)</h3>
        <p className="mt-0.5 text-xs text-gray-400">
          Conecta o número de WhatsApp da empresa — dá pra mandar e receber mensagem direto da conta do cliente, e usar em automações.
        </p>
      </div>

      {isConnected ? (
        <div className="flex items-center justify-between rounded-md bg-positive-100/50 px-3 py-2">
          <p className="text-sm text-positive-700">✅ Conectado</p>
          <button onClick={handleDisconnect} disabled={busy} className="text-xs text-negative-600 hover:underline disabled:opacity-50">
            {busy ? 'Desconectando...' : 'Desconectar'}
          </button>
        </div>
      ) : (
        <form action={handleConnect} className="space-y-2">
          <div>
            <label className="block text-xs text-gray-500">Instance ID</label>
            <input name="zapi_instance_id" required className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Token (da instância)</label>
            <input name="zapi_token" required className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Client-Token (segurança da conta)</label>
            <input name="zapi_client_token" required className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
            {busy ? 'Testando conexão...' : 'Conectar'}
          </button>
        </form>
      )}
    </div>
  )
}
