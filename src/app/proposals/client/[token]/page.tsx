import { createAdminClient } from '@/lib/supabase/admin'
import { ClientApprovalForm } from '@/components/proposals/client-approval-form'

export default async function ClientApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: proposal } = await admin
    .from('proposal_status')
    .select('*')
    .eq('client_review_token', token)
    .maybeSingle()

  if (!proposal) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7f7' }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: 32, textAlign: 'center', maxWidth: 400 }}>
          <p style={{ fontSize: 18, color: '#1a1f36' }}>Link invalido</p>
          <p style={{ fontSize: 13, color: '#8892a4' }}>Este link nao existe ou expirou.</p>
        </div>
      </div>
    )
  }

  // Busca contrato separadamente — funciona com pipeline_run ou contract
  const contractId = (proposal as any).contract_id
  const { data: contractData } = await admin
    .from('contracts')
    .select('id, client_name, title, process_number')
    .eq('id', contractId)
    .maybeSingle()

  const clientName = contractData?.client_name ?? 'Cliente'

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7f7', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#1b556b,#32af9d)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>O</span>
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>Proposta Comercial</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0 }}>{clientName}</p>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* PDF embutido */}
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '12px 20px', borderBottom: '0.5px solid #e8edf5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', margin: 0 }}>Documento da Proposta</p>
            <a
              href={`/api/proposals/public-pdf/${token}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: '#1b556b', textDecoration: 'none', fontWeight: 500 }}>
              ⬇ Baixar PDF
            </a>
          </div>
          <iframe
            src={`/api/proposals/public-pdf/${token}`}
            style={{ width: '100%', height: '70vh', border: 'none', display: 'block' }}
            title="Proposta Comercial"
          />
        </div>

        {/* Formulário de aprovação */}
        <ClientApprovalForm
          token={token}
          contractId={contractId}
          currentStatus={proposal.client_status ?? 'pendente'}
        />
      </div>
    </div>
  )
}
