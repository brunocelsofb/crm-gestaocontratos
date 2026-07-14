'use client'

import { useState } from 'react'
import { submitClientDecision } from '@/lib/actions/proposals'
import { isValidCPF, formatCPF } from '@/lib/utils/cpf'

export function ClientDecisionPanel({ token }: { token: string }) {
  const [mode, setMode] = useState<'idle' | 'approve' | 'decline'>('idle')
  const [comment, setComment] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [phone, setPhone] = useState('')
  const [cpf, setCpf] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<'approved' | 'declined' | null>(null)

  const cpfDigits = cpf.replace(/\D/g, '')
  const cpfTouched = cpfDigits.length > 0
  const cpfOk = isValidCPF(cpf)

  async function handleDecline() {
    if (!comment.trim()) {
      setError('Descreva o motivo do declínio.')
      return
    }
    setError(null)
    setBusy(true)
    const result = await submitClientDecision(token, 'declined', comment)
    setBusy(false)
    if (result.error) setError(result.error)
    else setDone('declined')
  }

  async function handleApprove() {
    if (!comment.trim()) {
      setError('O comentário é obrigatório.')
      return
    }
    if (!name || !email || !role || !phone || !cpf) {
      setError('Preencha todos os dados do assinante.')
      return
    }
    if (!cpfOk) {
      setError('CPF inválido. Confira o número informado.')
      return
    }
    setError(null)
    setBusy(true)
    const result = await submitClientDecision(token, 'approved', comment, { name, email, role, phone, cpf: cpfDigits })
    setBusy(false)
    if (result.error) setError(result.error)
    else setDone('approved')
  }

  if (done) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-lg font-medium text-gray-900">
          {done === 'approved' ? '✅ Proposta aprovada!' : 'Proposta declinada.'}
        </p>
        <p className="mt-1 text-sm text-gray-500">Obrigado pela resposta — já registramos aqui.</p>
      </div>
    )
  }

  if (mode === 'idle') {
    return (
      <div className="flex justify-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <button
          onClick={() => setMode('approve')}
          className="rounded-md bg-positive-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-positive-700"
        >
          Aprovar
        </button>
        <button
          onClick={() => setMode('decline')}
          className="rounded-md bg-negative-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-negative-700"
        >
          Declinar
        </button>
      </div>
    )
  }

  if (mode === 'decline') {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <label className="block text-sm font-medium text-gray-700">Motivo do declínio</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        <div className="mt-2 flex gap-2">
          <button onClick={handleDecline} disabled={busy} className="rounded-md bg-negative-600 px-4 py-2 text-sm font-medium text-white hover:bg-negative-700 disabled:opacity-50">
            {busy ? 'Enviando...' : 'Confirmar declínio'}
          </button>
          <button onClick={() => setMode('idle')} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Voltar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm font-medium text-gray-900">Dados de quem está aprovando</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500">Nome completo</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Cargo</label>
          <input value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500">E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Telefone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-500">CPF</label>
          <input
            value={cpf}
            onChange={(e) => setCpf(formatCPF(e.target.value))}
            placeholder="000.000.000-00"
            maxLength={14}
            className={`mt-1 w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none ${
              cpfTouched && !cpfOk ? 'border-red-400' : 'border-gray-300 focus:border-brand-700'
            }`}
          />
          {cpfTouched && !cpfOk && <p className="mt-0.5 text-xs text-red-600">CPF inválido.</p>}
        </div>
      </div>

      <label className="mt-3 block text-sm font-medium text-gray-700">Comentário</label>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
      />

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      <div className="mt-2 flex gap-2">
        <button
          onClick={handleApprove}
          disabled={busy || (cpfTouched && !cpfOk)}
          className="rounded-md bg-positive-600 px-4 py-2 text-sm font-medium text-white hover:bg-positive-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Enviando...' : 'Confirmar aprovação'}
        </button>
        <button onClick={() => setMode('idle')} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Voltar
        </button>
      </div>
    </div>
  )
}
