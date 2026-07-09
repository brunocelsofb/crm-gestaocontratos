'use client'

import { useState, useTransition } from 'react'
import { submitNpsResponse } from '@/lib/actions/nps'

export function NpsForm({ token, companyName }: { token: string; companyName: string }) {
  const [score, setScore] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [respondentName, setRespondentName] = useState('')
  const [respondentEmail, setRespondentEmail] = useState('')
  const [respondentPhone, setRespondentPhone] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (score === null) {
      setError('Selecione uma nota antes de enviar.')
      return
    }
    if (!respondentName.trim()) {
      setError('Preencha seu nome antes de enviar.')
      return
    }
    if (!respondentEmail.trim()) {
      setError('Preencha seu e-mail antes de enviar.')
      return
    }
    if (!respondentPhone.trim()) {
      setError('Preencha seu telefone antes de enviar.')
      return
    }
    setError(null)

    const formData = new FormData()
    formData.set('score', String(score))
    formData.set('comment', comment)
    formData.set('respondent_name', respondentName)
    formData.set('respondent_email', respondentEmail)
    formData.set('respondent_phone', respondentPhone)

    startTransition(async () => {
      const result = await submitNpsResponse(token, formData)
      if ('error' in result) {
        setError(result.error)
      } else {
        setDone(true)
      }
    })
  }

  if (done) {
    return (
      <div className="text-center">
        <p className="text-lg font-medium text-gray-900">Obrigado pela sua resposta!</p>
        <p className="mt-1 text-sm text-gray-500">Sua avaliação foi registrada com sucesso.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <p className="text-sm font-medium text-gray-900">
          Em uma escala de 0 a 10, o quanto você recomendaria {companyName || 'nossa empresa'} a um colega ou parceiro?
        </p>
        <div className="mt-3 grid grid-cols-11 gap-1">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(n)}
              className={`rounded-md border py-2 text-sm font-medium transition-colors ${
                score === n
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-gray-400">
          <span>Pouco provável</span>
          <span>Muito provável</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Seu nome completo <span className="text-red-500">*</span>
        </label>
        <input
          value={respondentName}
          onChange={(e) => setRespondentName(e.target.value)}
          required
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            E-mail <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            value={respondentEmail}
            onChange={(e) => setRespondentEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Telefone <span className="text-red-500">*</span>
          </label>
          <input
            required
            value={respondentPhone}
            onChange={(e) => setRespondentPhone(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Quer nos contar mais? (opcional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {isPending ? 'Enviando...' : 'Enviar resposta'}
      </button>
    </form>
  )
}
