import { createAdminClient } from '@/lib/supabase/admin'
import { ClientDecisionPanel } from '@/components/proposals/client-decision-panel'

export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const adminClient = createAdminClient()

  const { data: proposal } = await adminClient
    .from('proposals')
    .select('id, control_code, status, pdf_storage_path')
    .eq('token', token)
    .maybeSingle()

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        {!proposal ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            Link inválido ou expirado. Entre em contato com quem enviou.
          </div>
        ) : proposal.status !== 'pending_client' ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
            <p className="text-lg font-medium text-gray-900">Esta proposta já foi respondida.</p>
            <p className="mt-1 text-sm text-gray-500">Se precisar de uma nova via, entre em contato com quem enviou.</p>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-gray-900">Proposta {proposal.control_code}</h1>
            {proposal.pdf_storage_path && (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white" style={{ height: '75vh' }}>
                <iframe src={`/api/proposals/${proposal.id}/pdf/public?token=${token}`} className="h-full w-full" title="Proposta" />
              </div>
            )}
            <ClientDecisionPanel token={token} />
          </>
        )}
      </div>
    </div>
  )
}
