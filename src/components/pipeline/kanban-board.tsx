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
import { deleteContract } from '@/lib/actions/contracts'
import { createClient } from '@/lib/supabase/client'
import { ValidityBadge } from '@/components/contracts/validity-badge'
import { Trash2 } from 'lucide-react'

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
  lastActivityAt: string | null
  validUntil: string | null
  freshness: 'fresh' | 'warning' | 'stale'
  tag: { id: string; name: string; color: string } | null
  lostReasonName?: string | null
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
  fresh:   { border: '0.5px solid #e8edf5', background: '#fff', borderLeft: '0.5px solid #e8edf5' },
  warning: { border: '0.5px solid #fde68a', background: '#fffdf5', borderLeft: '3px solid #f59e0b' },
  stale:   { border: '0.5px solid #fca5a5', background: '#fff5f5', borderLeft: '3px solid #ef4444' },
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
      style={{
        ...FRESHNESS_STYLES[isClosed ? 'fresh' : card.freshness],
        borderRadius: 10,
        padding: '12px',
        marginBottom: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        cursor: isClosed ? 'default' : 'grab',
        opacity: isDragging ? 0.4 : isClosed ? 0.8 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <button
          type="button"
          onClick={openAccount}
          onPointerDown={(e) => e.stopPropagation()}
          title={card.companyId ? 'Abrir empresa' : 'Abrir contrato'}
          style={{ textAlign: 'left', fontSize: 13, fontWeight: 500, color: '#1a1f36', background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 1.3 }}
        >
          {card.clientName}
        </button>
        {card.status === 'won' && <span style={{ flexShrink: 0, borderRadius: 20, background: '#eaf5ee', color: '#1a7c3e', fontSize: 10, fontWeight: 500, padding: '2px 7px' }}>{wonLabel}</span>}
        {card.status === 'lost' && <span style={{ flexShrink: 0, borderRadius: 20, background: '#fdecea', color: '#b91c1c', fontSize: 10, fontWeight: 500, padding: '2px 7px' }}>{lostLabel}</span>}
      </div>

      {card.tag && (
        <span style={{ display: 'inline-block', marginTop: 6, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 500, color: '#fff', background: card.tag.color }}>
          {card.tag.name}
        </span>
      )}

      <p style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 10, color: '#b0b8c8' }}>{card.processNumber}</p>

      {showValidity && card.validUntil && (
        <div style={{ marginTop: 6 }}>
          <ValidityBadge validUntil={card.validUntil} />
        </div>
      )}

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid #f1f3f8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36' }}>{fmt(card.value)}</span>
        <span style={{ borderRadius: 20, padding: '2px 7px', fontSize: 10, fontWeight: 500, background: overdue ? '#fdecea' : '#f1f3f8', color: overdue ? '#b91c1c' : '#8892a4' }}>
          {days === 0 ? '< 1 dia' : `${days}d`}
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
      style={{
        width: 272,
        flexShrink: 0,
        borderRadius: 12,
        padding: '12px 10px',
        background: isOver ? '#eef3ff' : '#f1f3f8',
        border: isOver ? '0.5px solid #b0c4f8' : '0.5px solid #e8edf5',
        transition: 'background 0.15s, border 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: 10 }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: '#1a1f36', margin: 0 }}>{stage.name}</p>
        <span style={{ fontSize: 10, color: '#8892a4', background: '#fff', border: '0.5px solid #e8edf5', borderRadius: 20, padding: '2px 7px' }}>{cards.length}</span>
      </div>
      <p style={{ fontSize: 11, color: '#8892a4', padding: '0 4px', marginBottom: 10 }}>{fmt(total)}</p>
      {cards.map((c) => (
        <Card key={c.runId} card={c} sla={stage.sla_days} showValidity={showValidity} wonLabel={wonLabel} lostLabel={lostLabel} />
      ))}
      {cards.length === 0 && (
        <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 11, color: '#c8cdd8' }}>Vazio</p>
      )}
    </div>
  )
}

const TRASH_ZONE_ID = '__trash__'

function TrashDropzone() {
  const { setNodeRef, isOver } = useDroppable({ id: TRASH_ZONE_ID })
  return (
    <div
      ref={setNodeRef}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderRadius: 10, border: `1.5px dashed ${isOver ? '#ef4444' : '#d1d8e8'}`,
        padding: '10px', fontSize: 12, marginBottom: 4,
        background: isOver ? '#fdecea' : 'transparent',
        color: isOver ? '#b91c1c' : '#8892a4',
        transition: 'all 0.15s',
      }}
    >
      <Trash2 size={14} />
      Arraste aqui para excluir permanentemente (admin)
    </div>
  )
}

export function KanbanBoard({
  pipelineId,
  stages,
  initialCards,
  showValidity,
  wonLabel,
  lostLabel,
  isAdmin,
}: {
  pipelineId: string
  stages: Stage[]
  initialCards: RunCard[]
  showValidity: boolean
  wonLabel: string
  lostLabel: string
  isAdmin: boolean
}) {
  const [cards, setCards] = useState(initialCards)

  // CORREÇÃO: sem isso, o botão "Atualizar" (router.refresh()) buscaria
  // dados novos do servidor, mas o estado local dos cards continuaria
  // com a versão antiga — useState só usa o valor inicial na primeira
  // renderização, não sincroniza sozinho quando a prop muda depois.
  useEffect(() => {
    setCards(initialCards)
  }, [initialCards])

  const router = useRouter()

  // Atualização em tempo real — quando algo muda em pipeline_runs deste
  // funil (por exemplo, a automação de renovação movendo um contrato
  // sozinha), a tela busca os dados novos automaticamente, sem precisar
  // de F5 ou clicar em "Atualizar".
  //
  // NOTA DE INCERTEZA: mesmo caso do sino de notificação — se isso não
  // atualizar sozinho, confira em Database → Replication →
  // supabase_realtime se a tabela "pipeline_runs" está habilitada.
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`pipeline_runs:${pipelineId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'contract_crm', table: 'pipeline_runs', filter: `pipeline_id=eq.${pipelineId}` },
        () => {
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [pipelineId, router])

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

    const card = active.data.current as RunCard | undefined
    if (!card) return

    if (over.id === TRASH_ZONE_ID) {
      if (!confirm(`Excluir "${card.clientName}" PARA SEMPRE? Isso apaga todo o histórico, arquivos e faturamento ligados a esse contrato. Não tem como desfazer.`)) {
        return
      }
      // Remove da tela imediatamente (otimista) — se falhar, o próximo
      // "Atualizar" traz de volta, já que revalidatePath só roda no
      // servidor depois da resposta.
      setCards((prev) => prev.filter((c) => c.runId !== card.runId))
      setError(null)
      startTransition(async () => {
        const result = await deleteContract(card.contractId)
        if (result?.error) {
          setError(result.error)
          setCards((prev) => [...prev, card])
        }
      })
      return
    }

    const newStageId = String(over.id)
    if (card.stageId === newStageId || card.status !== 'open') return

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {error && <p style={{ fontSize: 12, color: '#b91c1c' }}>{error}</p>}
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8892a4', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showClosed}
            onChange={(e) => setShowClosed(e.target.checked)}
            style={{ borderRadius: 4 }}
          />
          Mostrar encerrados ({closedCount})
        </label>
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {isAdmin && <TrashDropzone />}
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
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
