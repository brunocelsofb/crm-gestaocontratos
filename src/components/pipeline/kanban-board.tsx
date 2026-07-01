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

import { useState, useTransition } from 'react'
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

function Card({ card, sla }: { card: RunCard; sla: number | null }) {
  const router = useRouter()
  const isClosed = card.status !== 'open'
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.runId,
    data: card,
    disabled: isClosed,
  })
  const days = daysSince(card.stageEnteredAt)
  const overdue = sla !== null && days > sla

  function openAccount() {
    router.push(card.companyId ? `/companies/${card.companyId}` : `/contracts/${card.contractId}`)
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`mb-2 rounded-md border border-gray-200 bg-white p-2 text-xs shadow-sm ${
        isClosed ? 'cursor-default opacity-80' : 'cursor-grab active:cursor-grabbing'
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start justify-between gap-1">
        <button
          type="button"
          onClick={openAccount}
          onPointerDown={(e) => e.stopPropagation()}
          title={card.companyId ? 'Abrir empresa' : 'Abrir contrato (sem empresa vinculada ainda)'}
          className="text-left font-medium text-gray-900 hover:text-brand-700 hover:underline"
        >
          {card.clientName}
        </button>
        {card.status === 'won' && <span className="shrink-0 rounded-full bg-positive-100 px-1.5 py-0.5 text-[9px] font-medium text-positive-700">Ganho</span>}
        {card.status === 'lost' && <span className="shrink-0 rounded-full bg-negative-100 px-1.5 py-0.5 text-[9px] font-medium text-negative-700">Perdido</span>}
      </div>
      <p className="font-mono text-[10px] text-gray-400">{card.processNumber}</p>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-gray-600">{fmt(card.value)}</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${overdue ? 'bg-negative-100 text-negative-700' : 'bg-gray-100 text-gray-500'}`}>
          {days === 0 ? '< 1d' : `${days}d`}
        </span>
      </div>
    </div>
  )
}

function Column({ stage, cards }: { stage: Stage; cards: RunCard[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const total = cards.reduce((sum, c) => sum + c.value, 0)

  return (
    <div
      ref={setNodeRef}
      className={`w-56 shrink-0 rounded-lg p-2 transition-colors ${isOver ? 'bg-blue-50' : 'bg-gray-100'}`}
    >
      <p className="px-1 text-xs font-medium text-gray-700">{stage.name}</p>
      <p className="px-1 pb-2 text-[11px] text-gray-400">
        {cards.length} · {fmt(total)}
      </p>
      {cards.map((c) => (
        <Card key={c.runId} card={c} sla={stage.sla_days} />
      ))}
      {cards.length === 0 && (
        <p className="py-6 text-center text-[11px] text-gray-400">Vazio</p>
      )}
    </div>
  )
}

export function KanbanBoard({
  stages,
  initialCards,
}: {
  stages: Stage[]
  initialCards: RunCard[]
}) {
  const [cards, setCards] = useState(initialCards)
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

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
      {error && <p className="text-sm text-red-600">{error}</p>}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {stages.map((stage) => (
            <Column key={stage.id} stage={stage} cards={cards.filter((c) => c.stageId === stage.id)} />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
