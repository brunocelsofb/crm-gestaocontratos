'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { sendUnlinkedWhatsAppMessage } from '@/lib/actions/whatsapp'
import { WhatsAppChatView } from '@/components/whatsapp/whatsapp-chat-view'

type LeadMessage = {
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

export function LeadWhatsAppSection({ phone, leadName, messages }: { phone: string | null; leadName: string; messages: LeadMessage[] }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!phone || messages.length === 0) return null

  async function handleSend() {
    if (!phone) return
    setBusy(true)
    setError(null)
    const result = await sendUnlinkedWhatsAppMessage(phone, text)
    setBusy(false)
    if (result.error) setError(result.error)
    else {
      setText('')
      router.refresh()
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-900">Conversa de WhatsApp</p>
      <WhatsAppChatView messages={messages} contactName={leadName} contactPhone={phone} />
      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Responder..." className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button onClick={handleSend} disabled={busy || !text.trim()} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
          {busy ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
