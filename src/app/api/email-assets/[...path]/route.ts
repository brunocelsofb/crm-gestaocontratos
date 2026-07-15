import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Serve arquivos do bucket "proposal-files" (pasta signatures/) SEM
// exigir login — precisa ser público porque quem carrega essa imagem
// é o cliente de e-mail de quem RECEBEU o e-mail, não alguém logado
// no CRM.
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const fullPath = path.join('/')

  if (!fullPath.startsWith('signatures/')) {
    return NextResponse.json({ error: 'Caminho inválido.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.storage.from('proposal-files').download(fullPath)

  if (error || !data) {
    return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 })
  }

  const buffer = await data.arrayBuffer()
  const ext = fullPath.toLowerCase().split('.').pop()
  const contentType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg'

  return new NextResponse(Buffer.from(buffer), {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
  })
}
