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
  const nowFmt = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const label = status === 'aprovado'
    ? `✅ Proposta aceita digitalmente pelo cliente`
    : `❌ Proposta recusada pelo cliente`

  // Novo modelo: busca em proposals pelo token
  const { data: newProposal } = await admin
    .from('proposals')
    .select('id, contract_id, control_code, proposal_value')
    .eq('client_review_token', token)
    .maybeSingle()

  if (newProposal) {
    const newWorkflowStatus = status === 'aprovado' ? 'cliente_aprovado' : 'cliente_recusado'

    // Busca dados da oportunidade para log rico
    const { data: contractData } = await admin
      .from('contracts').select('client_name, title').eq('id', newProposal.contract_id).maybeSingle()
    const oppName = contractData?.client_name ?? contractData?.title ?? 'Oportunidade'
    const cpfFmt = cpf ? cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : null
    const valueFmt = newProposal.proposal_value
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(newProposal.proposal_value))
      : null

    await admin.from('proposals').update({
      client_status: status,
      client_approved_at: now,
      client_approved_by_name: name,
      client_approved_by_cpf: cpf || null,
      workflow_status: newWorkflowStatus,
      updated_at: now,
    }).eq('id', newProposal.id)

    const logContent = status === 'aprovado'
      ? `✅ Proposta ${newProposal.control_code} aceita na oportunidade "${oppName}"${valueFmt ? ` · Valor: ${valueFmt}` : ''}. Aprovado por: ${name}${role ? ` (${role})` : ''}${cpfFmt ? ` · CPF: ${cpfFmt}` : ''}. Data/Hora: ${nowFmt}.`
      : `❌ Proposta ${newProposal.control_code} RECUSADA na oportunidade "${oppName}". Motivo: ${comment?.trim() || 'Não informado'}. Por: ${name}${role ? ` (${role})` : ''}${cpfFmt ? ` · CPF: ${cpfFmt}` : ''}. Data/Hora: ${nowFmt}.`

    await admin.from('activities').insert({
      contract_id: newProposal.contract_id,
      type: status === 'aprovado' ? 'client_decision' : 'client_rejection',
      content: logContent,
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

  const legacyWorkflow = status === 'aprovado' ? 'cliente_aprovado' : 'cliente_recusado'

  // Atualiza proposal_status (legado)
  await admin.from('proposal_status').update({
    client_status: status,
    client_approved_at: now,
    client_approved_by_name: name,
    client_approved_by_cpf: cpf || null,
    status: legacyWorkflow,
    updated_at: now,
  }).eq('client_review_token', token)

  // Sincroniza proposals (novo modelo) pelo contract_id — garante UI atualizada
  await admin.from('proposals').update({
    workflow_status: legacyWorkflow,
    client_status: status,
    client_approved_at: now,
    client_approved_by_name: name,
    client_approved_by_cpf: cpf || null,
    updated_at: now,
  }).eq('contract_id', legacyProposal.contract_id)
    .not('workflow_status', 'eq', 'rascunho') // não sobrescreve propostas em rascunho

  const legacyLogContent = status === 'aprovado'
    ? `✅ Proposta aceita pelo cliente — ${name}${cpf ? ` · CPF: ${cpf}` : ''}${comment ? ` · Obs: ${comment}` : ''}. Data/Hora: ${nowFmt}.`
    : `❌ Proposta RECUSADA. Motivo: ${comment?.trim() || 'Não informado'}. Por: ${name}${cpf ? ` · CPF: ${cpf}` : ''}. Data/Hora: ${nowFmt}.`

  await admin.from('activities').insert({
    contract_id: legacyProposal.contract_id,
    type: status === 'aprovado' ? 'client_decision' : 'client_rejection',
    content: legacyLogContent,
  })
  return NextResponse.json({ ok: true })
}
