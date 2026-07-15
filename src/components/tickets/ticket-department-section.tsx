'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { transferTicket, returnTicket } from '@/lib/actions/tickets'
import { DEPARTMENTS, departmentLabel } from '@/lib/constants/departments'

export function TicketDepartmentSection({
  ticketId,
  currentDepartment,
  hasPrevious,
}: {
  ticketId: string
  currentDepartment: string | null
  hasPrevious: boolean
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'transfer' | 'return'>('idle')
  const [selectedDept, setSelectedDept] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetForm() {
    setMode('idle')
    setSelectedDept('')
    setNote('')
    setError(null)
  }

  async function handleTransfer() {
    if (!selectedDept) {
      setError('Escolha a área responsável pela apuração.')
      return
    }
    setBusy(true)
    setError(null)
    const result = await transferTicket(ticketId, selectedDept, note)
    setBusy(false)
    if (result.error) setError(result.error)
    else {
      resetForm()
      router.refresh()
    }
  }

  async function handleReturn() {
    setBusy(true)
    setError(null)
    const result = await returnTicket(ticketId, note)
    setBusy(false)
    if (result.error) setError(result.error)
    else {
      resetForm()
      router.refresh()
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">Área apurando agora</p>
          <p className="text-sm font-medium text-gray-900">{currentDepartment ? departmentLabel(currentDepartment) : 'Nenhuma (não está em apuração)'}</p>
        </div>
        {mode === 'idle' && (
          <div className="flex gap-2">
            {hasPrevious && (
              <button onClick={() => setMode('return')} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800">
                Devolver (apuração concluída)
              </button>
            )}
            <button onClick={() => setMode('transfer')} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Transferir pra apuração
            </button>
          </div>
        )}
      </div>

      {mode === 'transfer' && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          <label className="block text-xs font-medium text-gray-600">Transferir pra qual área?</label>
          <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
            <option value="">Selecione...</option>
            {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <label className="block text-xs font-medium text-gray-600">O que precisa ser apurado?</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
          <div className="flex gap-2">
            <button onClick={handleTransfer} disabled={busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
              {busy ? 'Transferindo...' : 'Confirmar transferência'}
            </button>
            <button onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
          </div>
        </div>
      )}

      {mode === 'return' && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          <label className="block text-xs font-medium text-gray-600">O que foi apurado?</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
          <div className="flex gap-2">
            <button onClick={handleReturn} disabled={busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
              {busy ? 'Devolvendo...' : 'Confirmar devolução'}
            </button>
            <button onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
