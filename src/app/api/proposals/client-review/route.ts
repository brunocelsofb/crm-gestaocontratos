import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidCpf } from '@/lib/utils/cpf'

export async function POST(req: Request) {
  const { token, contract_id, status, name, role, cpf, comment } = await req.json()
  if (!token || !contract_id || !status || !name?.trim()) {
    return NextResponse.json({ error: 'Parametros obrigatorios ausentes' }, { status: 400 })
  }

  // Valida CPF se fornecido (obrigatório para aceite)
  if (status === 'aprovado') {
    if (!cpf?.trim()) {
      return NextResponse.json({ error: 'CPF obrigatorio para aceitar a proposta' }, { status: 400 })
    }
    if (!isValidCpf(cpf)) {
      return NextResponse.json({ error: 'CPF invalido. Verifique o numero informado.' }, { status: 400 })
    }
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: proposal } = await admin.from('proposal_status').select('client_review_token').eq('client_review_token', token).eq('contract_id', contract_id).maybeSingle()
  if (!proposal) return NextResponse.json({ error: 'Token inválido' }, { status: 404 })

  await admin.from('proposal_status').update({
    client_status: status,
    client_approved_at: now,
    client_approved_by_name: name,
    client_approved_by_role: role || null,
    client_approved_by_cpf: cpf || null,
    client_comment: comment || null,
    updated_at: now,
  }).eq('contract_id', contract_id)

  const label = status === 'aprovado' ? '🤝 Proposta aceita pelo cliente' : '❌ Proposta declinada pelo cliente'
  await admin.from('activities').insert({
    contract_id,
    type: 'proposal',
    content: `${label} — ${name}${role ? ` (${role})` : ''}${cpf ? ` · CPF: ${cpf}` : ''}${comment ? ` · Obs: ${comment}` : ''}.`,
  })

  return NextResponse.json({ ok: true })
}
