import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recordWhatsAppOptOut } from '@/lib/whatsapp/guardrails'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { phone } = await req.json()
  if (!phone) return NextResponse.json({ error: 'phone obrigatório' }, { status: 400 })
  await recordWhatsAppOptOut(phone)
  return NextResponse.json({ ok: true })
}
