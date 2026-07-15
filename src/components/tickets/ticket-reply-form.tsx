'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addTicketMessage } from '@/lib/actions/tickets'

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!message.trim()) return
    setBusy(true)
    setError(null)
    const result = await addTicketMessage(ticketId, message, isInternalNote)
    setBusy(false)
    if (result.error) {
      setError(result.error)
    } else {
      setMessage('')
      router.refresh()
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <label className="block text-xs font-medium text-gray-600">Responder</label>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
      <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={isInternalNote} onChange={(e) => setIsInternalNote(e.target.checked)} className="rounded border-gray-300" />
        Nota interna (o cliente NÃO vê isso no link público)
      </label>
      <button onClick={handleSend} disabled={busy} className="mt-2 rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
        {busy ? 'Enviando...' : 'Enviar'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
