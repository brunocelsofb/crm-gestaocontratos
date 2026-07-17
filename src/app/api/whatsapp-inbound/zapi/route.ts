import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Recebe eventos do Z-API (configurar no painel deles: Webhooks →
// "Ao receber" → colar essa URL, e ATIVAR a opção "Notificar as
// enviadas por mim também" — sem isso, mensagens respondidas direto
// pelo celular, fora do CRM, nunca aparecem aqui).
//
// Vínculo confirmado e testado: bate pelo telefone contra
// contract_crm.contacts.phone, prioriza o contato exato vinculado ao
// contrato (contract_contacts), com fallback pra qualquer contato da
// mesma empresa.
//
// NOTA DE INCERTEZA: a extração de MÍDIA (foto/áudio/documento) segue
// o formato mais comum documentado pelo Z-API, mas nunca vi um
// payload real desses chegando — só testei mensagem de texto até
// agora.
type MediaInfo = { url: string; type: 'image' | 'audio' | 'document' | 'video'; filename: string | null }

function extractMedia(body: any): MediaInfo | null {
  if (body.image?.imageUrl) return { url: body.image.imageUrl, type: 'image', filename: null }
  if (body.audio?.audioUrl) return { url: body.audio.audioUrl, type: 'audio', filename: null }
  if (body.video?.videoUrl) return { url: body.video.videoUrl, type: 'video', filename: null }
  if (body.document?.documentUrl) return { url: body.document.documentUrl, type: 'document', filename: body.document.fileName ?? null }
  return null
}

export async function POST(request: Request) {
  const supabase = createAdminClient()
  const body = await request.json().catch(() => null)

  if (!body) return NextResponse.json({ ok: true })

  // DEPURAÇÃO TEMPORÁRIA (de novo): grava todo payload recebido, pra
  // vermos se "fromMe: true" está mesmo chegando depois de ativar
  // "Notificar as enviadas por mim também" no Z-API.
  await supabase.from('webhook_debug_log').insert({ source: 'zapi_whatsapp_v2', raw_payload: body })

  try {
    if (body.isGroup) return NextResponse.json({ ok: true, skipped: 'isGroup' })

    const isFromMe: boolean = body.fromMe === true
    const messageId: string | undefined = body.messageId

    // Se foi mandada por "mim" (a conta conectada) e a gente já tinha
    // registrado ela pelo próprio envio do CRM (mesmo messageId), não
    // duplica — só entra aqui de verdade quando a resposta veio direto
    // do celular, por fora do CRM.
    if (isFromMe && messageId) {
      const { data: existing } = await supabase.from('contract_whatsapp_messages').select('id').eq('zapi_message_id', messageId).maybeSingle()
      if (existing) return NextResponse.json({ ok: true, skipped: 'já registrada pelo CRM' })
    }

    const phone: string | undefined = body.phone
    const chatLid: string | undefined = body.chatLid
    const media = extractMedia(body)
    const messageText: string | undefined = body.text?.message ?? body.image?.caption ?? body.video?.caption ?? body.body ?? body.message
    const senderName: string | undefined = body.senderName ?? body.chatName
    const senderPhoto: string | undefined = body.photo ?? body.senderPhoto

    if ((!phone && !chatLid) || (!messageText && !media)) {
      return NextResponse.json({ ok: true, skipped: 'sem telefone/lid ou conteúdo' })
    }

    // "phone" às vezes vem como um LID (ex: "123456@lid") em vez do
    // número de verdade — sobretudo em mensagens respondidas pelo
    // celular, fora do CRM. Se for o caso, resolve pelo dicionário
    // aprendido; se ainda não tiver aprendido esse LID, não dá pra
    // vincular por telefone (mas não perde a mensagem — fica em
    // "não vinculada" usando o LID mesmo, até aparecer uma mensagem
    // recebida normal que ensine o dicionário).
    let effectivePhone = phone
    const isLid = !phone || phone.includes('@lid') || phone === chatLid
    if (isLid && chatLid) {
      const { data: mapped } = await supabase.from('whatsapp_lid_map').select('phone').eq('lid', chatLid).maybeSingle()
      if (mapped) effectivePhone = mapped.phone
    }

    // Aprende o dicionário: se essa mensagem trouxe um telefone de
    // verdade (não-LID) JUNTO com o chatLid, guarda a relação pra
    // usar depois em mensagens que só tragam o LID.
    if (phone && !phone.includes('@lid') && phone !== chatLid && chatLid) {
      await supabase.from('whatsapp_lid_map').upsert({ lid: chatLid, phone, updated_at: new Date().toISOString() })
    }

    if (!effectivePhone) {
      return NextResponse.json({ ok: true, skipped: 'LID ainda não mapeado pra um telefone' })
    }

    const cleanPhone = effectivePhone.replace(/\D/g, '')
    const last8 = cleanPhone.slice(-8)
    const { data: matchingContacts } = await supabase.from('contacts').select('id, company_id').ilike('phone', `%${last8}%`)

    const displayMessage = messageText || (media ? `[${media.type}]` : '')

    let contractId: string | null = null

    if (matchingContacts && matchingContacts.length > 0) {
      const contactIds = matchingContacts.map((c) => c.id)
      const companyIds = matchingContacts.map((c) => c.company_id).filter((id): id is string => !!id)

      const { data: exactLink } = await supabase
        .from('contract_contacts')
        .select('contract_id')
        .in('contact_id', contactIds)
        .limit(1)
        .maybeSingle()

      contractId = exactLink?.contract_id ?? null

      if (!contractId && companyIds.length > 0) {
        const { data: companyMatch } = await supabase
          .from('contracts')
          .select('id')
          .in('company_id', companyIds)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        contractId = companyMatch?.id ?? null
      }
    }

    const direction = isFromMe ? 'enviado' : 'recebido'

    // Sem contrato achado — NÃO descarta a mensagem. Guarda como "não
    // vinculada" (contract_id null), pra aparecer na Central de
    // Atendimento e alguém poder vincular a uma conta depois.
    await supabase.from('contract_whatsapp_messages').insert({
      contract_id: contractId,
      unlinked_sender_name: contractId ? null : (senderName ?? null),
      direction,
      phone: effectivePhone,
      message: displayMessage,
      status: 'enviado',
      zapi_message_id: messageId ?? null,
      media_url: media?.url ?? null,
      media_type: media?.type ?? null,
      media_filename: media?.filename ?? null,
      sender_photo_url: isFromMe ? null : (senderPhoto ?? null),
    })

    if (!contractId) {
      return NextResponse.json({ ok: true, matched: false, storedUnlinked: true })
    }

    await supabase.from('activities').insert({
      contract_id: contractId,
      type: 'whatsapp',
      content: isFromMe ? `WhatsApp enviado (pelo celular) pra ${effectivePhone}.` : `WhatsApp recebido de ${senderName ?? effectivePhone}.`,
      metadata: { kind: isFromMe ? 'sent' : 'received', phone: effectivePhone, message: displayMessage },
    })

    // Notifica o dono da conta só quando é o CLIENTE escrevendo — não
    // faz sentido notificar alguém sobre uma mensagem que ele mesmo
    // acabou de mandar pelo celular.
    if (!isFromMe) {
      const { data: contract } = await supabase.from('contracts').select('owner_id, title').eq('id', contractId).maybeSingle()
      if (contract?.owner_id) {
        await supabase.from('notifications').insert({
          user_id: contract.owner_id,
          contract_id: contractId,
          message: `Nova mensagem de WhatsApp de ${senderName ?? effectivePhone} em "${contract.title}".`,
        })
      }
    }

    return NextResponse.json({ ok: true, matched: true })
  } catch (e) {
    console.error('Erro no webhook de WhatsApp:', e)
    return NextResponse.json({ ok: true, error: 'internal' })
  }
}
