'use client'

import { useState, useTransition } from 'react'
import { moveContractStage, reopenRun, closeRun } from '@/lib/actions/pipeline'

type Stage = {
  id: string
  name: string
  order_index: number
  is_won: boolean
  is_lost: boolean
  sla_days: number | null
  color: string | null
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
  wonLabel,
  lostLabel,
}: {
  contractId: string
  stages: Stage[]
  currentStageId: string
  timings: StageTiming[]
  status: string
  wonLabel: string
  lostLabel: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const currentIndex = stages.findIndex((s) => s.id === currentStageId)
  const currentStage = stages[currentIndex]
  const canMarkWon = currentStage?.is_won === true
  const canMarkLost = currentStage?.is_lost === true

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

  function handleReopen() {
    setError(null)
    startTransition(async () => {
      const result = await reopenRun(contractId)
      if (result.error) setError(result.error)
    })
  }

  function handleClose(outcome: 'won' | 'lost') {
    setError(null)
    startTransition(async () => {
      const result = await closeRun(contractId, outcome)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div className="space-y-3">
      {/* Etapa do processo — livre para mover pra frente ou pra trás,
          independente do desfecho (Renovado/Não renovado) */}
      <div className="flex gap-1 overflow-x-auto">
        {stages.map((stage, i) => {
          const timing = timingFor(stage.id)
          const isCurrent = stage.id === currentStageId
          const isFuture = i > currentIndex
          const color = stage.color ?? '#1B556B'

          return (
            <button
              key={stage.id}
              disabled={isPending || isCurrent || status !== 'open'}
              onClick={() => handleMove(stage.id)}
              title={status !== 'open' ? 'Este contrato já está encerrado' : `Mover para "${stage.name}"`}
              style={{ backgroundColor: color }}
              className="flex min-w-[130px] flex-1 flex-col items-center justify-center gap-1 rounded-sm px-3 py-2 text-xs font-medium text-white opacity-90 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-90"
            >
              <span className="text-center leading-tight">{stage.name}</span>
              {timing?.days !== null && timing?.days !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    timing.isOverdue ? 'bg-negative-700/80' : 'bg-black/15'
                  }`}
                >
                  {timing.days === 0 ? 'Menos de 1 dia' : `${timing.days} dias`}
                </span>
              )}
              {isFuture && <span className="text-[9px] text-white/70">ainda não visitada</span>}
            </button>
          )
        })}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Desfecho — SEMPRE disponível, independente da etapa atual do
          processo. É a mudança que separa "onde o contrato está" de
          "qual foi o resultado final". */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Etapa atual: <span className="font-medium text-gray-900">{stages[currentIndex]?.name ?? '—'}</span>
        </p>
        {status === 'open' && (
          <div className="flex gap-2">
            <button
              onClick={() => handleClose('won')}
              disabled={isPending || !canMarkWon}
              title={canMarkWon ? undefined : `Só é possível marcar "${wonLabel}" quando o contrato está numa etapa habilitada para isso`}
              className="rounded-md bg-positive-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-positive-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {wonLabel}
            </button>
            <button
              onClick={() => handleClose('lost')}
              disabled={isPending || !canMarkLost}
              title={canMarkLost ? undefined : `Só é possível marcar "${lostLabel}" quando o contrato está numa etapa habilitada para isso`}
              className="rounded-md bg-negative-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-negative-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {lostLabel}
            </button>
          </div>
        )}
        {status !== 'open' && (
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${status === 'won' ? 'text-positive-700' : 'text-negative-700'}`}>
              {status === 'won' ? wonLabel : lostLabel}
            </span>
            <button
              onClick={handleReopen}
              disabled={isPending}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {isPending ? 'Reabrindo...' : 'Reabrir'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
