import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidCpf } from '@/lib/utils/cpf'

export async function POST(req: Request) {
  const { token, contract_id, status, name, role, cpf, comment } = await req.json()
  if (!token || !status || !name?.trim()) {
    return NextResponse.json({ error: 'Parametros obrigatorios ausentes' }, { status: 400 })
  }
  if (status === 'aprovado') {
    if (!cpf?.trim()) return NextResponse.json({ error: 'CPF obrigatorio para aceitar a proposta' }, { status: 400 })
    if (!isValidCpf(cpf)) return NextResponse.json({ error: 'CPF invalido. Verifique o numero informado.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const label = status === 'aprovado' ? '🤝 Proposta aceita pelo cliente' : '❌ Proposta declinada pelo cliente'

  // Novo modelo: busca em proposals pelo token
  const { data: newProposal } = await admin
    .from('proposals')
    .select('id, contract_id')
    .eq('client_review_token', token)
    .maybeSingle()

  if (newProposal) {
    const newWorkflowStatus = status === 'aprovado' ? 'cliente_aprovado' : 'cliente_recusado'
    await admin.from('proposals').update({
      client_status: status,
      client_approved_at: now,
      client_approved_by_name: name,
      client_approved_by_cpf: cpf || null,
      workflow_status: newWorkflowStatus,
      updated_at: now,
    }).eq('id', newProposal.id)

    await admin.from('activities').insert({
      contract_id: newProposal.contract_id,
      type: 'client_decision',
      content: `${label} — ${name}${role ? ` (${role})` : ''}${cpf ? ` · CPF: ${cpf}` : ''}${comment ? ` · Obs: ${comment}` : ''}.`,
    })
    return NextResponse.json({ ok: true })
  }

  // Fallback legado
  const { data: legacyProposal } = await admin
    .from('proposal_status')
    .select('client_review_token, contract_id')
    .eq('client_review_token', token)
    .maybeSingle()

  if (!legacyProposal) return NextResponse.json({ error: 'Token inválido' }, { status: 404 })

  await admin.from('proposal_status').update({
    client_status: status,
    client_approved_at: now,
    client_approved_by_name: name,
    client_approved_by_cpf: cpf || null,
    status: status === 'aprovado' ? 'cliente_aprovado' : 'cliente_recusado',
    updated_at: now,
  }).eq('client_review_token', token)

  await admin.from('activities').insert({
    contract_id: legacyProposal.contract_id,
    type: 'client_decision',
    content: `${label} — ${name}${role ? ` (${role})` : ''}${cpf ? ` · CPF: ${cpf}` : ''}${comment ? ` · Obs: ${comment}` : ''}.`,
  })
  return NextResponse.json({ ok: true })
}
