import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Proxy de mídia — busca imagem/áudio/vídeo via Evolution API e retorna ao browser
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const messageId = searchParams.get('id')
  const instanceName = searchParams.get('instance')

  if (!messageId) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data: org } = await admin
    .from('organization_settings')
    .select('evo_server_url, evo_api_key, evo_instance_name')
    .eq('id', 'default').maybeSingle()

  if (!org?.evo_server_url) return NextResponse.json({ error: 'Evolution não configurada' }, { status: 400 })

  const instance = instanceName ?? org.evo_instance_name
  try {
    const res = await fetch(`${org.evo_server_url}/chat/getBase64FromMediaMessage/${instance}`, {
      method: 'POST',
      headers: { 'apikey': org.evo_api_key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { key: { id: messageId } }, convertToMp4: false }),
    })
    const data = await res.json()
    const base64 = data?.base64 ?? data?.data
    const mime = data?.mimetype ?? 'image/jpeg'
    if (!base64) return NextResponse.json({ error: 'Mídia não disponível' }, { status: 404 })

    const buffer = Buffer.from(base64, 'base64')
    return new NextResponse(buffer, {
      headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=86400' },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
