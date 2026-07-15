'use client'

import { useState } from 'react'
import { updateInboundEmailSettings } from '@/lib/actions/settings'

export function InboundEmailSettingsForm({
  currentDomain,
  hasSigningKey,
}: {
  currentDomain: string
  hasSigningKey: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(formData: FormData) {
    setBusy(true)
    setSaved(false)
    setError(null)
    const result = await updateInboundEmailSettings(formData)
    setBusy(false)
    if (result.error) setError(result.error)
    else setSaved(true)
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-6">
      <div>
        <h3 className="text-sm font-medium text-gray-900">📥 Recebimento de e-mail (lastro de resposta)</h3>
        <p className="mt-0.5 text-xs text-gray-400">
          Cada contrato ganha um endereço de e-mail exclusivo (tipo <code>abc123@{currentDomain || 'mail.seudominio.com.br'}</code>) — coloque em cópia oculta pra qualquer e-mail daquela oportunidade ficar registrado no CRM, mesmo se enviado por fora. Exige um domínio próprio configurado num provedor de recebimento (Mailgun, por enquanto).
        </p>
      </div>
      <form action={handleSave} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600">Domínio de recebimento</label>
          <input
            name="inbound_email_domain"
            defaultValue={currentDomain}
            placeholder="mail.seudominio.com.br"
            className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Chave de assinatura do Mailgun (opcional, mas recomendado)</label>
          <input
            name="mailgun_webhook_signing_key"
            type="password"
            placeholder={hasSigningKey ? '••••••••••••••••' : 'Cole a HTTP webhook signing key do Mailgun'}
            className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
          />
          <p className="mt-0.5 text-xs text-gray-400">Sem isso, o sistema aceita qualquer e-mail de entrada sem confirmar que veio do Mailgun de verdade.</p>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
          {busy ? 'Salvando...' : 'Salvar'}
        </button>
        {saved && <span className="ml-2 text-xs text-positive-700">Salvo!</span>}
      </form>
    </div>
  )
}
