import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { phone, leadId, pipelineId, stageId, title, value, companyId } = await req.json()

  try {
    const cleanPhone = (phone ?? '').replace(/\D/g, '')

    // Cria o contrato/oportunidade
    const { data: contract, error } = await supabase.from('contracts').insert({
      title: title || `Oportunidade ${phone}`,
      client_name: title || phone,
      owner_id: user.id,
      status: 'active',
      value: value || null,
      company_id: companyId || null,
    }).select('id').single()

    if (error || !contract) {
      console.error('[convert-lead]', error?.message)
      return NextResponse.json({ error: error?.message ?? 'Erro ao criar oportunidade' }, { status: 500 })
    }

    // Cria o pipeline_run
    const { error: runError } = await supabase.from('pipeline_runs').insert({
      contract_id: contract.id,
      pipeline_id: pipelineId,
      stage_id: stageId,
      status: 'open',
      entered_at: new Date().toISOString(),
    })
    if (runError) console.warn('[convert-lead] pipeline_run:', runError.message)

    // Vincula mensagens WhatsApp ao contrato
    if (cleanPhone) {
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
