import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Caminho ausente.' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase.storage.from('proposal-files').download(path)

  if (error || !data) {
    return NextResponse.json({ error: 'Logo não encontrado.' }, { status: 404 })
  }

  const buffer = await data.arrayBuffer()
  const contentType = path.endsWith('.png') ? 'image/png' : 'image/jpeg'

  return new NextResponse(Buffer.from(buffer), {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=3600' },
  })
}
