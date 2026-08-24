import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { phone, name } = await req.json()
  const cleanPhone = (phone ?? '').replace(/\D/g, '')

  // Verifica se já existe lead com esse telefone
  const { data: existing } = await supabase
    .from('leads')
    .select('id')
    .ilike('phone', `%${cleanPhone.slice(-10)}`)
    .limit(1)
    .maybeSingle()

  if (existing) return NextResponse.json({ leadId: existing.id })

  // Cria novo lead
  const { data: lead, error } = await supabase
    .from('leads')
    .insert({ name: name || phone, phone: cleanPhone, status: 'aberto' })
    .select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leadId: lead.id })
}
