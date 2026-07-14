'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateTicketStatus, updateTicketPriority, updateTicketTrend, assignTicket, addTicketMessage, deleteTicket } from '@/lib/actions/tickets'
import { PRIORITY_LABELS, PRIORITY_CRITICALITY_LABELS, PRIORITY_SLA_DAYS, PRIORITY_TO_URGENCY, calculateGutIndex } from '@/lib/utils/gut-matrix'

type UserOption = { id: string; full_name: string }

const STATUS_OPTIONS = [
  { value: 'aberto', label: 'Aberto' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'aguardando_cliente', label: 'Aguardando cliente' },
  { value: 'resolvido', label: 'Resolvido' },
  { value: 'fechado', label: 'Fechado' },
]
const PRIORITY_OPTIONS = [
  { value: 'nao_critica', label: `${PRIORITY_LABELS.nao_critica} (${PRIORITY_SLA_DAYS.nao_critica}d)` },
  { value: 'pouco_critica', label: `${PRIORITY_LABELS.pouco_critica} (${PRIORITY_SLA_DAYS.pouco_critica}d)` },
  { value: 'critica', label: `${PRIORITY_LABELS.critica} (${PRIORITY_SLA_DAYS.critica}d)` },
  { value: 'muito_critica', label: `${PRIORITY_LABELS.muito_critica} (${PRIORITY_SLA_DAYS.muito_critica}d)` },
]
const TREND_OPTIONS = [
  { value: 1, label: '1 — Não irá mudar' },
  { value: 2, label: '2 — Irá piorar a longo prazo' },
  { value: 3, label: '3 — Irá piorar em médio prazo' },
  { value: 4, label: '4 — Irá piorar em curto prazo' },
  { value: 5, label: '5 — Irá piorar rapidamente' },
]

export function TicketActionsPanel({
  ticketId,
  currentStatus,
  currentPriority,
  currentAssignee,
  currentGravity,
  currentTrend,
  users,
  isAdmin,
}: {
  ticketId: string
  currentStatus: string
  currentPriority: string
  currentAssignee: string | null
  currentGravity: number | null
  currentTrend: number | null
  users: UserOption[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleStatusChange(status: string) {
    startTransition(async () => {
      const result = await updateTicketStatus(ticketId, status)
      if (result.error) setError(result.error)
      else router.refresh()
    })
  }

  function handlePriorityChange(priority: string) {
    startTransition(async () => {
      const result = await updateTicketPriority(ticketId, priority)
      if (result.error) setError(result.error)
      else router.refresh()
    })
  }

  function handleTrendChange(trend: number) {
    startTransition(async () => {
      const result = await updateTicketTrend(ticketId, trend)
      if (result.error) setError(result.error)
      else router.refresh()
    })
  }

  function handleAssign(userId: string) {
    startTransition(async () => {
      const result = await assignTicket(ticketId, userId)
      if (result.error) setError(result.error)
      else router.refresh()
    })
  }

  function handleSendMessage() {
    if (!message.trim()) return
    startTransition(async () => {
      const result = await addTicketMessage(ticketId, message, isInternalNote)
      if (result.error) {
        setError(result.error)
      } else {
        setMessage('')
        router.refresh()
      }
    })
  }

  function handleDelete() {
    if (!confirm('Excluir este ticket permanentemente?')) return
    startTransition(async () => {
      await deleteTicket(ticketId)
      router.push('/tickets')
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-xs font-medium text-gray-500">Matriz GUT (interno — não aparece pro cliente)</p>
        <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-[10px] text-gray-400">Gravidade (categoria)</p>
            <p className="font-medium text-gray-900">{currentGravity ?? '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400">Urgência (nível escolhido)</p>
            <p className="font-medium text-gray-900">{PRIORITY_TO_URGENCY[currentPriority as keyof typeof PRIORITY_TO_URGENCY]}</p>
          </div>
          <div>
            <label className="text-[10px] text-gray-400">Tendência (ajustar)</label>
            <select
              value={currentTrend ?? 3}
              onChange={(e) => handleTrendChange(Number(e.target.value))}
              disabled={isPending}
              className="mt-0.5 w-full rounded-md border border-gray-300 px-1.5 py-1 text-xs focus:border-brand-700 focus:outline-none"
            >
              {TREND_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <p className="mt-2 text-sm">
          Índice GUT: <span className="font-semibold text-gray-900">{calculateGutIndex(currentGravity, PRIORITY_TO_URGENCY[currentPriority as keyof typeof PRIORITY_TO_URGENCY], currentTrend) ?? '—'}</span>
          <span className="ml-2 text-xs text-gray-400">({PRIORITY_CRITICALITY_LABELS[currentPriority as keyof typeof PRIORITY_CRITICALITY_LABELS]} · SLA {PRIORITY_SLA_DAYS[currentPriority as keyof typeof PRIORITY_SLA_DAYS]} dia(s))</span>
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <label className="block text-[10px] text-gray-500">Status</label>
          <select value={currentStatus} onChange={(e) => handleStatusChange(e.target.value)} disabled={isPending} className="mt-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500">Prioridade</label>
          <select value={currentPriority} onChange={(e) => handlePriorityChange(e.target.value)} disabled={isPending} className="mt-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
            {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500">Responsável</label>
          <select defaultValue={currentAssignee ?? ''} onChange={(e) => handleAssign(e.target.value)} disabled={isPending} className="mt-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
            <option value="">Sem responsável</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>
        {isAdmin && (
          <button onClick={handleDelete} disabled={isPending} className="text-xs text-negative-600 hover:underline">
            Excluir ticket
          </button>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <label className="block text-xs font-medium text-gray-600">Responder</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={isInternalNote} onChange={(e) => setIsInternalNote(e.target.checked)} className="rounded border-gray-300" />
          Nota interna (o cliente NÃO vê isso no link público)
        </label>
        <button onClick={handleSendMessage} disabled={isPending} className="mt-2 rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
          {isPending ? 'Enviando...' : 'Enviar'}
        </button>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}
