import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  await supabase.from('zapsign_templates').delete().eq('id', id)
  return NextResponse.redirect(new URL('/zapsign', request.url))
}
