import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { contract_id, type, content } = await req.json()
  if (!contract_id || !content?.trim()) {
    return NextResponse.json({ error: 'contract_id e content são obrigatórios' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('activities').insert({
    contract_id,
    type: type ?? 'note',
    content: content.trim(),
    user_id: user.id,
    is_pinned: false,
  })

  if (error) {
    console.error('[activities POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
