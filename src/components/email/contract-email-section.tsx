'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { sendContractEmail, buildEmailFromTemplate } from '@/lib/actions/email'

type Template = { id: string; name: string }
type EmailLog = { id: string; from_email: string; to_email: string; subject: string; sent_at: string; status: string; triggered_automatically: boolean; error_message: string | null }

export function ContractEmailSection({
  contractId,
  hasGmailConnected,
  templates,
  defaultToEmail,
  emailLog,
}: {
  contractId: string
  hasGmailConnected: boolean
  templates: Template[]
  defaultToEmail: string | null
  emailLog: EmailLog[]
}) {
  const router = useRouter()
  const [toEmail, setToEmail] = useState(defaultToEmail ?? '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleTemplateChange(id: string) {
    setTemplateId(id)
    if (!id) return
    const filled = await buildEmailFromTemplate(id, contractId)
    if (filled) {
      setSubject(filled.subject)
      setBody(filled.body)
      if (filled.toEmail) setToEmail(filled.toEmail)
    }
  }

  async function handleSend() {
    setBusy(true)
    setError(null)
    const result = await sendContractEmail(contractId, toEmail, subject, body, templateId || null)
    setBusy(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSubject('')
      setBody('')
      setTemplateId('')
      router.refresh()
    }
  }

  if (!hasGmailConnected) {
    return (
      <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
        Você ainda não conectou seu Gmail. Vá em{' '}
        <a href="/settings" className="underline">Configurações</a> pra conectar antes de enviar e-mails por aqui.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm font-medium text-gray-900">Enviar e-mail</p>
        {templates.length > 0 && (
          <div>
            <label className="block text-xs text-gray-500">Usar template (opcional)</label>
            <select value={templateId} onChange={(e) => handleTemplateChange(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
              <option value="">Escrever do zero...</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-500">Para</label>
          <input value={toEmail} onChange={(e) => setToEmail(e.target.value)} type="email" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Assunto</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Mensagem</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button onClick={handleSend} disabled={busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
          {busy ? 'Enviando...' : 'Enviar'}
        </button>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-500">Histórico de e-mails</p>
        {emailLog.map((e) => (
          <div key={e.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">{e.subject}</span>
              <span className={`text-xs ${e.status === 'enviado' ? 'text-positive-700' : 'text-negative-700'}`}>
                {e.status === 'enviado' ? '✓ Enviado' : '✗ Falhou'}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              De {e.from_email} pra {e.to_email} · {new Date(e.sent_at).toLocaleString('pt-BR')}
              {e.triggered_automatically && ' · Automático'}
            </p>
            {e.error_message && <p className="mt-0.5 text-xs text-red-600">{e.error_message}</p>}
          </div>
        ))}
        {emailLog.length === 0 && <p className="text-sm text-gray-400">Nenhum e-mail enviado ainda por essa conta.</p>}
      </div>
    </div>
  )
}
