import { createAdminClient } from '@/lib/supabase/admin'
import { TicketSatisfactionForm } from '@/components/tickets/ticket-satisfaction-form'

export default async function TicketSatisfactionPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = createAdminClient()

  const { data: ticket } = await supabase
    .from('tickets')
    .select('ticket_number, subject, satisfaction_responded_at')
    .eq('satisfaction_token', token)
    .maybeSingle()

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-md space-y-4">
        {!ticket ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            Link inválido ou expirado.
          </div>
        ) : ticket.satisfaction_responded_at ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
            <p className="text-lg font-medium text-gray-900">Você já avaliou esse atendimento.</p>
            <p className="mt-1 text-sm text-gray-500">Obrigado pelo retorno!</p>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h1 className="text-xl font-semibold text-gray-900">Avalie seu atendimento</h1>
              <p className="mt-1 text-sm text-gray-500">{ticket.ticket_number} — {ticket.subject}</p>
            </div>
            <TicketSatisfactionForm token={token} />
          </>
        )}
      </div>
    </div>
  )
}
