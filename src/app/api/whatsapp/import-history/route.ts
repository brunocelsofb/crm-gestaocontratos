import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { phone, instanceName } = await req.json()
  if (!phone) return NextResponse.json({ error: 'phone obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data: org } = await admin
    .from('organization_settings')
    .select('evo_server_url, evo_api_key, evo_instance_name')
    .eq('id', 'default')
    .maybeSingle()

  if (!org?.evo_server_url || !org?.evo_api_key) {
    return NextResponse.json({ error: 'Evolution API não configurada' }, { status: 400 })
  }

  const instance = instanceName ?? org.evo_instance_name
  const cleanPhone = phone.replace(/\D/g, '')

  // Busca histórico na Evolution API
  let evoMessages: any[] = []
  try {
    const res = await fetch(`${org.evo_server_url}/chat/findMessages/${instance}`, {
      method: 'POST',
      headers: { 'apikey': org.evo_api_key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        where: { key: { remoteJid: `${cleanPhone}@s.whatsapp.net` } },
        limit: 200,
      }),
    })
    const data = await res.json().catch(() => ({}))
    console.log('[import-history] evo status:', res.status, 'count:', Array.isArray(data?.messages) ? data.messages.length : Array.isArray(data) ? data.length : 0)
    evoMessages = data?.messages ?? (Array.isArray(data) ? data : [])
  } catch (e: any) {
    return NextResponse.json({ error: `Falha ao buscar histórico: ${e.message}` }, { status: 500 })
  }

  if (!evoMessages.length) {
    return NextResponse.json({ ok: true, imported: 0, message: 'Nenhuma mensagem encontrada na Evolution API.' })
  }

  // Prepara upsert em lote
  const rows = evoMessages.map((m: any) => {
    const key = m.key ?? m
    const msg = m.message ?? {}
    const text =
      msg.conversation ??
      msg.extendedTextMessage?.text ??
      msg.imageMessage?.caption ??
      msg.documentMessage?.caption ??
      null

    let mediaType: string | null = null
    let mediaUrl: string | null = null
    let mediaFilename: string | null = null
    if (msg.imageMessage)    { mediaType = 'image';    mediaUrl = msg.imageMessage.url ?? null }
    if (msg.audioMessage)    { mediaType = 'audio';    mediaUrl = msg.audioMessage.url ?? null }
    if (msg.videoMessage)    { mediaType = 'video';    mediaUrl = msg.videoMessage.url ?? null }
    if (msg.documentMessage) { mediaType = 'document'; mediaUrl = msg.documentMessage.url ?? null; mediaFilename = msg.documentMessage.fileName ?? null }

    const ts = m.messageTimestamp ?? m.messageStamp ?? null

    return {
      phone: cleanPhone,
      message: text ?? (mediaType ? `[${mediaType}]` : '[mensagem]'),
      direction: key.fromMe ? 'enviado' : 'recebido',
      status: key.fromMe ? 'enviado' : null,
      zapi_message_id: key.id ?? null,
      media_url: mediaUrl,
      media_type: mediaType,
      media_filename: mediaFilename,
      triggered_automatically: false,
      created_at: ts ? new Date(Number(ts) * 1000).toISOString() : new Date().toISOString(),
    }
  }).filter(r => r.zapi_message_id) // só insere mensagens com ID único

  // Upsert ignorando duplicatas por zapi_message_id
  const { error } = await admin
    .from('contract_whatsapp_messages')
    .upsert(rows, { onConflict: 'zapi_message_id', ignoreDuplicates: true })

  if (error) {
    console.error('[import-history] erro upsert:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, imported: rows.length })
}
