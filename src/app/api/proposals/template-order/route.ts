import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { order, miolo_after_id, service_type } = await req.json()
  if (!order || !Array.isArray(order)) return NextResponse.json({ error: 'order obrigatório' }, { status: 400 })

  const admin = createAdminClient()

  // Reseta is_miolo_after APENAS para o service_type ativo
  if (service_type) {
    await admin.from('proposal_templates')
      .update({ is_miolo_after: false })
      .eq('service_type', service_type)
  }

  // Atualiza sort_order e is_miolo_after de cada template
  for (const { id, sort_order } of order) {
    const patch: Record<string, unknown> = { sort_order }
    if (miolo_after_id && id === miolo_after_id) patch.is_miolo_after = true
    await admin.from('proposal_templates').update(patch).eq('id', id)
  }

  // Posição especial: miolo no início (start) ou fim (end)
  // Salva em organization_settings como JSON por service_type
  if (miolo_after_id === 'start' || miolo_after_id === 'end') {
    const { data: org } = await admin.from('organization_settings').select('miolo_positions').maybeSingle()
    const positions = (org?.miolo_positions as Record<string, string>) ?? {}
    positions[service_type ?? 'clinica'] = miolo_after_id
    await admin.from('organization_settings').update({ miolo_positions: positions }).neq('id', '00000000-0000-0000-0000-000000000000')
  }

  return NextResponse.json({ ok: true })
}
