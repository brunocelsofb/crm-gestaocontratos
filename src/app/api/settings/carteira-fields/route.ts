import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { activeFields } = await req.json()
  const admin = createAdminClient()

  // Salva em organization_settings como JSON na coluna carteira_sections
  const { error } = await admin
    .from('organization_settings')
    .upsert({ id: 'default', carteira_active_fields: activeFields }, { onConflict: 'id' })

  if (error) {
    // Tenta como update se upsert falhar por schema
    const { error: e2 } = await admin
      .from('organization_settings')
      .update({ carteira_active_fields: activeFields })
      .eq('id', 'default')
    if (e2) return NextResponse.json({ error: e2.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
