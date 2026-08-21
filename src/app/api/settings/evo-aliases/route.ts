import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function guardAdmin() {
  const s = await createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return false
  const { data: p } = await s.from('profiles').select('role').eq('id', user.id).maybeSingle()
  return p?.role === 'admin'
}

export async function GET() {
  const admin = createAdminClient()
  const { data } = await admin.from('organization_settings')
    .select('evo_instance_aliases').eq('id', 'default').maybeSingle()
  return NextResponse.json({ aliases: (data as any)?.evo_instance_aliases ?? {} })
}

export async function POST(req: Request) {
  if (!await guardAdmin()) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  const admin = createAdminClient()
  const { instanceName, alias } = await req.json()
  if (!instanceName) return NextResponse.json({ error: 'instanceName obrigatório' }, { status: 400 })
  const { data: current } = await admin.from('organization_settings')
    .select('evo_instance_aliases').eq('id', 'default').maybeSingle()
  const existing = (current as any)?.evo_instance_aliases ?? {}
  const updated = { ...existing, [instanceName]: alias || null }
  await admin.from('organization_settings').update({ evo_instance_aliases: updated }).eq('id', 'default')
  return NextResponse.json({ ok: true, aliases: updated })
}
