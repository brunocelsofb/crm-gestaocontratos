import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

export async function POST(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const { contract_id } = await req.json()
  const admin = createAdminClient()

  // Busca token existente
  const { data: existing } = await admin
    .from('proposal_status')
    .select('client_review_token')
    .eq('contract_id', contract_id)
    .maybeSingle()

  // Reusa token existente ou gera novo
  const token = existing?.client_review_token ?? randomBytes(24).toString('hex')

  if (!existing?.client_review_token) {
    await admin.from('proposal_status')
      .update({ client_review_token: token })
      .eq('contract_id', contract_id)
  }

  return NextResponse.json({ token })
}
