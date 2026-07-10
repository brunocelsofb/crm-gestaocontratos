'use client'

// NOTA DE INCERTEZA: a API abaixo (DndContext, useDraggable, useDroppable,
// PointerSensor) é a que eu conheço do @dnd-kit/core, mas não tenho certeza
// absoluta de que os nomes/assinaturas não mudaram nas versões mais recentes.
// Teste esta parte com atenção redobrada — se algo não bater, confira a
// documentação em dndkit.com.
//
// SIMPLIFICAÇÃO CONHECIDA: não uso <DragOverlay>, então o card arrastado se
// move dentro do próprio fluxo do documento em vez de "flutuar" livremente
// sobre as colunas. Funciona, mas uma versão mais polida usaria DragOverlay
// para um efeito visual mais suave — deixei de fora agora para reduzir a
// superfície de código incerto nesta primeira versão.

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  type DragEndEvent,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { moveContractStage } from '@/lib/actions/pipeline'
import { ValidityBadge } from '@/components/contracts/validity-badge'

export type RunCard = {
  runId: string
  contractId: string
  companyId: string | null
  stageId: string
  status: 'open' | 'won' | 'lost'
  processNumber: string
  clientName: string
  title: string
  value: number
  stageEnteredAt: string
  validUntil: string | null
  freshness: 'fresh' | 'warning' | 'stale'
  tag: { id: string; name: string; color: string } | null
}

type Stage = {
  id: string
  name: string
  order_index: number
  sla_days: number | null
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function fmt(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

const FRESHNESS_STYLES = {
  fresh: 'bg-white border-gray-200',
  warning: 'bg-yellow-50 border-yellow-200 border-l-2 border-l-yellow-400',
  stale: 'bg-negative-100 border-negative-600/30 border-l-2 border-l-negative-600',
} as const

function Card({ card, sla, showValidity, wonLabel, lostLabel }: { card: RunCard; sla: number | null; showValidity: boolean; wonLabel: string; lostLabel: string }) {
  const router = useRouter()
  const isClosed = card.status !== 'open'
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.runId,
    data: card,
    disabled: isClosed,
  })
  const days = daysSince(card.stageEnteredAt)
  const overdue = sla !== null && days > sla

  function openAccount(e: React.MouseEvent) {
    e.stopPropagation()
    router.push(card.companyId ? `/companies/${card.companyId}` : `/contracts/${card.contractId}`)
  }

  function openOpportunity() {
    router.push(`/contracts/${card.contractId}`)
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={openOpportunity}
      title={
        card.freshness === 'stale'
          ? 'Sem interação há um bom tempo — precisa de atenção'
          : card.freshness === 'warning'
            ? 'Começando a esfriar — considere um follow-up'
            : 'Interação recente'
      }
      className={`mb-3 rounded-lg border p-3 text-sm shadow-sm ${FRESHNESS_STYLES[isClosed ? 'fresh' : card.freshness]} ${
        isClosed ? 'cursor-default opacity-80' : 'cursor-grab active:cursor-grabbing'
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={openAccount}
          onPointerDown={(e) => e.stopPropagation()}
          title={card.companyId ? 'Abrir empresa' : 'Abrir contrato (sem empresa vinculada ainda)'}
          className="text-left text-sm font-semibold leading-snug text-gray-900 hover:text-brand-700 hover:underline"
        >
          {card.clientName}
        </button>
        {card.status === 'won' && <span className="shrink-0 rounded-full bg-positive-100 px-2 py-0.5 text-xs font-medium text-positive-700">{wonLabel}</span>}
        {card.status === 'lost' && <span className="shrink-0 rounded-full bg-negative-100 px-2 py-0.5 text-xs font-medium text-negative-700">{lostLabel}</span>}
      </div>

      {card.tag && (
        <span
          className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: card.tag.color }}
        >
          {card.tag.name}
        </span>
      )}

      <p className="mt-1.5 font-mono text-xs text-gray-400">{card.processNumber}</p>

      {showValidity && card.validUntil && (
        <div className="mt-1.5">
          <ValidityBadge validUntil={card.validUntil} />
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between border-t border-black/5 pt-2.5">
        <span className="text-sm font-medium text-gray-700">{fmt(card.value)}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${overdue ? 'bg-negative-100 text-negative-700' : 'bg-gray-100 text-gray-500'}`}>
          {days === 0 ? '< 1 dia' : `${days} dias`}
        </span>
      </div>
    </div>
  )
}

function Column({ stage, cards, showValidity, wonLabel, lostLabel }: { stage: Stage; cards: RunCard[]; showValidity: boolean; wonLabel: string; lostLabel: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const total = cards.reduce((sum, c) => sum + c.value, 0)

  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 rounded-lg p-3 transition-colors ${isOver ? 'bg-blue-50' : 'bg-gray-100'}`}
    >
      <p className="px-1 text-sm font-semibold text-gray-700">{stage.name}</p>
      <p className="px-1 pb-3 text-xs text-gray-400">
        {cards.length} · {fmt(total)}
      </p>
      {cards.map((c) => (
        <Card key={c.runId} card={c} sla={stage.sla_days} showValidity={showValidity} wonLabel={wonLabel} lostLabel={lostLabel} />
      ))}
      {cards.length === 0 && (
        <p className="py-8 text-center text-xs text-gray-400">Vazio</p>
      )}
    </div>
  )
}

export function KanbanBoard({
  stages,
  initialCards,
  showValidity,
  wonLabel,
  lostLabel,
}: {
  stages: Stage[]
  initialCards: RunCard[]
  showValidity: boolean
  wonLabel: string
  lostLabel: string
}) {
  const [cards, setCards] = useState(initialCards)

  // CORREÇÃO: sem isso, o botão "Atualizar" (router.refresh()) buscaria
  // dados novos do servidor, mas o estado local dos cards continuaria
  // com a versão antiga — useState só usa o valor inicial na primeira
  // renderização, não sincroniza sozinho quando a prop muda depois.
  useEffect(() => {
    setCards(initialCards)
  }, [initialCards])
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showClosed, setShowClosed] = useState(false)

  const closedCount = cards.filter((c) => c.status !== 'open').length
  const visibleCards = showClosed ? cards : cards.filter((c) => c.status === 'open')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return

    const newStageId = String(over.id)
    const card = active.data.current as RunCard | undefined
    if (!card || card.stageId === newStageId || card.status !== 'open') return

    const previousStageId = card.stageId

    // Atualização otimista: move o card na tela imediatamente, sem
    // esperar a resposta do servidor — sensação mais rápida de uso.
    setCards((prev) =>
      prev.map((c) =>
        c.runId === card.runId ? { ...c, stageId: newStageId, stageEnteredAt: new Date().toISOString() } : c
      )
    )
    setError(null)

    startTransition(async () => {
      const result = await moveContractStage(card.contractId, newStageId)
      if (result.error) {
        setError(result.error)
        // Reverte a posição do card se a Server Action falhar
        setCards((prev) =>
          prev.map((c) => (c.runId === card.runId ? { ...c, stageId: previousStageId } : c))
        )
      }
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={showClosed}
            onChange={(e) => setShowClosed(e.target.checked)}
            className="rounded border-gray-300"
          />
          Mostrar encerrados ({closedCount})
        </label>
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {stages.map((stage) => (
            <Column
              key={stage.id}
              stage={stage}
              cards={visibleCards.filter((c) => c.stageId === stage.id)}
              showValidity={showValidity}
              wonLabel={wonLabel}
              lostLabel={lostLabel}
            />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
