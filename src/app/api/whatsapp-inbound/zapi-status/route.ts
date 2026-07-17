import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Recebe atualizações de status (entregue/lido) do Z-API — configurar
// no painel deles: Webhooks → "Receber status da mensagem" → colar
// essa URL (é uma URL DIFERENTE da de receber mensagem).
//
// NOTA DE INCERTEZA: nunca vi um payload real desse webhook — os
// nomes de campo (messageId, status) são a suposição mais razoável
// baseada no padrão do resto da API deles, mas PRECISA ser validado
// ao vivo.
const STATUS_MAP: Record<string, 'sent' | 'delivered' | 'read' | 'failed'> = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
}

export async function POST(request: Request) {
  const supabase = createAdminClient()
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  try {
    const messageId: string | undefined = body.messageId ?? body.ids?.[0]
    const rawStatus: string | undefined = body.status
    if (!messageId || !rawStatus) return NextResponse.json({ ok: true, skipped: 'sem messageId ou status' })

    const mapped = STATUS_MAP[rawStatus.toUpperCase()]
    if (!mapped) return NextResponse.json({ ok: true, skipped: `status desconhecido: ${rawStatus}` })

    const update: Record<string, unknown> = { delivery_status: mapped }
    if (mapped === 'read') update.read_at = new Date().toISOString()

    await supabase.from('contract_whatsapp_messages').update(update).eq('zapi_message_id', messageId)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Erro no webhook de status do WhatsApp:', e)
    return NextResponse.json({ ok: true, error: 'internal' })
  }
}
