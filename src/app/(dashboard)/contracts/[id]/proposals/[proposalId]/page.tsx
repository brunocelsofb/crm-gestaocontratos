import Link from 'next/link'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ProposalPageOrderEditor } from '@/components/proposals/proposal-page-order-editor'
import { ProposalApprovalPanel } from '@/components/proposals/proposal-approval-panel'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  pending_technical: 'Aguardando pré-aprovação técnica',
  pending_commercial: 'Aguardando aprovação comercial',
  declined_internal: 'Declinada internamente',
  pending_client: 'Aguardando o cliente',
  approved: 'Aprovada pelo cliente',
  declined_client: 'Declinada pelo cliente',
}

function fmt(v: number, currency: string) {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(v)
  } catch {
    return `${currency} ${v.toFixed(2)}`
  }
}

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string; proposalId: string }>
}) {
  const { id: contractId, proposalId } = await params
  const supabase = await createClient()

  const [{ data: proposal }, { data: items }, { data: pages }, { data: templates }, { data: approvals }] = await Promise.all([
    supabase.from('proposals').select('*').eq('id', proposalId).maybeSingle(),
    supabase.from('proposal_items').select('*').eq('proposal_id', proposalId).order('position'),
    supabase.from('proposal_pages').select('template_id, is_standard_proposal').eq('proposal_id', proposalId).order('position'),
    supabase.from('proposal_templates').select('id, name'),
    supabase.from('proposal_approvals').select('*').eq('proposal_id', proposalId).order('decided_at', { ascending: false }),
  ])

  if (!proposal) notFound()

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'

  const total = (items ?? []).reduce((sum, it) => sum + Number(it.subtotal), 0)
  const canEditPages = proposal.status === 'draft'

  return (
    <div className="max-w-3xl space-y-6">
      <Link href={`/contracts/${contractId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700">
        ← Voltar para o contrato
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{proposal.control_code}</h1>
          <p className="text-sm text-gray-500">Versão {proposal.version} · {STATUS_LABELS[proposal.status]}</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/proposals/${proposal.id}/preview`}
            target="_blank"
            className="rounded-md border border-brand-700 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
          >
            🔍 Pré-visualizar PDF
          </a>
          {proposal.pdf_storage_path && (
            <a
              href={`/api/proposals/${proposal.id}/pdf`}
              target="_blank"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              📄 Ver PDF enviado ao cliente
            </a>
          )}
        </div>
      </div>

      {proposal.token && proposal.status === 'pending_client' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs font-medium text-blue-800">Link público (cliente)</p>
          <p className="mt-1 break-all font-mono text-xs text-blue-700">{`${protocol}://${host}/proposal/${proposal.token}`}</p>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-gray-900">Montagem do documento</h2>
        {canEditPages ? (
          <ProposalPageOrderEditor
            proposalId={proposal.id}
            contractId={contractId}
            templates={templates ?? []}
            initialPages={pages ?? []}
          />
        ) : (
          <p className="text-sm text-gray-400">A montagem não pode mais ser alterada (a proposta já saiu do rascunho).</p>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-gray-900">Itens</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Item</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Qtd</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Vlr. Unit.</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Desconto</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items?.map((it) => (
                <tr key={it.id}>
                  <td className="px-3 py-2">{it.item}</td>
                  <td className="px-3 py-2">{it.quantity}</td>
                  <td className="px-3 py-2">{fmt(Number(it.unit_value), proposal.currency)}</td>
                  <td className="px-3 py-2">{fmt(Number(it.discount), proposal.currency)}</td>
                  <td className="px-3 py-2 font-medium">{fmt(Number(it.subtotal), proposal.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-right text-sm font-semibold text-gray-900">Total: {fmt(total, proposal.currency)}</p>
      </div>

      <ProposalApprovalPanel proposalId={proposal.id} contractId={contractId} status={proposal.status} />

      {approvals && approvals.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-900">Histórico de decisões</h2>
          <div className="space-y-1.5">
            {approvals.map((a) => (
              <div key={a.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    {a.stage === 'technical' ? 'Técnico' : a.stage === 'commercial' ? 'Comercial' : 'Cliente'} —{' '}
                    <span className={a.decision === 'approved' ? 'text-positive-700' : 'text-negative-700'}>
                      {a.decision === 'approved' ? 'Aprovou' : 'Declinou'}
                    </span>
                  </span>
                  <span className="text-xs text-gray-400">{new Date(a.decided_at).toLocaleString('pt-BR')}</span>
                </div>
                <p className="mt-1 text-gray-600">&ldquo;{a.comment}&rdquo;</p>
                {a.signer_name && (
                  <p className="mt-1 text-xs text-gray-400">
                    Assinado por {a.signer_name} ({a.signer_role}) — {a.signer_email} · {a.signer_phone} · CPF {a.signer_cpf}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
