import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function POST(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { path, base64, mimeType } = await req.json()
  const admin = createAdminClient()

  // Upload server-side com service_role (bypassa RLS)
  const buffer = Buffer.from(base64, 'base64')
  const { error: uploadError } = await admin.storage
    .from('public-assets')
    .upload(path, buffer, { contentType: mimeType, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

  const { data: { publicUrl } } = admin.storage.from('public-assets').getPublicUrl(path)

  const { error } = await admin
    .from('organization_settings')
    .update({ logo_storage_path: path, updated_at: new Date().toISOString() })
    .eq('id', 'default')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  revalidatePath('/suporte')
  revalidatePath('/', 'layout')
  return NextResponse.json({ ok: true, url: publicUrl })
}
