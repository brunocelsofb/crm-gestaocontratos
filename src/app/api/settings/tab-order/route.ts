import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const admin = createAdminClient()
  const { data } = await admin.from('organization_settings').select('contract_tab_order').eq('id', 'default').maybeSingle()
  return NextResponse.json({ order: (data as any)?.contract_tab_order ?? null })
}

export async function POST(req: Request) {
  const { order } = await req.json()
  const admin = createAdminClient()
  await admin.from('organization_settings').update({ contract_tab_order: order }).eq('id', 'default')
  return NextResponse.json({ ok: true })
}
