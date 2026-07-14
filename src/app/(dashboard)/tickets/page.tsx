import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSlaStatus, SLA_LABELS, SLA_STYLES } from '@/lib/utils/sla'

const STATUS_LABELS: Record<string, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  aguardando_cliente: 'Aguardando cliente',
  resolvido: 'Resolvido',
  fechado: 'Fechado',
}
const STATUS_ORDER = ['aberto', 'em_andamento', 'aguardando_cliente', 'resolvido', 'fechado']

const PRIORITY_LABELS: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' }
const PRIORITY_STYLES: Record<string, string> = {
  baixa: 'bg-gray-100 text-gray-600',
  media: 'bg-blue-100 text-blue-700',
  alta: 'bg-yellow-100 text-yellow-800',
  urgente: 'bg-negative-100 text-negative-700',
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: statusFilter } = await searchParams
  const supabase = await createClient()

  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, ticket_number, subject, status, priority, requester_name, sla_due_at, resolved_at, created_at')
    .order('created_at', { ascending: false })

  const filtered = statusFilter ? (tickets ?? []).filter((t) => t.status === statusFilter) : tickets ?? []

  const slaWeight: Record<string, number> = { vencido: 0, atencao: 1, ok: 2, sem_prazo: 3 }
  const sorted = [...filtered].sort((a, b) => {
    const wa = slaWeight[getSlaStatus(a.sla_due_at, a.resolved_at)]
    const wb = slaWeight[getSlaStatus(b.sla_due_at, b.resolved_at)]
    return wa - wb
  })

  const countByStatus: Record<string, number> = {}
  for (const t of tickets ?? []) countByStatus[t.status] = (countByStatus[t.status] ?? 0) + 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Atendimento & Tickets</h1>
          <p className="mt-0.5 text-sm text-gray-500">Ordenado por urgência do prazo (SLA vencido primeiro).</p>
        </div>
        <div className="flex gap-2">
          <a href="/suporte" target="_blank" className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            🔗 Ver formulário público
          </a>
          <Link href="/tickets/new" className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800">
            + Novo Ticket
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/tickets" className={`rounded-md px-3 py-1.5 text-sm font-medium ${!statusFilter ? 'bg-brand-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
          Todos ({tickets?.length ?? 0})
        </Link>
        {STATUS_ORDER.map((s) => (
          <Link key={s} href={`/tickets?status=${s}`} className={`rounded-md px-3 py-1.5 text-sm font-medium ${statusFilter === s ? 'bg-brand-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            {STATUS_LABELS[s]} ({countByStatus[s] ?? 0})
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Ticket</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Solicitante</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Prioridade</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">SLA</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Aberto em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((t) => {
              const sla = getSlaStatus(t.sla_due_at, t.resolved_at)
              return (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/tickets/${t.id}`} className="font-medium text-brand-700 hover:underline">
                      {t.subject}
                    </Link>
                    <div className="text-xs text-gray-400">{t.ticket_number}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.requester_name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_STYLES[t.priority]}`}>{PRIORITY_LABELS[t.priority]}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{STATUS_LABELS[t.status]}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${SLA_STYLES[sla]}`}>{SLA_LABELS[sla]}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhum ticket nessa categoria.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
