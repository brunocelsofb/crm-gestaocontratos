import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const admin = createAdminClient()

  // Busca pelo client_review_token
  const { data: proposalStatus } = await admin
    .from('proposal_status')
    .select('*')
    .eq('client_review_token', token)
    .maybeSingle()

  if (!proposalStatus) {
    return NextResponse.json({ error: 'Token invalido' }, { status: 404 })
  }

  const contractId = proposalStatus.contract_id

  // Busca a proposta mais recente do sistema de julho para este contrato
  const { data: proposal } = await admin
    .from('proposals')
    .select('id')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!proposal?.id) {
    return NextResponse.json({ error: 'Proposta nao encontrada. Monte a proposta primeiro na aba Propostas.' }, { status: 404 })
  }

  try {
    const { buildMergedProposalBytes } = await import('@/lib/actions/proposal-pdf-merge')
    const result = await buildMergedProposalBytes(proposal.id)

    if (result.error || !result.bytes) {
      return NextResponse.json({ error: result.error ?? 'Erro ao gerar PDF' }, { status: 500 })
    }

    return new NextResponse(Buffer.from(result.bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="proposta.pdf"',
      }
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 })
  }
}
