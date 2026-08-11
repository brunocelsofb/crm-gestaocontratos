import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: contractId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Aceita tag_ids (array) ou tag_id (legado single)
  const body = await req.json()
  const tagIds: string[] = body.tag_ids ?? (body.tag_id ? [body.tag_id] : [])

  const admin = createAdminClient()
  await admin.from('contract_tags').delete().eq('contract_id', contractId)

  if (tagIds.length > 0) {
    const rows = tagIds.map(tag_id => ({ contract_id: contractId, tag_id }))
    const { error } = await admin.from('contract_tags').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
