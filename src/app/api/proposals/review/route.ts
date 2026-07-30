import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const body = await req.json()
  const { token, contract_id, status, technical_comment, technical_restrictions, actor_name } = body

  if (!token || !contract_id || !status) {
    return NextResponse.json({ error: 'Parâmetros obrigatórios ausentes' }, { status: 400 })
  }

  // Verifica usuário logado
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  // Verifica se o token é válido
  const { data: proposal } = await admin
    .from('proposal_status')
    .select('id, status, contract_id')
    .eq('review_token', token)
    .eq('contract_id', contract_id)
    .maybeSingle()

  if (!proposal) return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
  if (proposal.status !== 'em_aprovacao_tecnica') {
    return NextResponse.json({ error: 'Proposta não está em aprovação técnica' }, { status: 400 })
  }

  // Registra o parecer
  await admin.from('proposal_status').update({
    status,
    technical_comment,
    technical_restrictions: technical_restrictions || null,
    actor_name,
    technical_approved_by: user.id,
    updated_at: new Date().toISOString(),
  }).eq('contract_id', contract_id)

  // Registra atividade no contrato
  const statusLabel = status === 'aprovado_tecnico' ? '🔧 Aprovado tecnicamente' : '❌ Reprovado tecnicamente'
  const restricoesText = technical_restrictions ? ` · Restrições: ${technical_restrictions}` : ''
  await admin.from('activities').insert({
    contract_id,
    user_id: user.id,
    type: 'proposal',
    content: `${statusLabel} por ${actor_name}. Parecer: "${technical_comment}"${restricoesText}`,
  })

  return NextResponse.json({ ok: true })
}
