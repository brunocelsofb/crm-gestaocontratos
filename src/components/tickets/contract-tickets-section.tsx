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

export async function ContractTicketsSection({ contractId, clientName }: { contractId: string; clientName: string }) {
  const supabase = await createClient()
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, ticket_number, subject, status, priority, sla_due_at, resolved_at, created_at')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-900">Atendimento</h2>
        <Link
          href={`/tickets/new?contract_id=${contractId}&client_name=${encodeURIComponent(clientName)}`}
          className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
        >
          + Novo Ticket
        </Link>
      </div>

      <div className="space-y-1.5">
        {tickets?.map((t) => {
          const sla = getSlaStatus(t.sla_due_at, t.resolved_at)
          return (
            <Link
              key={t.id}
              href={`/tickets/${t.id}`}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50"
            >
              <div>
                <span className="font-medium text-gray-900">{t.subject}</span>
                <span className="ml-2 text-xs text-gray-400">{t.ticket_number} · {STATUS_LABELS[t.status]}</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${SLA_STYLES[sla]}`}>{SLA_LABELS[sla]}</span>
            </Link>
          )
        })}
        {(!tickets || tickets.length === 0) && <p className="text-sm text-gray-400">Nenhum ticket de atendimento pra este contrato ainda.</p>}
      </div>
    </div>
  )
}
