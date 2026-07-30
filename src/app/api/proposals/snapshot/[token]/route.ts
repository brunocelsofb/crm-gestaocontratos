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

  const { data } = await admin
    .from('proposal_status')
    .select(`
      review_token,
      status,
      technical_snapshot,
      contracts(id, client_name, title, process_number)
    `)
    .eq('review_token', token)
    .maybeSingle()

  if (!data) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 404, headers: CORS })
  }

  return NextResponse.json({
    token,
    status: data.status,
    snapshot: data.technical_snapshot,
    contract: (data as any).contracts,
    review_url: `https://crm-gestaocontratos-pi.vercel.app/api/proposals/review`,
  }, { headers: CORS })
}
