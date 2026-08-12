'use client'

import { useState } from 'react'
import { updateRunValue } from '@/lib/actions/pipeline'

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function RenewalValueSection({ contractId, currentValue, canEdit, canCreateProposal }: {
  contractId: string
  currentValue: number
  canEdit: boolean
  canCreateProposal?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [newValue, setNewValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const parsed = Number(newValue.replace(',', '.'))
    if (!newValue || Number.isNaN(parsed)) { setError('Informe o novo valor.'); return }
    setError(null)
    setBusy(true)
    const result = await updateRunValue(contractId, parsed)
    setBusy(false)
    if (result.error) setError(result.error)
    else { setEditing(false); setNewValue('') }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">Valor do contrato (esta passagem)</p>
          <p className="text-lg font-semibold text-gray-900">{fmt(currentValue)}</p>
        </div>

        {/* Botões — sempre visíveis, permissões granulares por ação */}
        {!editing && (
          <div className="flex gap-2 flex-wrap justify-end">
            {/* Reajuste direto: apenas owner/admin */}
            {canEdit ? (
              <button
                onClick={() => setEditing(true)}
                className="rounded-md border border-brand-700 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 whitespace-nowrap"
              >
                Reajuste monetário
              </button>
            ) : (
              <span className="text-[11px] text-gray-400 self-center">Reajuste: apenas owner/admin</span>
            )}

            {/* Gerar proposta de aditivo: sempre visível para a equipe comercial */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                window.location.href = `/contracts/${contractId}?tab=proposta`
              }}
              className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 whitespace-nowrap cursor-pointer border-0"
            >
              + Gerar proposta de aditivo
            </button>
          </div>
        )}
      </div>

      {editing && (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500">
            Reajustes geralmente seguem o IPCA.{' '}
            <a href="https://www.ibge.gov.br/explica/inflacao.php" target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
              Consultar índice no IBGE ↗
            </a>
          </p>
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-[10px] text-gray-500">Novo valor (R$)</label>
              <input
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                placeholder="0,00"
                autoFocus
                className="mt-1 w-40 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
              />
            </div>
            <button onClick={handleSave} disabled={busy}
              className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
              {busy ? 'Salvando...' : 'Salvar novo valor'}
            </button>
            <button onClick={() => { setEditing(false); setError(null) }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
