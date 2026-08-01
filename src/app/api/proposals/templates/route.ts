import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { addProposalTemplate } from '@/lib/actions/proposals'

export async function POST(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const fd = await req.formData()
  const name = fd.get('name') as string
  const pageCount = Number(fd.get('page_count') ?? 1)
  const file = fd.get('file') as File

  const fakeFormData = new FormData()
  fakeFormData.set('name', name)
  fakeFormData.set('page_count', String(pageCount))
  fakeFormData.set('file', file)

  const result = await addProposalTemplate(fakeFormData)
  if (result?.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
