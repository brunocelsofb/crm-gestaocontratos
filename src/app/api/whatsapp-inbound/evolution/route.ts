import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isOptOutMessage, recordWhatsAppOptOut, canSendAutomatedWhatsApp } from '@/lib/whatsapp/guardrails'

// Evolution API webhook — evento: MESSAGES_UPSERT
// Configurar em: Settings > Webhooks no painel da Evolution API
// URL: https://seu-crm.vercel.app/api/whatsapp-inbound/evolution

type EvoMessage = {
  event: string
  instance: string
  data: {
    key: { id: string; remoteJid: string; fromMe: boolean }
    message?: {
      conversation?: string
      extendedTextMessage?: { text: string }
      imageMessage?: { url?: string; caption?: string }
      audioMessage?: { url?: string }
      documentMessage?: { url?: string; fileName?: string; caption?: string }
      videoMessage?: { url?: string; caption?: string }
    }
    messageTimestamp?: number
    pushName?: string
  }
}

function extractText(msg: EvoMessage['data']['message']): string | null {
  if (!msg) return null
  return msg.conversation
    ?? msg.extendedTextMessage?.text
    ?? msg.imageMessage?.caption
    ?? msg.documentMessage?.caption
    ?? msg.videoMessage?.caption
    ?? null
}

type MediaInfo = { url: string; type: 'image' | 'audio' | 'document' | 'video'; filename: string | null }

function extractMedia(msg: EvoMessage['data']['message']): MediaInfo | null {
  if (!msg) return null
  if (msg.imageMessage?.url)    return { url: msg.imageMessage.url, type: 'image', filename: null }
  if (msg.audioMessage?.url)    return { url: msg.audioMessage.url, type: 'audio', filename: null }
  if (msg.videoMessage?.url)    return { url: msg.videoMessage.url, type: 'video', filename: null }
  if (msg.documentMessage?.url) return { url: msg.documentMessage.url, type: 'document', filename: msg.documentMessage.fileName ?? null }
  return null
}

export async function POST(request: Request) {
  const supabase = createAdminClient()
  const body: EvoMessage = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  try {
    // Processa apenas MESSAGES_UPSERT
    const eventName = (body.event ?? '').toLowerCase().replace(/[._]/g, '_')
    if (!['messages_upsert', 'send_message'].includes(eventName)) {
      return NextResponse.json({ ok: true, skipped: body.event })
    }

    const { key, message: msg, messageTimestamp, pushName } = body.data
    if (!key || !msg) return NextResponse.json({ ok: true, skipped: 'no message' })

    // Extrai phone do remoteJid (formato: 5562999999999@s.whatsapp.net)
    const phone = key.remoteJid.replace(/@.*/, '').replace(/\D/g, '')
    if (!phone) return NextResponse.json({ ok: true, skipped: 'no phone' })

    const isFromMe = key.fromMe === true
    const messageId = key.id
    const text = extractText(msg)
    const media = extractMedia(msg)

    // Deduplica mensagens enviadas pelo CRM
    if (isFromMe && messageId) {
      const { data: existing } = await supabase.from('contract_whatsapp_messages').select('id').eq('zapi_message_id', messageId).maybeSingle()
      if (existing) return NextResponse.json({ ok: true, skipped: 'duplicata' })
    }

    // Opt-out
    if (!isFromMe && text && isOptOutMessage(text)) {
      await recordWhatsAppOptOut(phone)
      return NextResponse.json({ ok: true, recorded: 'opt-out' })
    }

    // Busca contato pelo telefone
    const phoneVariants = [phone, phone.replace(/^55/, ''), `55${phone}`, phone.replace(/^(\d{2})(\d)/, '$10$2')]
    const { data: contact } = await supabase.from('contacts').select('id, company_id, contract_contacts(contract_id)').or(phoneVariants.map(p => `phone.eq.${p}`).join(',')).limit(1).maybeSingle()

    const contractId = (contact as any)?.contract_contacts?.[0]?.contract_id ?? null

    await supabase.from('contract_whatsapp_messages').insert({
      contract_id: contractId,
      contact_id: contact?.id ?? null,
      phone,
      message: text ?? (media ? `[${media.type}]` : '[mensagem sem texto]'),
      direction: isFromMe ? 'enviado' : 'recebido',
      status: 'received',
      triggered_automatically: false,
      zapi_message_id: messageId,
      sender_name: pushName ?? null,
      media_url: media?.url ?? null,
      media_type: media?.type ?? null,
      media_filename: media?.filename ?? null,
      created_at: messageTimestamp ? new Date(messageTimestamp * 1000).toISOString() : new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[evo-webhook]', err)
    return NextResponse.json({ ok: true })
  }
}
