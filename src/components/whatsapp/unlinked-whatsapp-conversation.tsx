'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { linkUnlinkedWhatsAppConversation, sendUnlinkedWhatsAppMessage } from '@/lib/actions/whatsapp'
import { WhatsAppChatView } from '@/components/whatsapp/whatsapp-chat-view'

type UnlinkedMessage = {
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

type ContractOption = { id: string; label: string }

export function UnlinkedWhatsAppConversation({
  phone,
  senderName,
  messages,
  searchContracts,
}: {
  phone: string
  senderName: string | null
  messages: UnlinkedMessage[]
  searchContracts: (query: string) => Promise<ContractOption[]>
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ContractOption[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sendBusy, setSendBusy] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  async function handleReply() {
    setSendBusy(true)
    setSendError(null)
    const result = await sendUnlinkedWhatsAppMessage(phone, replyText)
    setSendBusy(false)
    if (result.error) setSendError(result.error)
    else {
      setReplyText('')
      router.refresh()
    }
  }

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const timeout = setTimeout(() => {
      searchContracts(query).then(setResults)
    }, 300)
    return () => clearTimeout(timeout)
  }, [query, searchContracts])

  async function handleLink(contractId: string) {
    setBusy(true)
    setError(null)
    const result = await linkUnlinkedWhatsAppConversation(phone, contractId)
    setBusy(false)
    if (result.error) setError(result.error)
    else router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3">
        <p className="text-sm font-medium text-yellow-900">📥 Número não vinculado a nenhuma conta</p>
        <p className="text-xs text-yellow-700">
          {senderName ? `"${senderName}" · ` : ''}{phone} — busca e vincula a uma conta existente pra essa conversa (e as próximas mensagens desse número) ficarem registradas lá.
        </p>
        <div className="relative mt-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conta pelo nome..."
            className="w-full rounded-md border border-yellow-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-md">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleLink(r.id)}
                  disabled={busy}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>

      <WhatsAppChatView messages={messages} contactName={senderName} contactPhone={phone} />

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm font-medium text-gray-900">Responder (sem vincular a nenhuma conta ainda)</p>
        <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        {sendError && <p className="text-xs text-red-600">{sendError}</p>}
        <button onClick={handleReply} disabled={sendBusy || !replyText.trim()} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
          {sendBusy ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
