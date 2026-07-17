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

    // Bate tanto pelo contato EXATO selecionado no contrato quanto por
    // qualquer contrato da MESMA EMPRESA desse contato — uma empresa
    // pode ter várias pessoas mandando mensagem, não só quem está
    // marcado como "Contato" principal.
    const contactIds = matchingContacts.map((c) => c.id)
    const companyIds = matchingContacts.map((c) => c.company_id).filter((id): id is string => !!id)

    const { data: contract } = await supabase
      .from('contracts')
      .select('id')
      .or(`contact_id.in.(${contactIds.join(',')})${companyIds.length > 0 ? `,company_id.in.(${companyIds.join(',')})` : ''}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!contract) {
      return NextResponse.json({ ok: true, matched: false })
    }

    await supabase.from('contract_whatsapp_messages').insert({
      contract_id: contract.id,
      direction: 'recebido',
      phone,
      message: messageText,
      status: 'enviado',
    })

    await supabase.from('activities').insert({
      contract_id: contract.id,
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
