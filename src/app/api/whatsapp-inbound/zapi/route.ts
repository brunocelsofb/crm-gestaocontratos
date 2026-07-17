import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Recebe eventos de mensagem recebida do Z-API (configurar no painel
// deles: Webhooks → "Ao receber" → colar essa URL).
//
// Vínculo confirmado e testado: bate pelo telefone do REMETENTE contra
// contract_crm.contacts.phone, prioriza o contato exato vinculado ao
// contrato (contract_contacts), com fallback pra qualquer contato da
// mesma empresa.
//
// NOTA DE INCERTEZA: a extração de MÍDIA (foto/áudio/documento) abaixo
// segue o formato mais comum documentado pelo Z-API (image.imageUrl,
// audio.audioUrl, document.documentUrl+fileName), mas nunca vi um
// payload real desses chegando — só testei mensagem de texto até
// agora. Pode precisar de ajuste assim que a primeira mídia real
// chegar (mesmo processo de depuração que já fizemos pro texto).
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

  try {
    if (body.fromMe) return NextResponse.json({ ok: true, skipped: 'fromMe' })
    if (body.isGroup) return NextResponse.json({ ok: true, skipped: 'isGroup' })

    const phone: string | undefined = body.phone
    const media = extractMedia(body)
    const messageText: string | undefined = body.text?.message ?? body.image?.caption ?? body.video?.caption ?? body.body ?? body.message
    const senderName: string | undefined = body.senderName ?? body.chatName
    const senderPhoto: string | undefined = body.photo ?? body.senderPhoto

    if (!phone || (!messageText && !media)) {
      return NextResponse.json({ ok: true, skipped: 'sem telefone ou conteúdo' })
    }

    const cleanPhone = phone.replace(/\D/g, '')
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

    // Sem contrato achado — NÃO descarta a mensagem. Guarda como "não
    // vinculada" (contract_id null), pra aparecer na Central de
    // Atendimento e alguém poder vincular a uma conta depois.
    await supabase.from('contract_whatsapp_messages').insert({
      contract_id: contractId,
      unlinked_sender_name: contractId ? null : (senderName ?? null),
      direction: 'recebido',
      phone,
      message: displayMessage,
      status: 'enviado',
      media_url: media?.url ?? null,
      media_type: media?.type ?? null,
      media_filename: media?.filename ?? null,
      sender_photo_url: senderPhoto ?? null,
    })

    if (!contractId) {
      return NextResponse.json({ ok: true, matched: false, storedUnlinked: true })
    }

    await supabase.from('activities').insert({
      contract_id: contractId,
      type: 'whatsapp',
      content: `WhatsApp recebido de ${senderName ?? phone}.`,
      metadata: { kind: 'received', phone, message: displayMessage },
    })

    // Notifica o dono da conta (se tiver um) de que chegou mensagem
    // nova — sem isso, a única forma de saber é abrindo o contrato.
    const { data: contract } = await supabase.from('contracts').select('owner_id, title').eq('id', contractId).maybeSingle()
    if (contract?.owner_id) {
      await supabase.from('notifications').insert({
        user_id: contract.owner_id,
        contract_id: contractId,
        message: `Nova mensagem de WhatsApp de ${senderName ?? phone} em "${contract.title}".`,
      })
    }

    return NextResponse.json({ ok: true, matched: true })
  } catch (e) {
    console.error('Erro no webhook de WhatsApp:', e)
    return NextResponse.json({ ok: true, error: 'internal' })
  }
}
