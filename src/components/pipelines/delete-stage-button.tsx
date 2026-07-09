'use client'

import { useActionState } from 'react'
import { deleteStage, type DeleteStageState } from '@/lib/actions/pipelines'

const initialState: DeleteStageState = {}

export function DeleteStageButton({ stageId, stageName }: { stageId: string; stageName: string }) {
  const deleteWithId = deleteStage.bind(null, stageId)
  const [state, formAction, pending] = useActionState(deleteWithId, initialState)

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Remover a etapa "${stageName}"?`)) e.preventDefault()
      }}
    >
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-gray-400 hover:text-negative-600 disabled:opacity-50"
      >
        {pending ? 'Removendo...' : 'Remover'}
      </button>
      {state.error && <p className="mt-1 max-w-[160px] text-[10px] text-red-600">{state.error}</p>}
    </form>
  )
}
