import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { order, miolo_after_id } = await req.json()
  const admin = createAdminClient()

  // Reseta is_miolo_after
  await admin.from('proposal_templates').update({ is_miolo_after: false })

  // Atualiza ordem e miolo_after
  for (const { id, sort_order } of order) {
    const patch: any = { sort_order }
    if (id === miolo_after_id) patch.is_miolo_after = true
    await admin.from('proposal_templates').update(patch).eq('id', id)
  }

  // Caso especial: miolo no início ou fim (sem template)
  if (miolo_after_id === 'start' || miolo_after_id === 'end') {
    await admin.from('company_settings').upsert({ miolo_position: miolo_after_id })
  }

  return NextResponse.json({ ok: true })
}
