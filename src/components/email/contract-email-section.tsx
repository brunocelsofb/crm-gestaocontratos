'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { sendContractEmail, buildEmailFromTemplate, getEmailSignature } from '@/lib/actions/email'
import { ExpandableRow } from '@/components/surveys/expandable-row'
import { CopyLinkButton } from '@/components/nps/copy-link-button'

type Template = { id: string; name: string }
type EmailLog = {
  id: string
  from_email: string
  to_email: string
  cc_email: string | null
  bcc_email: string | null
  subject: string
  body: string
  sent_at: string
  status: string
  triggered_automatically: boolean
  error_message: string | null
  opened_at: string | null
  direction: string
}

export function ContractEmailSection({
  contractId,
  hasGmailConnected,
  templates,
  defaultToEmail,
  emailLog,
  inboundEmailAddress,
}: {
  contractId: string
  hasGmailConnected: boolean
  templates: Template[]
  defaultToEmail: string | null
  emailLog: EmailLog[]
  inboundEmailAddress: string | null
}) {
  const router = useRouter()
  const [toEmail, setToEmail] = useState(defaultToEmail ?? '')
  const [ccEmail, setCcEmail] = useState('')
  const [bccEmail, setBccEmail] = useState('')
  const [showCcBcc, setShowCcBcc] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [signatureExpanded, setSignatureExpanded] = useState(false)

  useEffect(() => {
    getEmailSignature().then((s) => setSignature(s || null))
  }, [])

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
    const result = await sendContractEmail(contractId, toEmail, subject, body, templateId || null, ccEmail || null, bccEmail || null)
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
      {inboundEmailAddress ? (
        <div className="rounded-lg border border-purple-100 bg-purple-50 p-3">
          <p className="text-xs font-medium text-purple-800">📥 Endereço exclusivo desta conta (lastro de e-mails de fora do CRM)</p>
          <p className="mt-0.5 text-xs text-purple-700">Coloque este endereço em cópia oculta (CCO/BCC) em qualquer e-mail sobre essa oportunidade — fica registrado aqui automaticamente.</p>
          <div className="mt-1.5 flex items-center gap-2">
            <input readOnly value={inboundEmailAddress} className="flex-1 truncate rounded-md border border-purple-200 bg-white px-2 py-1 font-mono text-xs text-purple-700" />
            <CopyLinkButton link={inboundEmailAddress} />
          </div>
        </div>
      ) : (
        <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-400">
          Lastro de e-mails de fora do CRM ainda não está ativo — falta configurar um domínio de recebimento em Configurações.
        </p>
      )}
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
        {inboundEmailAddress ? (
          <div>
            <label className="block text-xs text-gray-500">Responder a (automático)</label>
            <input readOnly value={inboundEmailAddress} className="mt-1 w-full rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-500" />
            <p className="mt-0.5 text-xs text-purple-600">Quando o cliente clicar em &quot;Responder&quot;, a resposta cai automaticamente aqui na conta.</p>
          </div>
        ) : (
          <p className="rounded-md bg-yellow-50 px-2.5 py-1.5 text-xs text-yellow-700">
            Lastro de resposta ainda não está ativo pra essa conta — a resposta do cliente vai direto pra sua caixa pessoal, não pro CRM.
          </p>
        )}
        <div>
          <label className="block text-xs text-gray-500">Para</label>
          <input value={toEmail} onChange={(e) => setToEmail(e.target.value)} type="email" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
          {!showCcBcc && (
            <button type="button" onClick={() => setShowCcBcc(true)} className="mt-1 text-xs text-brand-700 hover:underline">
              + Cc/Cco
            </button>
          )}
        </div>
        {showCcBcc && (
          <>
            <div>
              <label className="block text-xs text-gray-500">Cc</label>
              <input value={ccEmail} onChange={(e) => setCcEmail(e.target.value)} type="email" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500">Cco (cópia oculta)</label>
              <input value={bccEmail} onChange={(e) => setBccEmail(e.target.value)} type="email" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
            </div>
          </>
        )}
        <div>
          <label className="block text-xs text-gray-500">Assunto</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Mensagem</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>

        {signature && (
          <button
            type="button"
            onClick={() => setSignatureExpanded((v) => !v)}
            className="w-full rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-left text-xs text-gray-500 hover:bg-gray-100"
          >
            ✍️ Sua assinatura será incluída automaticamente {signatureExpanded ? '— clique pra recolher ▲' : '— clique pra ver como fica ▼'}
            {signatureExpanded && (
              <div className="mt-2 border-t border-gray-200 pt-2 text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: signature }} />
            )}
          </button>
        )}
        {!signature && (
          <p className="text-xs text-yellow-700">
            Você ainda não configurou uma assinatura — <a href="/minha-conta" className="underline">configure em Minha Conta</a> se quiser que apareça automaticamente.
          </p>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
        <button onClick={handleSend} disabled={busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
          {busy ? 'Enviando...' : 'Enviar'}
        </button>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-500">Histórico de e-mails</p>
        {emailLog.map((e) => (
          <ExpandableRow
            key={e.id}
            summary={
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-medium text-gray-900">{e.direction === 'recebido' ? '📥' : '📤'} {e.subject}</span>
                  <p className="text-xs text-gray-500">
                    {e.direction === 'recebido' ? `De ${e.from_email}` : `Pra ${e.to_email}`} · {new Date(e.sent_at).toLocaleString('pt-BR')}
                    {e.triggered_automatically && ' · Automático'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-xs">
                  {e.status === 'enviado' ? (
                    e.opened_at ? (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-700" title="Rastreamento por pixel — pode não ser 100% exato (alguns clientes de e-mail bloqueiam imagens, o Gmail às vezes pré-carrega antes da pessoa ver de verdade)">
                        👁️ Visualizado
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">Não visualizado</span>
                    )
                  ) : (
                    <span className="rounded-full bg-negative-100 px-2 py-0.5 text-negative-700">✗ Falhou</span>
                  )}
                </div>
              </div>
            }
          >
            <p className="text-xs text-gray-400">De {e.from_email}</p>
            {e.cc_email && <p className="text-xs text-gray-400">Cc: {e.cc_email}</p>}
            {e.bcc_email && <p className="text-xs text-gray-400">Cco: {e.bcc_email}</p>}
            {e.opened_at && <p className="text-xs text-purple-600">Visualizado em {new Date(e.opened_at).toLocaleString('pt-BR')}</p>}
            {e.error_message && <p className="text-xs text-red-600">{e.error_message}</p>}
            <div className="rounded-md border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: e.body }} />
          </ExpandableRow>
        ))}
        {emailLog.length === 0 && <p className="text-sm text-gray-400">Nenhum e-mail enviado ainda por essa conta.</p>}
      </div>
    </div>
  )
}
