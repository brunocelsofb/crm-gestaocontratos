'use client'

import { useTransition } from 'react'
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

  function handleMove(direction: 'up' | 'down') {
    startTransition(async () => {
      await moveStage(stageId, direction)
      // revalidatePath (chamado dentro de moveStage) às vezes não é
      // suficiente sozinho pra atualizar a tela na hora — forçando
      // router.refresh() aqui garante que a nova ordem apareça sem
      // precisar sair e voltar na página.
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-0.5">
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
    </div>
  )
}
