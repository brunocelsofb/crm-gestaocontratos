import { createAdminClient } from '@/lib/supabase/admin'
import { PublicTicketReplyForm } from '@/components/tickets/public-ticket-reply-form'

const STATUS_LABELS: Record<string, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  aguardando_cliente: 'Aguardando sua resposta',
  resolvido: 'Resolvido',
  fechado: 'Fechado',
}

export default async function PublicTicketTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = createAdminClient()

  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, ticket_number, subject, status, priority, created_at')
    .eq('public_token', token)
    .maybeSingle()

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          Link inválido ou expirado.
        </div>
      </div>
    )
  }

  const { data: messages } = await supabase
    .from('ticket_messages')
    .select('author_type, author_name, message, is_internal_note, created_at')
    .eq('ticket_id', ticket.id)
    .eq('is_internal_note', false)
    .order('created_at', { ascending: true })

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-400">{ticket.ticket_number}</p>
          <h1 className="text-lg font-semibold text-gray-900">{ticket.subject}</h1>
          <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            {STATUS_LABELS[ticket.status]}
          </span>
        </div>

        <div className="space-y-2">
          {messages?.map((m, i) => (
            <div key={i} className={`flex ${m.author_type === 'cliente' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.author_type === 'cliente' ? 'bg-brand-700 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                <p>{m.message}</p>
                <p className={`mt-1 text-[10px] ${m.author_type === 'cliente' ? 'text-white/70' : 'text-gray-400'}`}>
                  {m.author_name} · {new Date(m.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          ))}
        </div>

        <PublicTicketReplyForm token={token} />
      </div>
    </div>
  )
}
