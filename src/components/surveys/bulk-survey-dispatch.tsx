'use client'

import { useState, useTransition } from 'react'
import { sendBulkSurvey } from '@/lib/actions/custom-surveys'

type Template = { id: string; name: string }
type Tag = { id: string; name: string }

export function BulkSurveyDispatch({ templates, tags }: { templates: Template[]; tags: Tag[] }) {
  const [open, setOpen] = useState(false)
  const [templateId, setTemplateId] = useState('')
  const [tagFilter, setTagFilter] = useState('all')
  const [expiresAt, setExpiresAt] = useState('')
  const [result, setResult] = useState<{ sent?: number; error?: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDispatch() {
    if (!templateId) { setResult({ error: 'Selecione um formulário.' }); return }
    if (!expiresAt) { setResult({ error: 'Informe a data limite para resposta.' }); return }
    setResult(null)
    startTransition(async () => {
      const res = await sendBulkSurvey(templateId, tagFilter, expiresAt)
      setResult(res)
      if (res.sent !== undefined) {
        setTimeout(() => { setOpen(false); setResult(null); setTemplateId(''); setTagFilter('all'); setExpiresAt('') }, 2000)
      }
    })
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="rounded-lg bg-[#1B556B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#164659] flex-shrink-0">
        + Disparar para contratos ativos
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1B556B]">Disparar pesquisa em lote</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1B556B] mb-1">1. Formulário / Pesquisa *</label>
              <select value={templateId} onChange={e => setTemplateId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none">
                <option value="">Selecione um formulário...</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1B556B] mb-1">2. Filtrar contratos alvo</label>
              <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none">
                <option value="all">Todos os contratos ativos</option>
                {tags.map(t => <option key={t.id} value={t.id}>Apenas tag: {t.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1B556B] mb-1">3. Data limite para resposta *</label>
              <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none" />
              <p className="text-xs text-gray-400 mt-1">Respostas após este prazo não serão contabilizadas no relatório do período.</p>
            </div>

            {result?.error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{result.error}</p>}
            {result?.sent !== undefined && <p className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">✓ {result.sent} pesquisa{result.sent !== 1 ? 's' : ''} disparada{result.sent !== 1 ? 's' : ''} com sucesso!</p>}

            <div className="flex gap-3 pt-1">
              <button onClick={handleDispatch} disabled={isPending}
                className="flex-1 rounded-lg bg-[#1B556B] py-2.5 text-sm font-semibold text-white hover:bg-[#164659] disabled:opacity-50">
                {isPending ? 'Disparando...' : 'Confirmar disparo'}
              </button>
              <button onClick={() => setOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
