import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isOptOutMessage, recordWhatsAppOptOut } from '@/lib/whatsapp/guardrails'

export async function POST(request: Request) {
  const supabase = createAdminClient()

  let body: any
  try {
    body = await request.json()
  } catch (e) {
    console.error('[evo-webhook] JSON parse error:', e)
    return NextResponse.json({ ok: false, error: 'invalid json' })
  }

  console.log('[evo-webhook] payload:', JSON.stringify(body, null, 2))

  try {
    // Normaliza event name: MESSAGES_UPSERT, messages.upsert, send_message, etc.
    const eventRaw = body?.event ?? body?.type ?? ''
    const event = eventRaw.toLowerCase().replace(/[.\-]/g, '_')
    console.log('[evo-webhook] event normalizado:', event)

    if (!['messages_upsert', 'send_message'].includes(event)) {
      return NextResponse.json({ ok: true, skipped: `event=${eventRaw}` })
    }

    // Extrai dados — Evolution v2 com webhookByEvents
    const msgData = body?.data ?? body
    const key = msgData?.key
    const msg = msgData?.message
    const pushName = msgData?.pushName ?? msgData?.sender ?? null
    const messageTimestamp = msgData?.messageTimestamp ?? null

    console.log('[evo-webhook] key:', JSON.stringify(key))
    console.log('[evo-webhook] message:', JSON.stringify(msg))

    if (!key?.remoteJid) {
      console.warn('[evo-webhook] sem remoteJid, ignorando')
      return NextResponse.json({ ok: true, skipped: 'no remoteJid' })
    }

    // Ignora mensagens de grupo
    if (key.remoteJid.endsWith('@g.us')) {
      return NextResponse.json({ ok: true, skipped: 'group message' })
    }

    const phone = key.remoteJid.replace(/@.*/, '').replace(/\D/g, '')
    if (!phone) return NextResponse.json({ ok: true, skipped: 'no phone' })

    const isFromMe = key.fromMe === true
    const messageId = key.id

    // Extrai texto
    const text =
      msg?.conversation ??
      msg?.extendedTextMessage?.text ??
      msg?.imageMessage?.caption ??
      msg?.documentMessage?.caption ??
      msg?.videoMessage?.caption ??
      null

    // Extrai mídia
    let mediaUrl: string | null = null
    let mediaType: string | null = null
    let mediaFilename: string | null = null
    if (msg?.imageMessage?.url)    { mediaUrl = msg.imageMessage.url;    mediaType = 'image' }
    if (msg?.audioMessage?.url)    { mediaUrl = msg.audioMessage.url;    mediaType = 'audio' }
    if (msg?.videoMessage?.url)    { mediaUrl = msg.videoMessage.url;    mediaType = 'video' }
    if (msg?.documentMessage?.url) { mediaUrl = msg.documentMessage.url; mediaType = 'document'; mediaFilename = msg.documentMessage.fileName ?? null }

    const messageText = text ?? (mediaType ? `[${mediaType}]` : '[mensagem]')
    console.log('[evo-webhook] phone:', phone, '| fromMe:', isFromMe, '| text:', messageText)

    // Deduplicação
    if (messageId) {
      const { data: dup } = await supabase
        .from('contract_whatsapp_messages')
        .select('id')
        .eq('zapi_message_id', messageId)
        .maybeSingle()
      if (dup) {
        console.log('[evo-webhook] duplicata ignorada:', messageId)
        return NextResponse.json({ ok: true, skipped: 'duplicata' })
      }
    }

    // Opt-out
    if (!isFromMe && text && isOptOutMessage(text)) {
      await recordWhatsAppOptOut(phone)
      console.log('[evo-webhook] opt-out registrado:', phone)
      return NextResponse.json({ ok: true, recorded: 'opt-out' })
    }

    // Busca contato e contrato associados ao telefone
    const phoneVariants = [phone, phone.replace(/^55/, ''), `55${phone}`].filter(Boolean)
    console.log('[evo-webhook] buscando contato para variantes:', phoneVariants)

    let contactId: string | null = null
    let contractId: string | null = null

    const { data: contact } = await supabase
      .from('contacts')
      .select('id, company_id, contract_contacts(contract_id)')
      .or(phoneVariants.map(p => `phone.eq.${p}`).join(','))
      .limit(1)
      .maybeSingle()

    if (contact) {
      contactId = contact.id
      contractId = (contact as any)?.contract_contacts?.[0]?.contract_id ?? null
      console.log('[evo-webhook] contato encontrado:', contactId, '| contrato:', contractId)
    } else {
      console.log('[evo-webhook] contato não encontrado para:', phone)
    }

    // Salva mensagem
    const { error: insertError, data: inserted } = await supabase
      .from('contract_whatsapp_messages')
      .insert({
        contract_id: contractId,
        phone,
        message: messageText,
        direction: isFromMe ? 'enviado' : 'recebido',
        triggered_automatically: false,
        zapi_message_id: messageId ?? null,
        unlinked_sender_name: pushName,
        media_url: mediaUrl,
        media_type: mediaType,
        media_filename: mediaFilename,
        created_at: messageTimestamp
          ? new Date(Number(messageTimestamp) * 1000).toISOString()
          : new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[evo-webhook] ERRO ao salvar mensagem:', insertError)
      return NextResponse.json({ ok: false, error: insertError.message })
    }

    console.log('[evo-webhook] mensagem salva:', inserted?.id)
    return NextResponse.json({ ok: true, id: inserted?.id })

  } catch (err: any) {
    console.error('[evo-webhook] ERRO FATAL:', err)
    return NextResponse.json({ ok: false, error: err?.message ?? 'erro desconhecido' })
  }
}
