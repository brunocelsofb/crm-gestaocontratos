import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const fd = await req.formData()
  const name = fd.get('name') as string
  const pageCount = Number(fd.get('page_count') ?? 1)
  const file = fd.get('file') as File
  if (!file || !name) return NextResponse.json({ error: 'Campos obrigatórios' }, { status: 400 })

  const admin = createAdminClient()
  const fileName = file.name
  const filePath = `templates/${Date.now()}-${fileName}`

  // Upload para o Storage
  const bytes = await file.arrayBuffer()
  const { error: upErr } = await admin.storage.from('proposal-files').upload(filePath, bytes, { contentType: 'application/pdf' })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

  // Registra no banco
  await admin.from('proposal_templates').insert({ name, file_storage_path: filePath, file_name: fileName, page_count: pageCount, created_by: user.id })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data: t } = await admin.from('proposal_templates').select('file_storage_path').eq('id', id).maybeSingle()
  if (t?.file_storage_path) await admin.storage.from('proposal-files').remove([t.file_storage_path])
  await admin.from('proposal_templates').delete().eq('id', id)

  return NextResponse.json({ ok: true })
}
