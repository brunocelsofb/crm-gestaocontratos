'use client'

import { useState } from 'react'
import { submitTicketSatisfaction } from '@/lib/actions/tickets'
import { LIKERT_OPTIONS } from '@/lib/utils/survey-score'

export function TicketSatisfactionForm({ token }: { token: string }) {
  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit() {
    if (!rating) {
      setError('Escolha uma nota antes de enviar.')
      return
    }
    setBusy(true)
    setError(null)
    const result = await submitTicketSatisfaction(token, rating, comment)
    setBusy(false)
    if (result.error) setError(result.error)
    else setDone(true)
  }

  if (done) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-lg font-medium text-gray-900">✅ Obrigado pela avaliação!</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <p className="text-sm font-medium text-gray-700">Como você avalia o atendimento que recebeu?</p>
      <div className="mt-3 space-y-2">
        {LIKERT_OPTIONS.map((opt) => (
          <label key={opt.points} className="flex items-center gap-2 text-sm text-gray-700">
            <input type="radio" name="rating" checked={rating === opt.points} onChange={() => setRating(opt.points)} />
            {opt.label}
          </label>
        ))}
      </div>
      <label className="mt-3 block text-sm font-medium text-gray-700">Comentário (opcional)</label>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none" />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <button onClick={handleSubmit} disabled={busy} className="mt-3 w-full rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
        {busy ? 'Enviando...' : 'Enviar avaliação'}
      </button>
    </div>
  )
}
