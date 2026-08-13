import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function POST(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { url, path } = await req.json()
  const admin = createAdminClient()

  const { error } = await admin
    .from('organization_settings')
    .update({
      logo_storage_path: path,  // mantém path para compatibilidade
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'default')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  revalidatePath('/suporte')
  revalidatePath('/', 'layout')
  return NextResponse.json({ ok: true, url })
}
