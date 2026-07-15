'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateTicketStatus, updateTicketPriority, assignTicket, addTicketMessage, deleteTicket } from '@/lib/actions/tickets'
import { PRIORITY_LABELS, PRIORITY_SLA_DAYS } from '@/lib/utils/gut-matrix'

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

// NOTA: cada ação tem seu PRÓPRIO estado de "carregando" (statusBusy,
// priorityBusy, assignBusy, messageBusy, finalizeBusy) — antes tudo
// dividia o mesmo estado, e por isso mudar status/prioridade fazia o
// botão "Enviar" (não relacionado) mostrar "Enviando..." também.
export function TicketActionsPanel({
  ticketId,
  currentStatus,
  currentPriority,
  currentAssignee,
  users,
  isAdmin,
}: {
  ticketId: string
  currentStatus: string
  currentPriority: string
  currentAssignee: string | null
  users: UserOption[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [statusBusy, setStatusBusy] = useState(false)
  const [priorityBusy, setPriorityBusy] = useState(false)
  const [assignBusy, setAssignBusy] = useState(false)
  const [messageBusy, setMessageBusy] = useState(false)
  const [finalizeBusy, setFinalizeBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  async function handleStatusChange(status: string) {
    setStatusBusy(true)
    setError(null)
    const result = await updateTicketStatus(ticketId, status)
    setStatusBusy(false)
    if (result.error) setError(result.error)
    else router.refresh()
  }

  async function handlePriorityChange(priority: string) {
    setPriorityBusy(true)
    setError(null)
    const result = await updateTicketPriority(ticketId, priority)
    setPriorityBusy(false)
    if (result.error) setError(result.error)
    else router.refresh()
  }

  async function handleAssign(userId: string) {
    setAssignBusy(true)
    setError(null)
    const result = await assignTicket(ticketId, userId)
    setAssignBusy(false)
    if (result.error) setError(result.error)
    else router.refresh()
  }

  async function handleSendMessage() {
    if (!message.trim()) return
    setMessageBusy(true)
    setError(null)
    const result = await addTicketMessage(ticketId, message, isInternalNote)
    setMessageBusy(false)
    if (result.error) {
      setError(result.error)
    } else {
      setMessage('')
      router.refresh()
    }
  }

  async function handleFinalize() {
    if (!confirm('Finalizar este atendimento de vez (fechado)? O cliente ainda pode ver o histórico pelo link, mas o ticket sai da fila de pendentes.')) return
    setFinalizeBusy(true)
    setError(null)
    const result = await updateTicketStatus(ticketId, 'fechado')
    setFinalizeBusy(false)
    if (result.error) setError(result.error)
    else router.refresh()
  }

  async function handleDelete() {
    if (!confirm('Excluir este ticket permanentemente?')) return
    setDeleteBusy(true)
    await deleteTicket(ticketId)
    router.push('/tickets')
  }

  const isFinalized = currentStatus === 'fechado'

  return (
    <div className="space-y-4">
      {!isFinalized && (
        <div className="rounded-lg border border-positive-300 bg-positive-100/40 p-3">
          <button
            onClick={handleFinalize}
            disabled={finalizeBusy}
            className="rounded-md bg-positive-600 px-4 py-2 text-sm font-semibold text-white hover:bg-positive-700 disabled:opacity-50"
          >
            {finalizeBusy ? 'Finalizando...' : '✅ Finalizar atendimento'}
          </button>
          <span className="ml-2 text-xs text-gray-500">Fecha o ticket de vez — some da lista de pendentes.</span>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <label className="block text-[10px] text-gray-500">Status</label>
          <select value={currentStatus} onChange={(e) => handleStatusChange(e.target.value)} disabled={statusBusy} className="mt-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {statusBusy && <p className="mt-0.5 text-[10px] text-gray-400">Salvando...</p>}
        </div>
        <div>
          <label className="block text-[10px] text-gray-500">Prioridade</label>
          <select value={currentPriority} onChange={(e) => handlePriorityChange(e.target.value)} disabled={priorityBusy} className="mt-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
            {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {priorityBusy && <p className="mt-0.5 text-[10px] text-gray-400">Salvando...</p>}
        </div>
        <div>
          <label className="block text-[10px] text-gray-500">Responsável</label>
          <select defaultValue={currentAssignee ?? ''} onChange={(e) => handleAssign(e.target.value)} disabled={assignBusy} className="mt-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
            <option value="">Sem responsável</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
          {assignBusy && <p className="mt-0.5 text-[10px] text-gray-400">Salvando...</p>}
        </div>
        {isAdmin && (
          <button onClick={handleDelete} disabled={deleteBusy} className="text-xs text-negative-600 hover:underline">
            {deleteBusy ? 'Excluindo...' : 'Excluir ticket'}
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
        <button onClick={handleSendMessage} disabled={messageBusy} className="mt-2 rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
          {messageBusy ? 'Enviando...' : 'Enviar'}
        </button>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}
