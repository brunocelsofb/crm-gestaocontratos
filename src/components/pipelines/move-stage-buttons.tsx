'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { moveStage } from '@/lib/actions/pipelines'

export function MoveStageButtons({
  stageId,
  disableUp,
  disableDown,
}: {
  stageId: string
  disableUp: boolean
  disableDown: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleMove(direction: 'up' | 'down') {
    setError(null)
    startTransition(async () => {
      const result = await moveStage(stageId, direction)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="relative flex flex-col gap-0.5">
      <button
        type="button"
        disabled={disableUp || isPending}
        onClick={() => handleMove('up')}
        className="block text-[10px] text-gray-400 hover:text-gray-700 disabled:opacity-20"
      >
        ▲
      </button>
      <button
        type="button"
        disabled={disableDown || isPending}
        onClick={() => handleMove('down')}
        className="block text-[10px] text-gray-400 hover:text-gray-700 disabled:opacity-20"
      >
        ▼
      </button>
      {error && (
        <p className="absolute left-4 top-0 z-10 w-40 rounded-md bg-red-50 p-1.5 text-[10px] text-red-600 shadow">
          {error}
        </p>
      )}
    </div>
  )
}
