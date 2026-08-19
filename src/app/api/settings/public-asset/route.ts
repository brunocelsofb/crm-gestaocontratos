import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const ALLOWED_COLS = ['support_bg_url','nps_bg_url','survey_clinica_bg_url','survey_hospitalar_bg_url','lead_bg_url']

export async function POST(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { url, column } = await req.json()
  if (!ALLOWED_COLS.includes(column))
    return NextResponse.json({ error: 'Coluna não permitida' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('organization_settings').update({ [column]: url || null }).eq('id', 'default')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  revalidatePath('/nps', 'layout')
  revalidatePath('/survey', 'layout')
  revalidatePath('/suporte')
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { column } = await req.json()
  if (!ALLOWED_COLS.includes(column))
    return NextResponse.json({ error: 'Coluna não permitida' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('organization_settings').update({ [column]: null }).eq('id', 'default')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  revalidatePath('/suporte')
  revalidatePath('/nps', 'layout')
  revalidatePath('/survey', 'layout')
  revalidatePath('/(auth)/login', 'layout')
  return NextResponse.json({ ok: true })
}
