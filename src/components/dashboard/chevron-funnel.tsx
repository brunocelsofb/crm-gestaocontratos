type FunnelStage = {
  id: string
  name: string
  isWon: boolean
  count: number
  color: string
}

// Formato de seta/chevron: cada etapa intermediária termina em ponta,
// "encaixando" na próxima — mas a primeira não tem entalhe à esquerda,
// a última não tem ponta à direita, e uma etapa sozinha é só um retângulo.
const FIRST_OF_MANY = 'polygon(0 0, 88% 0, 100% 50%, 88% 100%, 0 100%)'
const MIDDLE = 'polygon(0 0, 88% 0, 100% 50%, 88% 100%, 0 100%, 10% 50%)'
const LAST_OF_MANY = 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 10% 50%)'

export function ChevronFunnel({ stages }: { stages: FunnelStage[] }) {
  if (stages.length === 0) {
    return <p className="text-xs text-foreground/40">Nenhuma etapa cadastrada para este pipeline.</p>
  }

  return (
    <div className="flex">
      {stages.map((stage, i) => {
        const isOnly = stages.length === 1
        const isFirst = i === 0
        const isLast = i === stages.length - 1

        let clipPath: string | undefined
        if (isOnly) clipPath = undefined
        else if (isFirst) clipPath = FIRST_OF_MANY
        else if (isLast) clipPath = LAST_OF_MANY
        else clipPath = MIDDLE

        return (
          <div
            key={stage.id}
            className={`flex-1 rounded-md py-2.5 text-center text-[11px] text-white ${!isFirst && !isOnly ? '-ml-2.5 pl-4' : ''}`}
            style={{ backgroundColor: stage.color, clipPath }}
          >
            <div className="px-1">{stage.name}</div>
            <div className="mt-0.5 text-[10px] text-white/70 tabular-nums">{stage.count}</div>
          </div>
        )
      })}
    </div>
  )
}
