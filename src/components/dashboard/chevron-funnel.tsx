type FunnelStage = {
  id: string
  name: string
  isWon: boolean
  count: number
  color: string
}

// Formato de seta/chevron: cada etapa é um trapézio que "encaixa" na
// próxima, como uma barra de progresso contínua.
const CHEVRON = 'polygon(0 0, 88% 0, 100% 50%, 88% 100%, 0 100%, 10% 50%)'
const CHEVRON_FIRST = 'polygon(0 0, 88% 0, 100% 50%, 88% 100%, 0 100%)'

export function ChevronFunnel({ stages }: { stages: FunnelStage[] }) {
  if (stages.length === 0) {
    return <p className="text-xs text-foreground/40">Nenhuma etapa cadastrada para este pipeline.</p>
  }

  return (
    <div className="flex">
      {stages.map((stage, i) => (
        <div
          key={stage.id}
          className={`flex-1 py-2.5 text-center text-[11px] text-white ${i > 0 ? '-ml-2.5 pl-4' : ''}`}
          style={{
            backgroundColor: stage.color,
            clipPath: i === 0 ? CHEVRON_FIRST : CHEVRON,
          }}
        >
          <div className="px-1">{stage.name}</div>
          <div className="mt-0.5 text-[10px] text-white/70 tabular-nums">{stage.count}</div>
        </div>
      ))}
    </div>
  )
}
