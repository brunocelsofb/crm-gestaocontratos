import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Recebe eventos de mensagem recebida do Z-API (configurar no painel
// deles: Webhooks → "Ao receber" → colar essa URL).
//
// Vínculo confirmado e testado: bate pelo telefone do REMETENTE contra
// contract_crm.contacts.phone, e usa o contrato onde esse contato está
// selecionado no campo "Contato" (contracts.contact_id) — se o
// contato certo não estiver selecionado ali, a mensagem não vincula.
export async function POST(request: Request) {
  const supabase = createAdminClient()
  const body = await request.json().catch(() => null)

  if (!body) return NextResponse.json({ ok: true })

  try {
    if (body.fromMe) return NextResponse.json({ ok: true, skipped: 'fromMe' })
    if (body.isGroup) return NextResponse.json({ ok: true, skipped: 'isGroup' })

    const phone: string | undefined = body.phone
    const messageText: string | undefined = body.text?.message ?? body.body ?? body.message
    const senderName: string | undefined = body.senderName ?? body.chatName

    if (!phone || !messageText) {
      return NextResponse.json({ ok: true, skipped: 'sem telefone ou mensagem' })
    }

    const cleanPhone = phone.replace(/\D/g, '')
    const last8 = cleanPhone.slice(-8)
    const { data: matchingContacts } = await supabase.from('contacts').select('id, company_id').ilike('phone', `%${last8}%`)

    if (!matchingContacts || matchingContacts.length === 0) {
      return NextResponse.json({ ok: true, matched: false })
    }

    const contactIds = matchingContacts.map((c) => c.id)
    const companyIds = matchingContacts.map((c) => c.company_id).filter((id): id is string => !!id)

    // Prioridade 1: contato exato vinculado ao contrato (via
    // contract_contacts, que já cobre "principal" e "outros").
    const { data: exactLink } = await supabase
      .from('contract_contacts')
      .select('contract_id')
      .in('contact_id', contactIds)
      .limit(1)
      .maybeSingle()

    let contractId: string | null = exactLink?.contract_id ?? null

    // Prioridade 2 (se não achou vínculo exato): qualquer contrato da
    // MESMA EMPRESA desse contato — várias pessoas da empresa podem
    // mandar mensagem, não só quem está formalmente vinculado ainda.
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

    if (!contractId) {
      return NextResponse.json({ ok: true, matched: false })
    }

    await supabase.from('contract_whatsapp_messages').insert({
      contract_id: contractId,
      direction: 'recebido',
      phone,
      message: messageText,
      status: 'enviado',
    })

    await supabase.from('activities').insert({
      contract_id: contractId,
      type: 'whatsapp',
      content: `WhatsApp recebido de ${senderName ?? phone}.`,
      metadata: { kind: 'received', phone, message: messageText },
    })

    return NextResponse.json({ ok: true, matched: true })
  } catch (e) {
    console.error('Erro no webhook de WhatsApp:', e)
    return NextResponse.json({ ok: true, error: 'internal' })
  }
}
