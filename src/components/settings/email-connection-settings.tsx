'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { disconnectEmailAccount } from '@/lib/actions/email'

export function EmailConnectionSettings({
  connectedEmail,
  connectedAt,
}: {
  connectedEmail: string | null
  connectedAt: string | null
}) {
  const searchParams = useSearchParams()
  const justConnected = searchParams.get('email_connected') === '1'
  const oauthError = searchParams.get('email_error')
  const [busy, setBusy] = useState(false)

  async function handleDisconnect() {
    if (!confirm('Desconectar seu Gmail? Você não vai conseguir enviar e-mails pelo CRM até conectar de novo.')) return
    setBusy(true)
    await disconnectEmailAccount()
    setBusy(false)
    window.location.reload()
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
      <div>
        <h3 className="text-sm font-medium text-gray-900">📧 E-mail (Gmail)</h3>
        <p className="mt-0.5 text-xs text-gray-400">
          Conecte seu Gmail pra enviar e-mails direto do CRM — o envio sai da SUA caixa de verdade, fica salvo nos seus Enviados também.
        </p>
      </div>

      {justConnected && <p className="rounded-md bg-positive-100 px-3 py-2 text-sm text-positive-700">✅ Gmail conectado com sucesso!</p>}
      {oauthError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Falha ao conectar: {oauthError}</p>}

      {connectedEmail ? (
        <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
          <div>
            <p className="text-sm font-medium text-gray-900">{connectedEmail}</p>
            <p className="text-xs text-gray-400">Conectado {connectedAt ? `em ${new Date(connectedAt).toLocaleDateString('pt-BR')}` : ''}</p>
          </div>
          <button onClick={handleDisconnect} disabled={busy} className="text-xs text-negative-600 hover:underline disabled:opacity-50">
            {busy ? 'Desconectando...' : 'Desconectar'}
          </button>
        </div>
      ) : (
        <a
          href="/api/auth/google/connect"
          className="inline-block rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          Conectar meu Gmail
        </a>
      )}
    </div>
  )
}
