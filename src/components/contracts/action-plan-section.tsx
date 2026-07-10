'use client'

import { useActionState, useRef, useEffect } from 'react'
import { createActionPlanItem, updateActionPlanItemStatus, deleteActionPlanItem, type ActionState } from '@/lib/actions/workflow'
import { DEPARTMENTS, departmentLabel } from '@/lib/constants/departments'

const initialState: ActionState = {}

type ActionItem = {
  id: string
  description: string
  responsible_department: string | null
  status: string
  created_at: string
  resolved_at: string | null
}

const STATUS_LABELS: Record<string, string> = { pending: 'Pendente', in_progress: 'Em andamento', done: 'Concluído' }
const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-yellow-100 text-yellow-800',
  done: 'bg-positive-100 text-positive-700',
}

export function ActionPlanSection({ contractId, items }: { contractId: string; items: ActionItem[] }) {
  const action = createActionPlanItem.bind(null, contractId)
  const [state, formAction, pending] = useActionState(action, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset()
  }, [pending, state])

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-gray-900">Plano de Ação</h2>

      <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-gray-300 bg-white p-3">
        <div className="min-w-[220px] flex-1">
          <label className="block text-[10px] text-gray-500">O que precisa ser feito</label>
          <input
            name="description"
            required
            placeholder="Ex: Confirmar disponibilidade de peça com o fornecedor"
            className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500">Responsável</label>
          <select
            name="responsible_department"
            className="mt-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
          >
            <option value="">Não definido</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
        >
          + Adicionar
        </button>
      </form>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm">
            <div className="flex-1">
              <p className={item.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}>{item.description}</p>
              <p className="mt-0.5 text-xs text-gray-400">
                {departmentLabel(item.responsible_department)} · {new Date(item.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <select
              defaultValue={item.status}
              onChange={(e) => updateActionPlanItemStatus(item.id, contractId, e.target.value)}
              className={`rounded-full border-0 px-2 py-1 text-xs font-medium focus:outline-none ${STATUS_STYLES[item.status]}`}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button
              onClick={() => deleteActionPlanItem(item.id, contractId)}
              className="text-xs text-gray-300 hover:text-negative-600"
              title="Remover"
            >
              ×
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-400">Nenhum item no plano de ação ainda.</p>}
      </div>
    </div>
  )
}
