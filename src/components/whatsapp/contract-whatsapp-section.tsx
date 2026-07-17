'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { sendContractWhatsApp, buildWhatsAppFromTemplate, sendContractWhatsAppMedia } from '@/lib/actions/whatsapp'
import { WhatsAppChatView } from '@/components/whatsapp/whatsapp-chat-view'
import { createClient } from '@/lib/supabase/client'
import { sanitizeStorageFileName } from '@/lib/utils/storage'

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
  media_url: string | null
  media_type: string | null
  media_filename: string | null
  sender_photo_url: string | null
  delivery_status: string | null
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  async function handleFileUpload() {
    const file = fileInputRef.current?.files?.[0]
    if (!file || !phone) {
      if (!phone) setError('Informe o telefone antes de enviar um arquivo.')
      return
    }
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const storagePath = `whatsapp-media/${contractId}/${Date.now()}-${sanitizeStorageFileName(file.name)}`
    const { error: uploadError } = await supabase.storage.from('proposal-files').upload(storagePath, file)

    if (uploadError) {
      setBusy(false)
      setError(`Falha no upload: ${uploadError.message}`)
      return
    }

    const publicUrl = `${window.location.origin}/api/email-assets/${storagePath}`
    const mediaType = file.type.startsWith('image/') ? 'image' : 'document'
    const result = await sendContractWhatsAppMedia(contractId, phone, publicUrl, mediaType, file.name)

    setBusy(false)
    if (result.error) setError(result.error)
    else {
      if (fileInputRef.current) fileInputRef.current.value = ''
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
      <WhatsAppChatView messages={messageLog} />

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
        <div className="flex items-center gap-2">
          <button onClick={handleSend} disabled={busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
            {busy ? 'Enviando...' : 'Enviar'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="text-xs" />
          <button type="button" onClick={handleFileUpload} disabled={busy} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            📎 Anexar
          </button>
        </div>
      </div>
    </div>
  )
}
