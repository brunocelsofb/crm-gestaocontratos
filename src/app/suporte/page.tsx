'use client'

import { useState } from 'react'
import { createTicket } from '@/lib/actions/tickets'
import { PRIORITY_LABELS, GRAVITY_CATEGORIES } from '@/lib/utils/gut-matrix'

export default function PublicSupportPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ ticketId: string; publicToken: string } | null>(null)

  async function handleSubmit(formData: FormData) {
    setBusy(true)
    setError(null)
    formData.set('source', 'formulario')
    const res = await createTicket(formData)
    setBusy(false)

    if (res.error) {
      setError(res.error)
      return
    }
    if (res.ticketId && res.publicToken) {
      setResult({ ticketId: res.ticketId, publicToken: res.publicToken })
    }
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center">
          <p className="text-lg font-medium text-gray-900">✅ Chamado aberto!</p>
          <p className="mt-1 text-sm text-gray-500">Nossa equipe já foi avisada. Guarde o link abaixo pra acompanhar o andamento:</p>
          <a
            href={`/acompanhar-ticket/${result.publicToken}`}
            className="mt-3 block break-all rounded-md bg-brand-100 px-3 py-2 text-xs text-brand-700 hover:underline"
          >
            {typeof window !== 'undefined' ? window.location.origin : ''}/acompanhar-ticket/{result.publicToken}
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">Abrir chamado de suporte</h1>
          <p className="mt-1 text-sm text-gray-500">Conta pra gente o que está acontecendo.</p>
        </div>
        <form action={handleSubmit} className="space-y-3 rounded-xl border border-gray-200 bg-white p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome e sobrenome *</label>
            <input name="requester_name" required pattern=".*\S+\s+\S+.*" title="Informe nome e sobrenome" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">E-mail *</label>
            <input name="requester_email" type="email" required className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Telefone *</label>
            <input name="requester_phone" required className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">CNPJ vinculado ao contrato *</label>
            <input name="requester_cnpj" required placeholder="00.000.000/0000-00" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none" />
            <p className="mt-0.5 text-xs text-gray-400">É o CNPJ da empresa que tem contrato com a gente — usamos pra já direcionar seu chamado certo.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Sobre o que é o chamado? *</label>
            <select name="category" required defaultValue="" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none">
              <option value="" disabled>Selecione...</option>
              {GRAVITY_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Assunto *</label>
            <input name="subject" required className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Descreva o problema *</label>
            <textarea name="description" required rows={4} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Urgência *</label>
            <select name="priority" required defaultValue="pouco_critica" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none">
              <option value="nao_critica">{PRIORITY_LABELS.nao_critica}</option>
              <option value="pouco_critica">{PRIORITY_LABELS.pouco_critica} — pode esperar</option>
              <option value="critica">{PRIORITY_LABELS.critica} — está atrapalhando o trabalho</option>
              <option value="muito_critica">{PRIORITY_LABELS.muito_critica} — parou tudo</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
            {busy ? 'Enviando...' : 'Abrir chamado'}
          </button>
        </form>
      </div>
    </div>
  )
}
