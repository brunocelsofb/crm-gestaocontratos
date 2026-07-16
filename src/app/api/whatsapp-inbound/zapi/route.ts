import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Recebe eventos de mensagem recebida do Z-API (configurar no painel
// deles: Webhooks → "Ao receber" → colar essa URL).
//
// NOTA DE INCERTEZA: o formato exato do JSON que o Z-API manda pra cá
// eu não confirmei ao vivo — os nomes de campo abaixo (phone, text,
// senderName, fromMe) são os mais comuns na documentação pública
// deles, mas PRECISA ser validado assim que a primeira mensagem real
// chegar. Se não vincular certo, me manda o payload exato que
// aparecer no log da Vercel.
export async function POST(request: Request) {
  const supabase = createAdminClient()
  const body = await request.json().catch(() => null)

  if (!body) return NextResponse.json({ ok: true })

  if (body.fromMe) return NextResponse.json({ ok: true, skipped: 'fromMe' })

  const phone: string | undefined = body.phone
  const messageText: string | undefined = body.text?.message ?? body.body ?? body.message
  const senderName: string | undefined = body.senderName ?? body.chatName

  if (!phone || !messageText) {
    return NextResponse.json({ ok: true, skipped: 'sem telefone ou mensagem' })
  }

  const cleanPhone = phone.replace(/\D/g, '')
  const { data: matchingContacts } = await supabase.from('contacts').select('id').ilike('phone', `%${cleanPhone.slice(-8)}%`)

  if (!matchingContacts || matchingContacts.length === 0) {
    return NextResponse.json({ ok: true, matched: false })
  }

  const { data: contract } = await supabase
    .from('contracts')
    .select('id')
    .in('contact_id', matchingContacts.map((c) => c.id))
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
}
