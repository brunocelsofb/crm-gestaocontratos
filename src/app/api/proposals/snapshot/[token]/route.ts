import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const CORS = {
  'Access-Control-Allow-Origin': 'https://orbis-price.vercel.app',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const admin = createAdminClient()

  // Busca primeiro em proposals (novo modelo 1:N)
  const { data: proposal } = await admin
    .from('proposals')
    .select('id, review_token, workflow_status, technical_snapshot')
    .eq('review_token', token)
    .maybeSingle()

  if (proposal) {
    return NextResponse.json({
      token,
      status: proposal.workflow_status,
      snapshot: proposal.technical_snapshot,
      review_url: `https://crm-gestaocontratos-pi.vercel.app/api/proposals/review`,
    }, { headers: CORS })
  }

  // Fallback: busca em proposal_status (modelo legado)
  const { data: legacy } = await admin
    .from('proposal_status')
    .select('review_token, status, technical_snapshot')
    .eq('review_token', token)
    .maybeSingle()

  if (!legacy) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 404, headers: CORS })
  }

  return NextResponse.json({
    token,
    status: legacy.status,
    snapshot: legacy.technical_snapshot,
    review_url: `https://crm-gestaocontratos-pi.vercel.app/api/proposals/review`,
  }, { headers: CORS })
}
