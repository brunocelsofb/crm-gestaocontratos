'use client'

import { useState, useActionState, useTransition } from 'react'
import { transferContract, returnContract, type ActionState } from '@/lib/actions/workflow'
import { DEPARTMENTS, departmentLabel } from '@/lib/constants/departments'

const initialState: ActionState = {}

type UserOption = { id: string; full_name: string; department: string | null }
type TransferLog = { id: string; content: string; created_at: string; user_name: string | null }

export function DepartmentSection({
  contractId,
  currentDepartment,
  currentAssigneeName,
  hasPrevious,
  users,
  transfers,
}: {
  contractId: string
  currentDepartment: string | null
  currentAssigneeName: string | null
  hasPrevious: boolean
  users: UserOption[]
  transfers: TransferLog[]
}) {
  const action = transferContract.bind(null, contractId)
  const [state, formAction, pending] = useActionState(action, initialState)
  const [selectedDept, setSelectedDept] = useState('')
  const [isReturning, startReturnTransition] = useTransition()
  const [returnError, setReturnError] = useState<string | null>(null)

  const peopleInDept = users.filter((u) => u.department === selectedDept)
  const [showReturnNote, setShowReturnNote] = useState(false)
  const [returnNote, setReturnNote] = useState('')

  function handleReturn() {
    setReturnError(null)
    startReturnTransition(async () => {
      const result = await returnContract(contractId, returnNote)
      if (result.error) {
        setReturnError(result.error)
      } else {
        setShowReturnNote(false)
        setReturnNote('')
      }
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">Responsável agora</p>
          <p className="text-base font-semibold text-gray-900">
            {departmentLabel(currentDepartment)}
            {currentAssigneeName && <span className="font-normal text-gray-500"> — {currentAssigneeName}</span>}
          </p>
        </div>
        {hasPrevious && !showReturnNote && (
          <button
            onClick={() => setShowReturnNote(true)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ↩ Devolver
          </button>
        )}
      </div>

      {showReturnNote && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          <label className="block text-[10px] text-gray-500">O que foi tratado? (aparece registrado no histórico)</label>
          <textarea
            value={returnNote}
            onChange={(e) => setReturnNote(e.target.value)}
            rows={2}
            placeholder="Ex: Dimensionamento validado, sem restrições técnicas."
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReturn}
              disabled={isReturning}
              className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
            >
              {isReturning ? 'Devolvendo...' : 'Confirmar devolução'}
            </button>
            <button
              onClick={() => setShowReturnNote(false)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {returnError && <p className="mt-1 text-xs text-red-600">{returnError}</p>}

      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
        <div>
          <label className="block text-[10px] text-gray-500">Transferir para (departamento)</label>
          <select
            name="department"
            required
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
          >
            <option value="">Selecione...</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500">Pessoa (opcional)</label>
          <select
            name="assignee_id"
            defaultValue=""
            disabled={!selectedDept}
            className="mt-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none disabled:bg-gray-100"
          >
            <option value="">Qualquer pessoa do time</option>
            {peopleInDept.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="block text-[10px] text-gray-500">Nota (opcional)</label>
          <input
            name="note"
            placeholder="Ex: Cliente reclamou de atraso na entrega"
            className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {pending ? 'Transferindo...' : 'Transferir'}
        </button>
      </form>
      {state.error && <p className="mt-2 text-xs text-red-600">{state.error}</p>}

      {transfers.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
          <p className="text-[10px] font-medium uppercase text-gray-400">Histórico de transferências</p>
          {transfers.map((t) => (
            <p key={t.id} className="text-xs text-gray-500">
              <span className="text-gray-400">{new Date(t.created_at).toLocaleDateString('pt-BR')} — </span>
              {t.content}
              {t.user_name && <span className="text-gray-400"> (por {t.user_name})</span>}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
