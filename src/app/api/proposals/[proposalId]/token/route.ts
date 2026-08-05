import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ proposalId: string }> }
) {
  const { proposalId } = await params
  const admin = createAdminClient()
  const { data } = await admin
    .from('proposals')
    .select('review_token')
    .eq('id', proposalId)
    .maybeSingle()
  return NextResponse.json({ review_token: data?.review_token ?? null })
}
