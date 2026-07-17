'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { linkUnlinkedWhatsAppConversation, sendUnlinkedWhatsAppMessage } from '@/lib/actions/whatsapp'
import { convertLeadToOpportunity } from '@/lib/actions/leads'
import { WhatsAppChatView } from '@/components/whatsapp/whatsapp-chat-view'

type Message = {
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

export function WhatsAppConversationPanel({
  phone,
  displayName,
  leadId,
  messages,
  searchContracts,
}: {
  phone: string
  displayName: string | null
  leadId: string | null
  messages: Message[]
  searchContracts: (query: string) => Promise<ContractOption[]>
}) {
  const router = useRouter()
  const [showLinkSearch, setShowLinkSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ContractOption[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const timeout = setTimeout(() => searchContracts(query).then(setResults), 300)
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

  async function handleConvert() {
    if (!leadId) return
    if (!confirm('Converter esse lead em oportunidade agora? Ele entra no funil de Novos Negócios.')) return
    setBusy(true)
    setError(null)
    const result = await convertLeadToOpportunity(leadId)
    setBusy(false)
    if (result.error) setError(result.error)
    else if (result.contractId) router.push(`/contracts/${result.contractId}`)
  }

  async function handleReply() {
    setBusy(true)
    setError(null)
    const result = await sendUnlinkedWhatsAppMessage(phone, replyText)
    setBusy(false)
    if (result.error) setError(result.error)
    else {
      setReplyText('')
      router.refresh()
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${leadId ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {leadId ? '🎯 Já é um Lead' : '⚠️ Sem conta vinculada'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {leadId && (
              <>
                <Link href={`/leads/${leadId}`} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  Ver Lead completo
                </Link>
                <button onClick={handleConvert} disabled={busy} className="rounded-md bg-positive-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-positive-700 disabled:opacity-50">
                  ✅ Converter em oportunidade
                </button>
              </>
            )}
            <button onClick={() => setShowLinkSearch((v) => !v)} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
              🔍 Vincular a conta existente
            </button>
            <Link href={`/contracts/new`} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
              ➕ Criar oportunidade nova
            </Link>
          </div>
        </div>

        {showLinkSearch && (
          <div className="relative mt-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar conta pelo nome..."
              className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
              autoFocus
            />
            {results.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-md">
                {results.map((r) => (
                  <button key={r.id} onClick={() => handleLink(r.id)} disabled={busy} className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50">
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      <WhatsAppChatView messages={messages} contactName={displayName} contactPhone={phone} />

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
        <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} placeholder="Responder..." className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        <button onClick={handleReply} disabled={busy || !replyText.trim()} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
          {busy ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
