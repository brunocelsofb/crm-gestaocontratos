'use client'

import { useState } from 'react'

export function SurveyShareButtons({
  link,
  expiresAt,
  surveyName,
  contactEmail,
}: {
  link: string
  expiresAt?: string | null
  surveyName: string
  contactEmail?: string | null
}) {
  const [emailOpen, setEmailOpen] = useState(false)
  const [toEmail, setToEmail] = useState(contactEmail ?? '')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const expiryText = expiresAt
    ? ` (Válido até ${new Date(expiresAt).toLocaleDateString('pt-BR')})`
    : ''

  const whatsappText = encodeURIComponent(
    `Olá! Gostaríamos de ouvir sua opinião sobre os nossos serviços da ORBIS. Responda nossa pesquisa de satisfação através do link: ${link}${expiryText}`
  )

  async function handleSendEmail() {
    if (!toEmail) return
    setSending(true)
    await fetch('/api/surveys/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: toEmail, link, surveyName, expiresAt }),
    })
    setSending(false)
    setSent(true)
    setTimeout(() => { setSent(false); setEmailOpen(false) }, 2000)
  }

  return (
    <>
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* WhatsApp */}
        <a
          href={`https://wa.me/?text=${whatsappText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 no-underline"
        >
          💬 WhatsApp
        </a>

        {/* E-mail */}
        <button
          type="button"
          onClick={() => setEmailOpen(true)}
          className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
        >
          ✉️ E-mail
        </button>
      </div>

      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1B556B]">Enviar pesquisa por e-mail</h3>
              <button onClick={() => setEmailOpen(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <p className="text-xs text-gray-500 break-all bg-gray-50 rounded px-2 py-1">{link}</p>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Destinatário *</label>
              <input
                type="email"
                value={toEmail}
                onChange={e => setToEmail(e.target.value)}
                placeholder="email@cliente.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none"
              />
            </div>
            {sent && <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">✓ E-mail enviado!</p>}
            <div className="flex gap-2">
              <button
                onClick={handleSendEmail}
                disabled={sending || !toEmail}
                className="flex-1 rounded-lg bg-[#1B556B] py-2 text-sm font-semibold text-white hover:bg-[#164659] disabled:opacity-50"
              >
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
              <button onClick={() => setEmailOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
