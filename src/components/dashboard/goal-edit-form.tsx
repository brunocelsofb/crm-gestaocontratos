'use client'

import { useState, useActionState } from 'react'
import { setMonthlyGoal, type ActionState } from '@/lib/actions/billing'

const initialState: ActionState = {}

export function GoalEditForm({ year, month, currentTarget }: { year: number; month: number; currentTarget: number }) {
  const [editing, setEditing] = useState(false)
  const [state, formAction, pending] = useActionState(setMonthlyGoal, initialState)

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-xs text-brand-700 hover:underline">
        Editar meta
      </button>
    )
  }

  return (
    <form
      action={async (formData) => {
        await formAction(formData)
        setEditing(false)
      }}
      className="flex items-center gap-1.5"
    >
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      <input
        name="target_value"
        type="number"
        step="0.01"
        defaultValue={currentTarget || ''}
        placeholder="0,00"
        autoFocus
        className="w-28 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-brand-700 focus:outline-none"
      />
      <button type="submit" disabled={pending} className="rounded-md bg-brand-700 px-2 py-1 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50">
        {pending ? '...' : 'Salvar'}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">
        Cancelar
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  )
}
