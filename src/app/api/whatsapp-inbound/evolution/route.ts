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

    if (!['messages_upsert'].includes(event)) {
      return NextResponse.json({ ok: true, skipped: `event=${eventRaw}` })
    }

    // Extrai dados
    const msgData = Array.isArray(body?.data) ? body.data[0] : (body?.data ?? body)
    const key = msgData?.key ?? msgData?.message?.key
    const msg = msgData?.message ?? msgData?.data?.message ?? null
    const pushName = msgData?.contactName ?? msgData?.pushName ?? msgData?.contact?.name ?? null
    const messageTimestamp = msgData?.messageTimestamp ?? msgData?.data?.messageTimestamp ?? null

    console.log('[evo-webhook] key:', JSON.stringify(key))
    console.log('[evo-webhook] msg keys:', msg ? Object.keys(msg) : 'null')

    if (!key?.remoteJid) return NextResponse.json({ ok: true, skipped: 'no remoteJid' })
    if (key.remoteJid.endsWith('@g.us')) return NextResponse.json({ ok: true, skipped: 'group' })

    const phone = key.remoteJid.replace(/@.*/, '').replace(/\D/g, '')
    if (!phone) return NextResponse.json({ ok: true, skipped: 'no phone' })

    const isFromMe = key.fromMe === true
    const messageId = key.id

    // Ignora mensagens enviadas por nós via API (já salvas pela Server Action)
    // Só processa mensagens recebidas de clientes
    if (isFromMe) {
      console.log('[evo-webhook] ignorando fromMe (já salvo pela action):', messageId)
      return NextResponse.json({ ok: true, skipped: 'fromMe' })
    }

    // Extrai texto — cobre todos os tipos de mensagem da Evolution API
    const text =
      msg?.conversation ??                          // texto simples recebido
      msg?.extendedTextMessage?.text ??             // texto com formatação/reply
      msg?.imageMessage?.caption ??                 // legenda de imagem
      msg?.videoMessage?.caption ??                 // legenda de vídeo
      msg?.documentMessage?.caption ??              // legenda de documento
      msg?.documentWithCaptionMessage?.message?.documentMessage?.caption ??
      msg?.buttonsMessage?.contentText ??
      msg?.listMessage?.description ??
      msg?.templateMessage?.hydratedTemplate?.hydratedContentText ??
      msg?.ephemeralMessage?.message?.conversation ??
      msg?.viewOnceMessage?.message?.imageMessage?.caption ??
      msg?.reactionMessage?.text ??
      // Formatos alternativos da Evolution v2
      msgData?.body ??                              // campo body direto
      msgData?.text ??                              // campo text direto
      msgData?.content ??                           // campo content
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

    console.log('[evo-webhook] mediaType detectado:', mediaType)

    const rawUrl =
      msg?.imageMessage?.url ?? msg?.audioMessage?.url ??
      msg?.videoMessage?.url ?? msg?.documentMessage?.url ??
      msg?.stickerMessage?.url ?? null

    const rawBase64 =
      msg?.imageMessage?.base64 ?? msg?.audioMessage?.base64 ??
      msg?.videoMessage?.base64 ?? msg?.documentMessage?.base64 ??
      msg?.stickerMessage?.base64 ?? null

    console.log('[evo-webhook] rawUrl:', rawUrl?.slice(0, 80) ?? null, '| base64 presente:', !!rawBase64)

    // ── Mídia: tenta salvar no Storage, nunca aborta o insert ──
    if (mediaType && (rawBase64 || (rawUrl && messageId))) {
      try {
        const admin = createAdminClient()
        let b64: string | null = rawBase64 ?? null
        let mimeType = mediaType === 'image' ? 'image/jpeg'
          : mediaType === 'sticker' ? 'image/webp'
          : mediaType === 'audio' ? 'audio/ogg'
          : mediaType === 'video' ? 'video/mp4'
          : 'application/octet-stream'
        const ext = mediaType === 'image' ? 'jpg'
          : mediaType === 'sticker' ? 'webp'
          : mediaType === 'audio' ? 'ogg'
          : mediaType === 'video' ? 'mp4'
          : 'bin'

        // Busca MIME real do payload se disponível
        const msgMime = msg?.imageMessage?.mimetype ?? msg?.stickerMessage?.mimetype
          ?? msg?.audioMessage?.mimetype ?? msg?.videoMessage?.mimetype ?? msg?.documentMessage?.mimetype
        if (msgMime) mimeType = msgMime

        // Baixa da Evolution se não vier base64 no payload
        if (!b64 && rawUrl && messageId) {
          const { data: orgSettings } = await admin
            .from('organization_settings')
            .select('evo_server_url, evo_api_key, evo_instance_name')
            .eq('id', 'default').maybeSingle()

          const instForDl = instanceName ?? orgSettings?.evo_instance_name
          if (orgSettings?.evo_server_url && instForDl) {
            const dlRes = await fetch(
              `${orgSettings.evo_server_url}/chat/getBase64FromMediaMessage/${instForDl}`,
              {
                method: 'POST',
                headers: { 'apikey': orgSettings.evo_api_key, 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: { key }, convertToMp4: false }),
              }
            )
            if (dlRes.ok) {
              const dlData = await dlRes.json().catch(() => ({}))
              b64 = dlData?.base64 ?? dlData?.data ?? null
            }
          }
        }

        if (b64) {
          const path = `${instanceName ?? 'default'}/${messageId ?? Date.now()}.${ext}`
          const buffer = Buffer.from(b64, 'base64')
          const { error: upErr } = await admin.storage
            .from('whatsapp-media')
            .upload(path, buffer, { contentType: mimeType, upsert: true })

          if (!upErr) {
            const { data: pub } = admin.storage.from('whatsapp-media').getPublicUrl(path)
            mediaUrl = pub.publicUrl
            console.log('[evo-webhook] mídia → Storage:', path)
          } else {
            console.warn('[evo-webhook] upload Storage falhou:', upErr.message, '— usando proxy')
            if (messageId) {
              const instParam = instanceName ? `&instance=${encodeURIComponent(instanceName)}` : ''
              mediaUrl = `/api/whatsapp/media?id=${encodeURIComponent(messageId)}${instParam}`
            }
          }
        }
      } catch (e) {
        // Nunca aborta — mensagem é salva sem URL se tudo falhar
        console.error('[evo-webhook] erro no bloco de mídia (não fatal):', e)
        if (messageId) {
          const instParam = instanceName ? `&instance=${encodeURIComponent(instanceName)}` : ''
          mediaUrl = `/api/whatsapp/media?id=${encodeURIComponent(messageId)}${instParam}`
        }
      }
    }

    // Mapeamento defensivo — constraint aceita apenas: image, video, audio, document
    const dbMediaType = mediaType === 'sticker' ? 'image'
      : mediaType === 'contact' ? null
      : mediaType === 'location' ? null
      : mediaType
    const finalText = text ?? (mediaType ? (FRIENDLY[mediaType] ?? `[${mediaType}]`) : '[mensagem]')
      console.warn('[evo-webhook] não extraiu texto. msg keys:', msg ? Object.keys(msg) : 'null', '| msgData keys:', Object.keys(msgData ?? {}).slice(0, 10))
    }
    console.log('[evo-webhook] phone:', phone, '| text:', text?.slice(0, 80), '| mediaType:', mediaType)

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
        message: finalText,
        direction: 'recebido',
        status: 'recebido',
        triggered_automatically: false,
        zapi_message_id: messageId ?? null,
        unlinked_sender_name: pushName,
        instance_name: instanceName,
        media_url: mediaUrl,
        media_type: dbMediaType,
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

      // 2. Atualiza para aberto usando PK composta (phone + instance_name)
      const inst = instanceName ?? ''
      const { error: statusErr } = await supabase
        .from('whatsapp_conversation_status')
        .update({ is_archived: false, archived_at: null, archived_by: null, updated_at: new Date().toISOString() })
        .eq('phone', phone)
        .eq('instance_name', inst)

      if (statusErr) {
        // Não existe ainda — insere
        await supabase.from('whatsapp_conversation_status').insert({
          phone, instance_name: inst, is_archived: false,
        })
      }

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
