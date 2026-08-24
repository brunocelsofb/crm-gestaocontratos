import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { phone, leadId, pipelineId, stageId, value } = await req.json()

  try {
    // Cria ou atualiza o lead
    let finalLeadId = leadId
    if (!finalLeadId) {
      const { data: lead } = await supabase.from('leads').insert({
        name: phone, phone, owner_id: user.id, status: 'aberto',
      }).select('id').single()
      finalLeadId = lead?.id
    }

    // Cria o contrato/oportunidade
    const { data: contract } = await supabase.from('contracts').insert({
      title: `Oportunidade ${phone}`,
      owner_id: user.id,
      status: 'aberto',
    }).select('id').single()

    if (!contract) return NextResponse.json({ error: 'Erro ao criar oportunidade' }, { status: 500 })

    // Cria o pipeline_run
    await supabase.from('pipeline_runs').insert({
      contract_id: contract.id,
      pipeline_id: pipelineId,
      stage_id: stageId,
      value: value || 0,
      owner_id: user.id,
    })

    // Vincula mensagens ao contrato
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '')
      await supabase.from('contract_whatsapp_messages')
        .update({ contract_id: contract.id })
        .ilike('phone', `%${cleanPhone.slice(-10)}`)
        .is('contract_id', null)
    }

    return NextResponse.json({ ok: true, contractId: contract.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
