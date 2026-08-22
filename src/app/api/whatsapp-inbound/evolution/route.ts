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
    const instanceName = body?.instance ?? body?.instanceName ?? null
    console.log('[evo-webhook] event:', event, '| instance:', instanceName)

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

    if (msg?.imageMessage)    { mediaType = 'image';    mediaFilename = null }
    if (msg?.audioMessage)    { mediaType = 'audio';    mediaFilename = null }
    if (msg?.videoMessage)    { mediaType = 'video';    mediaFilename = null }
    if (msg?.documentMessage) { mediaType = 'document'; mediaFilename = msg.documentMessage.fileName ?? null }

    // Tenta extrair URL direta (pode ser pública ou interna)
    const rawUrl =
      msg?.imageMessage?.url ??
      msg?.audioMessage?.url ??
      msg?.videoMessage?.url ??
      msg?.documentMessage?.url ??
      null

    // Tenta base64 direto no payload (webhookBase64: true)
    const rawBase64 =
      msg?.imageMessage?.base64 ??
      msg?.audioMessage?.base64 ??
      msg?.videoMessage?.base64 ??
      msg?.documentMessage?.base64 ??
      null

    if (rawBase64 && mediaType) {
      const mime = mediaType === 'image' ? 'jpeg' : mediaType === 'audio' ? 'ogg' : mediaType === 'video' ? 'mp4' : 'octet-stream'
      mediaUrl = `data:${mediaType}/${mime};base64,${rawBase64}`
    } else if (rawUrl && mediaType && messageId) {
      // Baixa mídia via Evolution API e salva como base64
      try {
        const admin = createAdminClient()
        const { data: orgSettings } = await admin
          .from('organization_settings')
          .select('evo_server_url, evo_api_key, evo_instance_name')
          .eq('id', 'default')
          .maybeSingle()

        if (orgSettings?.evo_server_url && orgSettings?.evo_api_key && orgSettings?.evo_instance_name) {
          const dlRes = await fetch(
            `${orgSettings.evo_server_url}/chat/getBase64FromMediaMessage/${orgSettings.evo_instance_name}`,
            {
              method: 'POST',
              headers: { 'apikey': orgSettings.evo_api_key, 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: { key }, convertToMp4: false }),
            }
          )
          if (dlRes.ok) {
            const dlData = await dlRes.json().catch(() => ({}))
            const b64 = dlData?.base64 ?? dlData?.data ?? null
            if (b64) {
              const mime = mediaType === 'image' ? 'jpeg' : mediaType === 'audio' ? 'ogg' : mediaType === 'video' ? 'mp4' : 'octet-stream'
              mediaUrl = `data:${mediaType}/${mime};base64,${b64}`
              console.log('[evo-webhook] mídia baixada via getBase64:', mediaType)
            }
          }
        }
      } catch (e) {
        console.warn('[evo-webhook] falha ao baixar mídia:', e)
        mediaUrl = rawUrl // fallback para URL original
      }
    }

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
        status: isFromMe ? 'enviado' : 'recebido',
        triggered_automatically: false,
        zapi_message_id: messageId ?? null,
        unlinked_sender_name: pushName,
        instance_name: instanceName,
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

    // Bot de triagem — dispara apenas em PRIMEIRO contato ou nova sessão
    if (!isFromMe) {
      try {
        // Verifica se é primeira mensagem (nenhuma msg salva antes desta)
        const { count: prevCount } = await supabase
          .from('contract_whatsapp_messages')
          .select('id', { count: 'exact', head: true })
          .eq('phone', phone)
          .lt('created_at', inserted?.id ? new Date().toISOString() : new Date(0).toISOString())

        const { data: convStatus } = await supabase
          .from('whatsapp_conversation_status')
          .select('is_archived')
          .eq('phone', phone)
          .maybeSingle()

        const isFirstContact = (prevCount ?? 0) <= 1 // só esta mensagem existe
        const wasArchived = convStatus?.is_archived === true

        if (isFirstContact || wasArchived) {
          // Busca configurações do bot
          const { data: botCfg } = await supabase
            .from('organization_settings')
            .select('company_name, whatsapp_is_online, whatsapp_welcome_message, whatsapp_welcome_message_online, evo_server_url, evo_api_key, evo_instance_name')
            .eq('id', 'default')
            .maybeSingle()

          if (botCfg) {
            const rawMsg = botCfg.whatsapp_is_online
              ? (botCfg.whatsapp_welcome_message_online ?? botCfg.whatsapp_welcome_message)
              : botCfg.whatsapp_welcome_message

            if (rawMsg && botCfg.evo_server_url && botCfg.evo_api_key) {
              const instName = instanceName ?? botCfg.evo_instance_name
              const company = botCfg.company_name ?? 'nossa empresa'
              const finalMsg = rawMsg
                .replace(/\{\{empresa\}\}/gi, company)
                .replace(/\{\{company\}\}/gi, company)
                .replace(/\{\{link\}\}/gi, `https://crm-gestaocontratos-pi.vercel.app/captura`)

              // Dispara bot de forma assíncrona (não bloqueia resposta)
              fetch(`${botCfg.evo_server_url}/message/sendText/${instName}`, {
                method: 'POST',
                headers: { 'apikey': botCfg.evo_api_key, 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: phone, text: finalMsg }),
              }).catch(e => console.warn('[evo-webhook] bot falhou ao enviar:', e))

              // Garante que a conversa aparece como aberta na sidebar
              if (wasArchived) {
                await supabase
                  .from('whatsapp_conversation_status')
                  .update({ is_archived: false, updated_at: new Date().toISOString() })
                  .eq('phone', phone)
              }

              console.log('[evo-webhook] bot disparado para:', phone, '| online:', botCfg.whatsapp_is_online)
            }
          }
        }
      } catch (e) {
        console.warn('[evo-webhook] erro no bot de triagem:', e)
      }
    }

    return NextResponse.json({ ok: true, id: inserted?.id })

  } catch (err: any) {
    console.error('[evo-webhook] ERRO FATAL:', err)
    return NextResponse.json({ ok: false, error: err?.message ?? 'erro desconhecido' })
  }
}
