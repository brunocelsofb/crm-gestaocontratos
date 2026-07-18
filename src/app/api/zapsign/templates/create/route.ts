import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  const name = (formData.get('name') as string)?.trim()
  const zapsign_template_token = (formData.get('zapsign_template_token') as string)?.trim()
  const type = (formData.get('type') as string) || 'contrato'
  const description = (formData.get('description') as string)?.trim() || null

  if (!name || !zapsign_template_token) {
    return NextResponse.redirect(new URL('/zapsign?error=campos-obrigatorios', request.url))
  }

  await supabase.from('zapsign_templates').insert({ name, zapsign_template_token, type, description })
  return NextResponse.redirect(new URL('/zapsign', request.url))
}
