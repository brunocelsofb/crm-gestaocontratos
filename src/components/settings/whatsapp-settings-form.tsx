'use client'

import { useState } from 'react'
import { connectEvo, disconnectEvo } from '@/lib/actions/whatsapp'
import { getEvoQrCode } from '@/lib/whatsapp/evolution'

type Props = {
  isConnected: boolean
  currentServerUrl: string | null
  currentInstanceName: string | null
}

export function WhatsAppSettingsForm({ isConnected, currentServerUrl, currentInstanceName }: Props) {
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loadingQr, setLoadingQr] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [formState, setFormState] = useState<{ error?: string } | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  async function handleGetQr(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setLoadingQr(true); setQrCode(null); setStatus(null); setFormState(null)

    // Salva credenciais primeiro
    const res = await connectEvo(fd)
    setFormState(res)
    if (res.error) { setLoadingQr(false); return }

    // Busca QR Code
    const serverUrl = (fd.get('evo_server_url') as string).trim()
    const apiKey    = (fd.get('evo_api_key') as string).trim()
    const instance  = (fd.get('evo_instance_name') as string).trim()

    try {
      const data = await getEvoQrCode({ serverUrl, apiKey, instanceName: instance })
      console.log('[evo qr] resposta:', data)
      if (data.error) setStatus(`❌ ${data.error}`)
      else if (data.base64) setQrCode(data.base64)
      else if (data.status) setStatus(data.status)
      else setStatus('QR Code não disponível. Verifique se a instância está desconectada.')
    } catch (e: any) {
      setStatus(`Erro ao buscar QR Code: ${e.message}`)
    }
    setLoadingQr(false)
  }

  async function handleDisconnect() {
    if (!confirm('Desconectar o WhatsApp? O bot deixará de funcionar.')) return
    setDisconnecting(true)
    await disconnectEvo()
    setDisconnecting(false)
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      {/* Status atual */}
      {isConnected && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-green-800">✅ WhatsApp conectado via Evolution API</p>
            <p className="text-xs text-green-600 mt-0.5">{currentServerUrl} · instância: {currentInstanceName}</p>
          </div>
          <button onClick={handleDisconnect} disabled={disconnecting}
            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
            {disconnecting ? 'Desconectando...' : 'Desconectar'}
          </button>
        </div>
      )}

      {/* Formulário de configuração */}
      <form onSubmit={handleGetQr} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-[#1B556B]">Configurações da Evolution API</h3>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Server URL *</label>
          <input name="evo_server_url" required
            defaultValue={currentServerUrl ?? 'https://beautiful-energy-production-24fa.up.railway.app'}
            placeholder="https://seu-servidor.railway.app"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">API Key (Global) *</label>
          <input name="evo_api_key" required type="password"
            placeholder="Sua AUTHENTICATION_API_KEY"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none" />
          <p className="mt-1 text-xs text-gray-400">Configure como variável de ambiente AUTHENTICATION_API_KEY no Railway.</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Instance Name *</label>
          <input name="evo_instance_name" required
            defaultValue={currentInstanceName ?? 'drone_whatsapp'}
            placeholder="drone_whatsapp"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none" />
        </div>

        {formState?.error && (
          <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{formState.error}</p>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={loadingQr}
            className="rounded-lg bg-[#1B556B] px-5 py-2 text-sm font-semibold text-white hover:bg-[#164659] disabled:opacity-50">
            {loadingQr ? 'Conectando...' : '📱 Salvar e obter QR Code'}
          </button>
        </div>
      </form>

      {/* QR Code */}
      {qrCode && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center space-y-3">
          <p className="text-sm font-semibold text-[#1B556B]">Escaneie o QR Code com seu WhatsApp</p>
          <p className="text-xs text-gray-500">Abra o WhatsApp → Dispositivos vinculados → Vincular um dispositivo</p>
          <img src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
            alt="QR Code WhatsApp" className="mx-auto max-w-xs rounded-lg border" />
          <p className="text-xs text-gray-400">O QR Code expira em ~60 segundos. Recarregue se expirar.</p>
        </div>
      )}

      {status && (
        <p className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-700">{status}</p>
      )}

      {/* Instrução de webhook */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-600">URL do Webhook (configurar na Evolution API)</p>
        <code className="block text-xs font-mono text-gray-700 bg-white border rounded px-2 py-1.5 break-all">
          {typeof window !== 'undefined' ? window.location.origin : 'https://seu-crm.vercel.app'}/api/whatsapp-inbound/evolution
        </code>
        <p className="text-xs text-gray-400">No painel da Evolution API → Settings → Webhooks → MESSAGES_UPSERT</p>
      </div>
    </div>
  )
}
