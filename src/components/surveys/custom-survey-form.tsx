'use client'

import { useState, useTransition } from 'react'
import { submitCustomSurveyResponse } from '@/lib/actions/custom-surveys'
import type { Question } from '@/lib/actions/custom-surveys'
import { LIKERT_OPTIONS } from '@/lib/utils/survey-score'

export function CustomSurveyForm({ token, questions }: { token: string; questions: Question[] }) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [respondentName, setRespondentName] = useState('')
  const [respondentEmail, setRespondentEmail] = useState('')
  const [respondentPhone, setRespondentPhone] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function setAnswer(id: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  function toggleMultiple(id: string, option: string) {
    const current = (answers[id] as string[]) ?? []
    setAnswer(id, current.includes(option) ? current.filter((o) => o !== option) : [...current, option])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!respondentName.trim() || !respondentEmail.trim() || !respondentPhone.trim()) {
      setError('Preencha nome, e-mail e telefone antes de enviar.')
      return
    }
    setError(null)

    const formData = new FormData()
    formData.set('respondent_name', respondentName)
    formData.set('respondent_email', respondentEmail)
    formData.set('respondent_phone', respondentPhone)
    formData.set('responses', JSON.stringify(answers))

    startTransition(async () => {
      const result = await submitCustomSurveyResponse(token, formData)
      if ('error' in result) setError(result.error)
      else setDone(true)
    })
  }

  if (done) {
    return (
      <div className="text-center">
        <p className="text-lg font-medium text-gray-900">Obrigado pela sua resposta!</p>
        <p className="mt-1 text-sm text-gray-500">Suas respostas foram registradas com sucesso.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input
          value={respondentName}
          onChange={(e) => setRespondentName(e.target.value)}
          placeholder="Seu nome *"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
        />
        <input
          type="email"
          value={respondentEmail}
          onChange={(e) => setRespondentEmail(e.target.value)}
          placeholder="Seu e-mail *"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
        />
        <input
          value={respondentPhone}
          onChange={(e) => setRespondentPhone(e.target.value)}
          placeholder="Seu telefone *"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
        />
      </div>

      {questions.map((q) => (
        <div key={q.id}>
          <label className="block text-sm font-medium text-gray-900">{q.label}</label>

          {q.type === 'text' && (
            <input
              value={(answers[q.id] as string) ?? ''}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
            />
          )}

          {q.type === 'textarea' && (
            <textarea
              value={(answers[q.id] as string) ?? ''}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
            />
          )}

          {q.type === 'single_choice' && (
            <div className="mt-1 space-y-1">
              {(q.options ?? []).map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === opt}
                    onChange={() => setAnswer(q.id, opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          )}

          {q.type === 'multiple_choice' && (
            <div className="mt-1 space-y-1">
              {(q.options ?? []).map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={((answers[q.id] as string[]) ?? []).includes(opt)}
                    onChange={() => toggleMultiple(q.id, opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          )}

          {q.type === 'likert' && (
            <div className="mt-1 space-y-1">
              {LIKERT_OPTIONS.map((opt) => (
                <label key={opt.label} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === opt.label}
                    onChange={() => setAnswer(q.id, opt.label)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          )}

          {q.type === 'rating' && (
            <div className="mt-1 grid grid-cols-11 gap-1">
              {Array.from({ length: 11 }, (_, n) => n).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAnswer(q.id, String(n))}
                  className={`rounded-md border py-1.5 text-xs font-medium ${
                    answers[q.id] === String(n)
                      ? 'border-brand-700 bg-brand-700 text-white'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {isPending ? 'Enviando...' : 'Enviar respostas'}
      </button>
    </form>
  )
}
