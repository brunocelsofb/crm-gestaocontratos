import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const { action, name, comment, promised_deadline, contract_id } = await req.json()
  const admin = createAdminClient()
  const now = new Date().toISOString()

  if (action === 'assume') {
    await admin.from('transfer_requests').update({
      status: 'in_progress', assumed_at: now, assumed_by_name: name,
      promised_deadline, promised_comment: comment,
    }).eq('id', id)
    await admin.from('activities').insert({
      contract_id, type: 'transfer',
      content: `🔄 ${name} assumiu a análise${promised_deadline ? ` · Retorno até ${new Date(promised_deadline).toLocaleDateString('pt-BR')}` : ''}${comment ? ` · ${comment}` : ''}.`,
      user_id: user.id,
    })
  } else if (action === 'complete') {
    await admin.from('transfer_requests').update({
      status: 'completed', completed_at: now, completed_comment: comment,
    }).eq('id', id)
    await admin.from('activities').insert({
      contract_id, type: 'transfer',
      content: `✅ Análise concluída e devolvida${comment ? ` · Parecer: ${comment}` : ''}.`,
      user_id: user.id,
    })
  }

  return NextResponse.json({ ok: true })
}
