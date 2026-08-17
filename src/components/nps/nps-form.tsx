'use client'

import { useState, useTransition } from 'react'
import { submitNpsResponse } from '@/lib/actions/nps'

function npsColor(n: number, selected: boolean) {
  const base = n <= 6
    ? selected ? 'bg-red-600 border-red-600 text-white' : 'border-red-200 text-red-500 hover:border-red-400'
    : n <= 8
    ? selected ? 'bg-amber-500 border-amber-500 text-white' : 'border-amber-200 text-amber-500 hover:border-amber-400'
    : selected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-emerald-200 text-emerald-600 hover:border-emerald-400'
  return `rounded-md border py-2 text-sm font-semibold transition-colors ${base}`
}

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
    if (score === null) { setError('Selecione uma nota antes de enviar.'); return }
    if (!respondentName.trim()) { setError('Preencha seu nome antes de enviar.'); return }
    if (!respondentEmail.trim()) { setError('Preencha seu e-mail antes de enviar.'); return }
    if (!respondentPhone.trim()) { setError('Preencha seu telefone antes de enviar.'); return }
    setError(null)
    const formData = new FormData()
    formData.set('score', String(score))
    formData.set('comment', comment)
    formData.set('respondent_name', respondentName)
    formData.set('respondent_email', respondentEmail)
    formData.set('respondent_phone', respondentPhone)
    startTransition(async () => {
      const result = await submitNpsResponse(token, formData)
      if ('error' in result) setError(result.error)
      else setDone(true)
    })
  }

  if (done) {
    return (
      <div className="text-center py-4">
        <p className="text-lg font-semibold text-[#1B556B]">Obrigado pela sua resposta!</p>
        <p className="mt-1 text-sm text-gray-500">Sua avaliação foi registrada com sucesso.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Seletor NPS */}
      <div>
        <p className="text-base font-semibold text-[#1B556B]">
          Em uma escala de 0 a 10, qual a chance de você indicar nossos serviços para um amigo ou parceiro?
        </p>
        <div className="mt-3 grid grid-cols-11 gap-1">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <button key={n} type="button" onClick={() => setScore(n)}
              className={npsColor(n, score === n)}>
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] font-medium">
          <span className="text-red-400">Detrator (0-6)</span>
          <span className="text-amber-400">Neutro (7-8)</span>
          <span className="text-emerald-500">Promotor (9-10)</span>
        </div>
      </div>

      {/* Dados do respondente */}
      <div>
        <label className="block text-sm font-semibold text-[#1B556B]">
          Seu nome completo <span className="text-red-500">*</span>
        </label>
        <input value={respondentName} onChange={e => setRespondentName(e.target.value)} required
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:ring-2 focus:ring-[#1B556B]/20 focus:outline-none" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-[#1B556B]">E-mail <span className="text-red-500">*</span></label>
          <input type="email" required value={respondentEmail} onChange={e => setRespondentEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:ring-2 focus:ring-[#1B556B]/20 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-[#1B556B]">Telefone <span className="text-red-500">*</span></label>
          <input required value={respondentPhone} onChange={e => setRespondentPhone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:ring-2 focus:ring-[#1B556B]/20 focus:outline-none" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#1B556B]">
          Quer deixar algum elogio, crítica ou sugestão?
        </label>
        <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:ring-2 focus:ring-[#1B556B]/20 focus:outline-none resize-none" />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <button type="submit" disabled={isPending}
        className="w-full rounded-lg bg-[#1B556B] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#164659] disabled:opacity-50 transition-colors">
        {isPending ? 'Enviando...' : 'Enviar resposta'}
      </button>
    </form>
  )
}
