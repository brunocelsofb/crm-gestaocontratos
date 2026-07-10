'use client'

import { useActionState } from 'react'
import { transferContract, type ActionState } from '@/lib/actions/workflow'
import { DEPARTMENTS, departmentLabel } from '@/lib/constants/departments'

const initialState: ActionState = {}

export function DepartmentSection({
  contractId,
  currentDepartment,
}: {
  contractId: string
  currentDepartment: string | null
}) {
  const action = transferContract.bind(null, contractId)
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">Departamento responsável agora</p>
          <p className="text-base font-semibold text-gray-900">{departmentLabel(currentDepartment)}</p>
        </div>
      </div>

      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
        <div>
          <label className="block text-[10px] text-gray-500">Transferir para</label>
          <select
            name="department"
            required
            className="mt-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
          >
            <option value="">Selecione...</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
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
    </div>
  )
}
