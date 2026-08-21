import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { jobTitle } = await req.json()
  await supabase.from('profiles').update({ job_title: jobTitle || null }).eq('id', user.id)
  return NextResponse.json({ ok: true })
}
