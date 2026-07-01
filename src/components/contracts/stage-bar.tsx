'use client'

import { useState, useTransition } from 'react'
import { moveContractStage } from '@/lib/actions/pipeline'

type Stage = {
  id: string
  name: string
  order_index: number
  is_won: boolean
  is_lost: boolean
  sla_days: number | null
}

type StageTiming = {
  stageId: string
  days: number | null   // null = etapa ainda não visitada
  isOverdue: boolean
}

export function StageBar({
  contractId,
  stages,
  currentStageId,
  timings,
  status,
}: {
  contractId: string
  stages: Stage[]
  currentStageId: string
  timings: StageTiming[]
  status: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const currentIndex = stages.findIndex((s) => s.id === currentStageId)
  const wonStage = stages.find((s) => s.is_won)
  const lostStage = stages.find((s) => s.is_lost)

  function timingFor(stageId: string) {
    return timings.find((t) => t.stageId === stageId)
  }

  function handleMove(stageId: string) {
    setError(null)
    startTransition(async () => {
      const result = await moveContractStage(contractId, stageId)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto">
        {stages.map((stage, i) => {
          const timing = timingFor(stage.id)
          const isCurrent = stage.id === currentStageId
          const isPast = i < currentIndex
          const isFuture = i > currentIndex

          let bg = 'bg-gray-200 text-gray-500'
          if (isPast) bg = 'bg-blue-500 text-white'
          if (isCurrent) bg = stage.is_lost ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'

          return (
            <button
              key={stage.id}
              disabled={isPending || isCurrent}
              onClick={() => handleMove(stage.id)}
              title={`Mover para "${stage.name}"`}
              className={`flex min-w-[130px] flex-1 flex-col items-center justify-center gap-1 px-3 py-2 text-xs font-medium disabled:cursor-not-allowed ${bg} ${isFuture ? 'opacity-70' : 'hover:opacity-90'}`}
            >
              <span className="text-center leading-tight">{stage.name}</span>
              {timing?.days !== null && timing?.days !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    timing.isOverdue ? 'bg-red-700/80' : 'bg-black/15'
                  }`}
                >
                  {timing.days === 0 ? 'Menos de 1 dia' : `${timing.days} dias`}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Etapa atual: <span className="font-medium text-gray-900">{stages[currentIndex]?.name}</span>
        </p>
        {status === 'open' && (
          <div className="flex gap-2">
            {wonStage && (
              <button
                onClick={() => handleMove(wonStage.id)}
                disabled={isPending}
                className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                Ganho
              </button>
            )}
            {lostStage && (
              <button
                onClick={() => handleMove(lostStage.id)}
                disabled={isPending}
                className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                Perdido
              </button>
            )}
          </div>
        )}
        {status !== 'open' && (
          <span className={`text-sm font-medium ${status === 'won' ? 'text-emerald-600' : 'text-red-600'}`}>
            {status === 'won' ? 'Ganho' : 'Perdido'}
          </span>
        )}
      </div>
    </div>
  )
}
