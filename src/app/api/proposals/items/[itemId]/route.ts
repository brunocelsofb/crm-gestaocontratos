import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { itemId } = await params
  const admin = createAdminClient()
  await admin.from('proposal_items').delete().eq('id', itemId)
  return NextResponse.json({ ok: true })
}
