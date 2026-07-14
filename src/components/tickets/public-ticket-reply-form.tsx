'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addPublicTicketReply } from '@/lib/actions/tickets'

export function PublicTicketReplyForm({ token }: { token: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!message.trim()) {
      setError('Escreva algo antes de enviar.')
      return
    }
    setError(null)
    setBusy(true)
    const result = await addPublicTicketReply(token, name, message)
    setBusy(false)
    if (result.error) {
      setError(result.error)
    } else {
      setMessage('')
      router.refresh()
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <label className="block text-xs text-gray-500">Seu nome</label>
      <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
      <label className="mt-2 block text-xs text-gray-500">Mensagem</label>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <button onClick={handleSend} disabled={busy} className="mt-2 rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
        {busy ? 'Enviando...' : 'Responder'}
      </button>
    </div>
  )
}
