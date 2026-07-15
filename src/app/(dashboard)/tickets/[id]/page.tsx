import Link from 'next/link'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { TicketActionsPanel } from '@/components/tickets/ticket-actions-panel'
import { getSlaStatus, SLA_LABELS, SLA_STYLES } from '@/lib/utils/sla'
import { CopyLinkButton } from '@/components/nps/copy-link-button'
import { TicketContractLink } from '@/components/tickets/ticket-contract-link'
import { TicketDepartmentSection } from '@/components/tickets/ticket-department-section'

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: ticket }, { data: messages }, { data: allProfiles }, isAdmin] = await Promise.all([
    supabase.from('tickets').select('*').eq('id', id).maybeSingle(),
    supabase.from('ticket_messages').select('*').eq('ticket_id', id).order('created_at', { ascending: true }),
    supabase.from('profiles').select('id, full_name'),
    isCurrentUserAdmin(),
  ])

  if (!ticket) notFound()

  const { data: linkedContract } = ticket.contract_id
    ? await supabase.from('contracts').select('client_name').eq('id', ticket.contract_id).maybeSingle()
    : { data: null }

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const publicLink = `${protocol}://${host}/acompanhar-ticket/${ticket.public_token}`

  const sla = getSlaStatus(ticket.sla_due_at, ticket.resolved_at)

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/tickets" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700">
        ← Voltar para Tickets
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400">{ticket.ticket_number}</p>
          <h1 className="text-lg font-semibold text-gray-900">{ticket.subject}</h1>
          <p className="text-sm text-gray-500">{ticket.requester_name} · {ticket.requester_email ?? ticket.requester_phone ?? '—'}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${SLA_STYLES[sla]}`}>{SLA_LABELS[sla]}</span>
      </div>

      {ticket.satisfaction_token && (
        <div className="rounded-lg border border-purple-100 bg-purple-50 p-3">
          <p className="text-xs font-medium text-purple-800">
            Pesquisa rápida de satisfação {ticket.satisfaction_responded_at ? '(já respondida)' : '(ainda não respondida — copie e envie pro cliente)'}
          </p>
          {ticket.satisfaction_responded_at ? (
            <p className="mt-1 text-sm text-purple-900">
              Nota: <strong>{ticket.satisfaction_rating}/5</strong>
              {ticket.satisfaction_comment && <> — &ldquo;{ticket.satisfaction_comment}&rdquo;</>}
            </p>
          ) : (
            <div className="mt-1.5 flex items-center gap-2">
              <input readOnly value={`${protocol}://${host}/avaliar-atendimento/${ticket.satisfaction_token}`} className="flex-1 truncate rounded-md border border-purple-200 bg-white px-2 py-1 font-mono text-xs text-purple-700" />
              <CopyLinkButton link={`${protocol}://${host}/avaliar-atendimento/${ticket.satisfaction_token}`} />
            </div>
          )}
        </div>
      )}

      <TicketContractLink
        ticketId={ticket.id}
        linkedContractId={ticket.contract_id}
        linkedContractName={linkedContract?.client_name ?? null}
        requesterCnpj={ticket.requester_cnpj}
      />

      <TicketDepartmentSection
        ticketId={ticket.id}
        currentDepartment={ticket.current_department}
        hasPrevious={!!ticket.previous_department}
      />

      {ticket.contract_id && (
        <p className="text-xs text-gray-500">
          Se esse atendimento precisar de uma ação estruturada (não só apuração pontual), registre no{' '}
          <Link href={`/contracts/${ticket.contract_id}`} className="text-brand-700 hover:underline">
            Plano de Ação do contrato vinculado
          </Link>.
        </p>
      )}

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
        <p className="text-xs font-medium text-blue-800">Link público (o solicitante acompanha por aqui, sem login)</p>
        <div className="mt-1.5 flex items-center gap-2">
          <input readOnly value={publicLink} className="flex-1 truncate rounded-md border border-blue-200 bg-white px-2 py-1 font-mono text-xs text-blue-700" />
          <CopyLinkButton link={publicLink} />
        </div>
      </div>

      <div className="space-y-2">
        {messages?.map((m) => (
          <div key={m.id} className={`flex ${m.author_type === 'cliente' ? 'justify-start' : 'justify-end'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.is_internal_note
                  ? 'border border-yellow-300 bg-yellow-50 text-yellow-900'
                  : m.author_type === 'cliente'
                    ? 'bg-white border border-gray-200 text-gray-800'
                    : 'bg-brand-700 text-white'
              }`}
            >
              {m.is_internal_note && <p className="mb-0.5 text-[10px] font-semibold uppercase">Nota interna</p>}
              <p>{m.message}</p>
              <p className={`mt-1 text-[10px] ${m.author_type === 'cliente' || m.is_internal_note ? 'text-gray-400' : 'text-white/70'}`}>
                {m.author_name}{m.author_department ? ` (${m.author_department})` : ''} · {new Date(m.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        ))}
        {(!messages || messages.length === 0) && <p className="text-sm text-gray-400">Nenhuma mensagem ainda.</p>}
      </div>

      <TicketActionsPanel
        ticketId={ticket.id}
        currentStatus={ticket.status}
        currentPriority={ticket.priority}
        currentAssignee={ticket.assigned_to}
        users={allProfiles ?? []}
        isAdmin={isAdmin}
      />
    </div>
  )
}
