import { createAdminClient } from '@/lib/supabase/admin'
import { PublicTicketReplyForm } from '@/components/tickets/public-ticket-reply-form'
import { TicketSatisfactionForm } from '@/components/tickets/ticket-satisfaction-form'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const STATUS_LABELS: Record<string, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  aguardando_cliente: 'Aguardando sua resposta',
  resolvido: 'Resolvido',
  fechado: 'Fechado',
}

export default async function PublicTicketTrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createAdminClient()

  const [{ data: ticket }, { data: orgSettings }] = await Promise.all([
    supabase.from('tickets')
      .select('id, ticket_number, subject, status, priority, created_at, satisfaction_responded_at, satisfaction_rating')
      .eq('public_token', token).maybeSingle(),
    supabase.from('organization_settings')
      .select('support_bg_url, logo_storage_path, company_name')
      .eq('id', 'default').maybeSingle(),
  ])

  const rawBg   = orgSettings?.support_bg_url
  const rawLogo = orgSettings?.logo_storage_path
  const supportBgUrl = (rawBg && rawBg.startsWith('https://')) ? rawBg : null
  const logoUrl = (rawLogo && rawLogo.trim() && rawLogo !== 'null')
    ? supabase.storage.from('public-assets').getPublicUrl(rawLogo).data.publicUrl
    : null

  if (!ticket) {
    return (
      <div className="relative min-h-screen w-full">
        <div className="fixed inset-0 pointer-events-none -z-10" style={{ backgroundImage: supportBgUrl ? `url('${supportBgUrl}')` : undefined, backgroundColor: '#1B556B', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
        <main className="min-h-screen flex items-center justify-center px-4">
          <div className="rounded-xl bg-white p-6 text-center text-sm text-gray-500 shadow-xl">Link inválido ou expirado.</div>
        </main>
      </div>
    )
  }

  const { data: messages } = await supabase.from('ticket_messages')
    .select('author_type, author_name, message, is_internal_note, created_at')
    .eq('ticket_id', ticket.id).eq('is_internal_note', false)
    .order('created_at', { ascending: true })

  const isFinalized = ticket.status === 'fechado'

  return (
    <div className="relative min-h-screen w-full">
      {/* Fundo fixo — mesmo padrão das pesquisas */}
      <div className="fixed inset-0 pointer-events-none -z-10" style={{ backgroundImage: supportBgUrl ? `url('${supportBgUrl}')` : undefined, backgroundColor: '#1B556B', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />

      <main className="min-h-screen w-full flex flex-col items-center justify-start py-10 px-4">
        <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Logo */}
          {logoUrl && (
            <div style={{ width: 160, height: 48, backgroundImage: `url('${logoUrl}')`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', margin: '0 auto 8px' }} />
          )}

          {/* Header do ticket */}
          <div className="rounded-xl bg-white/95 shadow-xl p-4">
            <p className="text-xs text-gray-400">{ticket.ticket_number}</p>
            <h1 className="text-lg font-semibold text-gray-900">{ticket.subject}</h1>
            <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {STATUS_LABELS[ticket.status]}
            </span>
          </div>

          {/* Mensagens */}
          <div className="space-y-2">
            {messages?.map((m, i) => (
              <div key={i} className={`flex ${m.author_type === 'cliente' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.author_type === 'cliente' ? 'bg-[#1B556B] text-white' : 'bg-white border border-gray-200 text-gray-800 shadow-sm'}`}>
                  <p>{m.message}</p>
                  <p className={`mt-1 text-[10px] ${m.author_type === 'cliente' ? 'text-white/70' : 'text-gray-400'}`}>
                    {m.author_name} · {new Date(m.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Avaliação / Reply */}
          {isFinalized ? (
            ticket.satisfaction_responded_at ? (
              <div className="bg-white/90 backdrop-blur p-6 rounded-xl shadow-lg border border-gray-200 text-center">
                <h3 className="text-lg font-bold text-[#1B556B]">Obrigado pela sua avaliação!</h3>
                <p className="text-sm text-gray-600 mt-2">Seu feedback é fundamental para melhorarmos nosso atendimento.</p>
                <p className="text-xs text-gray-400 mt-1">Nota enviada: {ticket.satisfaction_rating}/5</p>
              </div>
            ) : (
              <div className="bg-white/95 rounded-xl shadow-xl p-4">
                <TicketSatisfactionForm token={token} />
              </div>
            )
          ) : (
            <div className="bg-white/95 rounded-xl shadow-xl p-4">
              <PublicTicketReplyForm token={token} />
            </div>
          )}

          <p className="text-center text-xs text-white/40 mt-2">
            {orgSettings?.company_name ?? 'ORBIS Engenharia'} © {new Date().getFullYear()}
          </p>
        </div>
      </main>
    </div>
  )
}
