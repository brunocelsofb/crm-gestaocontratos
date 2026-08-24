import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const {
    phone, leadId,
    contactName, contactEmail, contactRole,
    companyId, companyCnpj, companyName,
    pipelineId, stageId, value,
  } = await req.json()

  try {
    const cleanPhone = (phone ?? '').replace(/\D/g, '')

    // 1. Empresa — cria se informou nome/cnpj sem id
    let finalCompanyId = companyId ?? null
    if (!finalCompanyId && companyName) {
      const { data: co } = await supabase
        .from('companies')
        .insert({ name: companyName, cnpj: companyCnpj || null, created_by: user.id })
        .select('id').single()
      finalCompanyId = co?.id ?? null
    }

    // 2. Contato
    let contactId: string | null = null
    if (contactName) {
      const { data: ct } = await supabase
        .from('contacts')
        .insert({
          name: contactName,
          phone: cleanPhone || null,
          email: contactEmail || null,
          role: contactRole || null,
          company_id: finalCompanyId,
        })
        .select('id').single()
      contactId = ct?.id ?? null
    }

    // 3. Lead
    let finalLeadId = leadId
    if (!finalLeadId) {
      const { data: lead } = await supabase
        .from('leads')
        .insert({ name: contactName || phone, phone: cleanPhone })
        .select('id').single()
      finalLeadId = lead?.id ?? null
    }

    // 4. Contrato/Oportunidade
    const { data: contract, error } = await supabase
      .from('contracts')
      .insert({
        title: contactName || phone,
        client_name: contactName || phone,
        owner_id: user.id,
        status: 'active',
        value: value || null,
        company_id: finalCompanyId,
        contact_id: contactId,
        lead_id: finalLeadId,
      })
      .select('id').single()

    if (error || !contract) {
      console.error('[convert-lead]', error?.message)
      return NextResponse.json({ error: error?.message ?? 'Erro ao criar oportunidade' }, { status: 500 })
    }

    // 5. Pipeline run
    await supabase.from('pipeline_runs').insert({
      contract_id: contract.id,
      pipeline_id: pipelineId,
      stage_id: stageId,
      status: 'open',
      entered_at: new Date().toISOString(),
    })

    // 6. Vincula mensagens WhatsApp
    if (cleanPhone) {
      await supabase.from('contract_whatsapp_messages')
        .update({ contract_id: contract.id })
        .ilike('phone', `%${cleanPhone.slice(-10)}`)
        .is('contract_id', null)
    }

    return NextResponse.json({ ok: true, contractId: contract.id })
  } catch (e: any) {
    console.error('[convert-lead]', e?.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
