'use client'

import { useState, useRef, useEffect } from 'react'
import { useActionState } from 'react'
import { createSurveyTemplate, type ActionState, type Question } from '@/lib/actions/custom-surveys'

const initialState: ActionState = {}

const QUESTION_TYPES: { value: Question['type']; label: string }[] = [
  { value: 'text', label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'single_choice', label: 'Escolha única' },
  { value: 'multiple_choice', label: 'Múltipla escolha' },
  { value: 'rating', label: 'Nota (0 a 10)' },
]

export function SurveyTemplateForm({ tags }: { tags: { id: string; name: string; color: string }[] }) {
  const [state, formAction, pending] = useActionState(createSurveyTemplate, initialState)
  const [questions, setQuestions] = useState<Question[]>([
    { id: crypto.randomUUID(), type: 'text', label: '' },
  ])
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset()
      setQuestions([{ id: crypto.randomUUID(), type: 'text', label: '' }])
    }
  }, [pending, state])

  function addQuestion() {
    setQuestions((prev) => [...prev, { id: crypto.randomUUID(), type: 'text', label: '' }])
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  function updateQuestion(id: string, patch: Partial<Question>) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)))
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <input
        type="hidden"
        name="questions"
        value={JSON.stringify(
          questions.map((q) => ({
            ...q,
            options: q.options ? q.options.map((o) => o.trim()).filter(Boolean) : q.options,
          }))
        )}
      />

      <div>
        <label className="block text-xs font-medium text-gray-700">Nome do formulário</label>
        <input
          name="name"
          required
          placeholder="Ex: Pesquisa de satisfação — Implantação"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700">Tag (opcional)</label>
        <select
          name="tag_id"
          defaultValue=""
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
        >
          <option value="">Qualquer contrato (sem restrição)</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400">Se escolher uma tag, este formulário só aparece pra contratos marcados com ela.</p>
      </div>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">#{i + 1}</span>
              <input
                value={q.label}
                onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                placeholder="Texto da pergunta"
                className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
              />
              <select
                value={q.type}
                onChange={(e) => updateQuestion(q.id, { type: e.target.value as Question['type'] })}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-brand-700 focus:outline-none"
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeQuestion(q.id)}
                  className="text-xs text-gray-400 hover:text-negative-600"
                >
                  Remover
                </button>
              )}
            </div>

            {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
              <div className="mt-2">
                <label className="block text-[10px] text-gray-500">Opções (uma por linha)</label>
                <textarea
                  value={(q.options ?? []).join('\n')}
                  onChange={(e) => updateQuestion(q.id, { options: e.target.value.split('\n') })}
                  rows={3}
                  placeholder={'Opção 1\nOpção 2\nOpção 3'}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-brand-700 focus:outline-none"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addQuestion}
        className="rounded-md border border-brand-700 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
      >
        + Adicionar pergunta
      </button>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {pending ? 'Salvando...' : 'Salvar Formulário'}
        </button>
      </div>
    </form>
  )
}
