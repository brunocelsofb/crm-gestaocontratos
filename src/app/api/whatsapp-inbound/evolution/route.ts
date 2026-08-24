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

    // Extrai dados — Evolution v2 suporta múltiplos formatos
    // Pode vir como body.data (objeto), body.data[0] (array) ou body direto
    const msgData = Array.isArray(body?.data) ? body.data[0] : (body?.data ?? body)
    const key = msgData?.key ?? msgData?.message?.key
    const msg = msgData?.message ?? msgData?.data?.message ?? null
    const pushName = msgData?.pushName
      ?? msgData?.contact?.name         // contato salvo na agenda
      ?? msgData?.contact?.pushName
      ?? msgData?.verifiedBizName
      ?? null
    const messageTimestamp = msgData?.messageTimestamp ?? msgData?.data?.messageTimestamp ?? null

    console.log('[evo-webhook] key:', JSON.stringify(key))
    console.log('[evo-webhook] msg keys:', msg ? Object.keys(msg) : 'null')

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

    // Extrai texto — cobre todos os tipos de mensagem da Evolution API
    const text =
      msg?.conversation ??                          // texto simples
      msg?.extendedTextMessage?.text ??             // texto com formatação/reply
      msg?.imageMessage?.caption ??                 // legenda de imagem
      msg?.videoMessage?.caption ??                 // legenda de vídeo
      msg?.documentMessage?.caption ??              // legenda de documento
      msg?.documentWithCaptionMessage?.message?.documentMessage?.caption ?? // doc+caption
      msg?.buttonsMessage?.contentText ??           // botões
      msg?.listMessage?.description ??              // lista
      msg?.templateMessage?.hydratedTemplate?.hydratedContentText ?? // template
      msg?.ephemeralMessage?.message?.conversation ?? // mensagem efêmera
      msg?.viewOnceMessage?.message?.imageMessage?.caption ?? // visualizar uma vez
      msg?.reactionMessage?.text ??                // reação (emoji)
      null

    // Extrai mídia
    let mediaUrl: string | null = null
    let mediaType: string | null = null
    let mediaFilename: string | null = null

    const FRIENDLY: Record<string, string> = {
      image: '[Imagem]', audio: '[Áudio]', video: '[Vídeo]',
      document: '[Documento]', sticker: '[Figurinha]', contact: '[Contato]',
      location: '[Localização]',
    }

    if (msg?.imageMessage)    { mediaType = 'image' }
    if (msg?.audioMessage)    { mediaType = 'audio' }
    if (msg?.videoMessage)    { mediaType = 'video' }
    if (msg?.documentMessage) { mediaType = 'document'; mediaFilename = msg.documentMessage.fileName ?? null }
    if (msg?.stickerMessage)  { mediaType = 'sticker' }
    if (msg?.contactMessage)  { mediaType = 'contact' }
    if (msg?.locationMessage) { mediaType = 'location' }

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

    const messageText = text ?? (mediaType ? (FRIENDLY[mediaType] ?? `[${mediaType}]`) : '[mensagem]')
    console.log('[evo-webhook] phone:', phone, '| fromMe:', isFromMe, '| mediaType:', mediaType, '| text:', messageText?.slice(0, 80))

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
        unlinked_sender_name: isFromMe ? null : pushName,
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

    // Reabre conversa arquivada — lê status ANTES de atualizar (evita race condition)
    if (!isFromMe) {
      // 1. Lê status atual e conta mensagens anteriores em paralelo
      const [{ data: convStatus }, { count: prevCount }] = await Promise.all([
        supabase.from('whatsapp_conversation_status').select('is_archived').eq('phone', phone).maybeSingle(),
        supabase.from('contract_whatsapp_messages').select('id', { count: 'exact', head: true })
          .eq('phone', phone).lt('created_at', new Date().toISOString()),
      ])

      const wasArchived = convStatus?.is_archived === true
      const isFirstContact = (prevCount ?? 0) <= 1

      // 2. Atualiza para aberto
      await supabase.from('whatsapp_conversation_status').upsert({
        phone, is_archived: false, archived_at: null, archived_by: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'phone' })

      // 3. Bot de triagem — só dispara em primeiro contato ou reabertura
      if (isFirstContact || wasArchived) {
        try {
          const { data: botCfg } = await supabase
            .from('organization_settings')
            .select('company_name, whatsapp_is_online, whatsapp_welcome_message, whatsapp_welcome_message_online, evo_server_url, evo_api_key, evo_instance_name')
            .eq('id', 'default').maybeSingle()

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
                .replace(/\{\{link\}\}/gi, 'https://crm-gestaocontratos-pi.vercel.app/captura')

              fetch(`${botCfg.evo_server_url}/message/sendText/${instName}`, {
                method: 'POST',
                headers: { 'apikey': botCfg.evo_api_key, 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: phone, text: finalMsg }),
              }).then(r => console.log('[evo-webhook] bot status:', r.status))
                .catch(e => console.error('[evo-webhook] bot ERRO:', e))

              console.log('[evo-webhook] bot agendado | wasArchived:', wasArchived, '| isFirst:', isFirstContact)
            }
          }
        } catch (e) {
          console.warn('[evo-webhook] erro no bot:', e)
        }
      }
    }

    console.log('[evo-webhook] mensagem salva:', inserted?.id)
    return NextResponse.json({ ok: true, id: inserted?.id })

  } catch (err: any) {
    console.error('[evo-webhook] ERRO FATAL:', err)
    return NextResponse.json({ ok: false, error: err?.message ?? 'erro desconhecido' })
  }
}
