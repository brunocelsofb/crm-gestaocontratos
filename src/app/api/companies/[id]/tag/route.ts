import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { tag_id } = await req.json()
  const admin = createAdminClient()

  await admin.from('company_tags').delete().eq('company_id', companyId)
  if (tag_id) {
    const { error } = await admin.from('company_tags').insert({ company_id: companyId, tag_id })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
