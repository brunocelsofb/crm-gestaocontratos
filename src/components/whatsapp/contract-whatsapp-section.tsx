'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { sendContractWhatsApp, buildWhatsAppFromTemplate } from '@/lib/actions/whatsapp'
import { ExpandableRow } from '@/components/surveys/expandable-row'

type Template = { id: string; name: string }
type WhatsAppLog = {
  id: string
  phone: string
  message: string
  direction: string
  status: string
  triggered_automatically: boolean
  error_message: string | null
  created_at: string
}

export function ContractWhatsAppSection({
  contractId,
  isConnected,
  templates,
  defaultPhone,
  messageLog,
}: {
  contractId: string
  isConnected: boolean
  templates: Template[]
  defaultPhone: string | null
  messageLog: WhatsAppLog[]
}) {
  const router = useRouter()
  const [phone, setPhone] = useState(defaultPhone ?? '')
  const [message, setMessage] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleTemplateChange(id: string) {
    setTemplateId(id)
    if (!id) return
    const filled = await buildWhatsAppFromTemplate(id, contractId)
    if (filled) {
      setMessage(filled.message)
      if (filled.phone) setPhone(filled.phone)
    }
  }

  async function handleSend() {
    setBusy(true)
    setError(null)
    const result = await sendContractWhatsApp(contractId, phone, message, templateId || null)
    setBusy(false)
    if (result.error) {
      setError(result.error)
    } else {
      setMessage('')
      setTemplateId('')
      router.refresh()
    }
  }

  if (!isConnected) {
    return (
      <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
        WhatsApp ainda não está conectado — vá em{' '}
        <a href="/settings" className="underline">Configurações</a> e conecte o Z-API.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm font-medium text-gray-900">Enviar WhatsApp</p>
        {templates.length > 0 && (
          <div>
            <label className="block text-xs text-gray-500">Usar template (opcional)</label>
            <select value={templateId} onChange={(e) => handleTemplateChange(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
              <option value="">Escrever do zero...</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-500">Telefone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="62999999999" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Mensagem</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button onClick={handleSend} disabled={busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
          {busy ? 'Enviando...' : 'Enviar'}
        </button>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-500">Histórico</p>
        {messageLog.map((m) => (
          <ExpandableRow
            key={m.id}
            summary={
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-800">{m.direction === 'recebido' ? '📥' : '📤'} {m.message.slice(0, 60)}{m.message.length > 60 ? '...' : ''}</span>
                <span className="shrink-0 text-xs text-gray-400">{new Date(m.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
            }
          >
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.message}</p>
            <p className="mt-1 text-xs text-gray-400">
              {m.direction === 'recebido' ? 'De' : 'Pra'} {m.phone} · {new Date(m.created_at).toLocaleString('pt-BR')}
              {m.triggered_automatically && ' · Automático'}
            </p>
            {m.status === 'falhou' && <p className="text-xs text-red-600">Falhou: {m.error_message}</p>}
          </ExpandableRow>
        ))}
        {messageLog.length === 0 && <p className="text-sm text-gray-400">Nenhuma mensagem ainda.</p>}
      </div>
    </div>
  )
}
