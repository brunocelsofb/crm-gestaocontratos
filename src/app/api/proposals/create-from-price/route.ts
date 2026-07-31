import { NextResponse } from 'next/server'
import { createProposalFromPrice } from '@/lib/actions/proposals'

export async function POST(req: Request) {
  const { contract_id } = await req.json()
  if (!contract_id) return NextResponse.json({ error: 'contract_id obrigatório' }, { status: 400 })

  const result = await createProposalFromPrice(contract_id)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ proposal_id: result.proposalId })
}
