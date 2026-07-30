import { createAdminClient } from '@/lib/supabase/admin'
import { ClientApprovalForm } from '@/components/proposals/client-approval-form'

export default async function ClientApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: proposal } = await admin
    .from('proposal_status')
    .select('*, contracts(client_name, title, process_number)')
    .eq('client_review_token', token)
    .maybeSingle()

  if (!proposal) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7f7' }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: 32, textAlign: 'center', maxWidth: 400 }}>
          <p style={{ fontSize: 18, color: '#1a1f36', marginBottom: 8 }}>Link inválido</p>
          <p style={{ fontSize: 13, color: '#8892a4' }}>Este link não existe ou expirou.</p>
        </div>
      </div>
    )
  }

  const contract = (proposal as any).contracts
  const snapshot = proposal.technical_snapshot as any

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7f7', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#1b556b,#32af9d)', padding: '20px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 4px' }}>
            Proposta Comercial
          </p>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#fff', margin: '0 0 2px' }}>{contract?.client_name}</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>{contract?.title || contract?.process_number}</p>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px' }}>
        {/* Resumo técnico */}
        {snapshot && (
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', padding: 20, marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', marginBottom: 12 }}>Resumo da Proposta</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
              {snapshot.hospitalBeds > 0 && (
                <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '10px 12px' }}>
                  <p style={{ fontSize: 10, color: '#8892a4', margin: '0 0 2px' }}>LEITOS</p>
                  <p style={{ fontSize: 18, fontWeight: 600, color: '#1a1f36', margin: 0 }}>{snapshot.hospitalBeds}</p>
                </div>
              )}
              {snapshot.dimensionamento?.totalEquipamentos > 0 && (
                <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '10px 12px' }}>
                  <p style={{ fontSize: 10, color: '#8892a4', margin: '0 0 2px' }}>EQUIPAMENTOS</p>
                  <p style={{ fontSize: 18, fontWeight: 600, color: '#1a1f36', margin: 0 }}>{snapshot.dimensionamento.totalEquipamentos}</p>
                </div>
              )}
              <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '10px 12px' }}>
                <p style={{ fontSize: 10, color: '#8892a4', margin: '0 0 2px' }}>PROFISSIONAIS</p>
                <p style={{ fontSize: 18, fontWeight: 600, color: '#1a1f36', margin: 0 }}>{snapshot.totalFTE}</p>
              </div>
            </div>
            {snapshot.escopoServicos?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {snapshot.escopoServicos.map((s: string, i: number) => (
                  <span key={i} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, background: '#eaf5ee', color: '#1a7c3e' }}>✓ {s}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Valor */}
        {proposal.proposal_value && (
          <div style={{ background: 'linear-gradient(135deg,#1a1f36,#2d3561)', borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0 }}>Investimento mensal</p>
            <p style={{ fontSize: 22, fontWeight: 600, color: '#32af9d', margin: 0 }}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proposal.proposal_value)}/mês
            </p>
          </div>
        )}

        {/* Formulário de aprovação */}
        <ClientApprovalForm token={token} contractId={(proposal as any).contract_id} currentStatus={proposal.client_status ?? 'pendente'} />
      </div>
    </div>
  )
}
