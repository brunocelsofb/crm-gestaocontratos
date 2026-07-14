'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateTicketStatus, updateTicketPriority, assignTicket, addTicketMessage, deleteTicket } from '@/lib/actions/tickets'

type UserOption = { id: string; full_name: string }

const STATUS_OPTIONS = [
  { value: 'aberto', label: 'Aberto' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'aguardando_cliente', label: 'Aguardando cliente' },
  { value: 'resolvido', label: 'Resolvido' },
  { value: 'fechado', label: 'Fechado' },
]
const PRIORITY_OPTIONS = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
]

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
