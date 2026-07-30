import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

export async function POST(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { contract_id } = await req.json()
  const token = randomBytes(24).toString('hex')
  const admin = createAdminClient()
  await admin.from('proposal_status').update({ client_review_token: token }).eq('contract_id', contract_id)
  return NextResponse.json({ token })
}
