'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateLeadScore } from '@/lib/utils/lead-score'

export type ActionState = { error?: string }

// Criação de lead — usado tanto pelo formulário PÚBLICO de captação
// quanto pelo cadastro manual da equipe. Sem exigir login (o público
// não tem conta), por isso usa o cliente comum (RLS já libera insert).
export async function createLead(formData: FormData): Promise<ActionState & { leadId?: string }> {
  const supabase = await createClient()

  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null
  const company_name = (formData.get('company_name') as string)?.trim() || null
  const cnpj = (formData.get('cnpj') as string)?.trim() || null
  const message = (formData.get('message') as string)?.trim() || null
  const source = (formData.get('source') as string) || 'manual'

  if (!name) return { error: 'Nome é obrigatório.' }
  if (!company_name) return { error: 'Empresa é obrigatória.' }
  if (!cnpj) return { error: 'CNPJ é obrigatório.' }

  const { score } = calculateLeadScore({ email, phone, company_name, message, source })

  const { data, error } = await supabase
    .from('leads')
    .insert({ name, email, phone, company_name, cnpj, message, source, score })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Se essa pessoa tinha mandado mensagem de WhatsApp antes de
  // preencher o formulário (fluxo de triagem), vincula a conversa a
  // esse lead agora — fecha o ciclo, o histórico não fica solto.
  if (phone) {
    const adminClient = createAdminClient()
    const cleanPhone = phone.replace(/\D/g, '')
    await adminClient.from('contract_whatsapp_messages').update({ lead_id: data.id, unlinked_sender_name: null }).ilike('phone', `%${cleanPhone.slice(-8)}%`).is('contract_id', null)
    await adminClient.from('whatsapp_capture_prompts').update({ lead_id: data.id }).ilike('phone', `%${cleanPhone.slice(-8)}%`)
  }

  // Avisa o time comercial de um lead novo — mesmo padrão de
  // notificação já usado no resto do sistema.
  const adminClient = createAdminClient()
  const { data: commercialProfiles } = await adminClient.from('profiles').select('id').eq('department', 'comercial')
  if (commercialProfiles && commercialProfiles.length > 0) {
    await adminClient.from('notifications').insert(
      commercialProfiles.map((p) => ({ user_id: p.id, message: `Novo lead: ${name}${company_name ? ` (${company_name})` : ''}.` }))
    )
  }

  revalidatePath('/leads')
  return { leadId: data.id }
}

export async function updateLeadStatus(leadId: string, status: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('leads').update({ status, updated_at: new Date().toISOString() }).eq('id', leadId)
  if (error) return { error: error.message }
  revalidatePath('/leads')
  revalidatePath(`/leads/${leadId}`)
  return {}
}

export async function assignLead(leadId: string, userId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('leads').update({ assigned_to: userId, updated_at: new Date().toISOString() }).eq('id', leadId)
  if (error) return { error: error.message }
  revalidatePath(`/leads/${leadId}`)
  return {}
}

export async function addLeadNote(leadId: string, content: string): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }
  if (!content.trim()) return { error: 'Escreva algo na nota.' }

  const { error } = await supabase.from('lead_activities').insert({ lead_id: leadId, user_id: user.id, type: 'note', content })
  if (error) return { error: error.message }
  revalidatePath(`/leads/${leadId}`)
  return {}
}

export async function deleteLead(leadId: string) {
  const supabase = createAdminClient()
  await supabase.from('leads').delete().eq('id', leadId)
  revalidatePath('/leads')
}

// Converte um lead qualificado numa OPORTUNIDADE de verdade: cria (ou
// reaproveita) a empresa, o contato, e o contrato — e já entra no
// funil de Novos Negócios (o funil de vendas padrão).
export async function convertLeadToOpportunity(leadId: string): Promise<ActionState & { contractId?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single()
  if (!lead) return { error: 'Lead não encontrado.' }
  if (lead.status === 'convertido') return { error: 'Este lead já foi convertido.' }

  let companyId: string | null = null
  if (lead.company_name) {
    const { data: existingCompany } = await supabase.from('companies').select('id').ilike('name', lead.company_name).maybeSingle()
    if (existingCompany) {
      companyId = existingCompany.id
    } else {
      const { data: newCompany } = await supabase
        .from('companies')
        .insert({ name: lead.company_name, owner_id: user.id })
        .select('id')
        .single()
      companyId = newCompany?.id ?? null
    }
  }

  let contactId: string | null = null
  if (companyId) {
    const { data: newContact } = await supabase
      .from('contacts')
      .insert({ company_id: companyId, name: lead.name, email: lead.email, phone: lead.phone, is_primary: true })
      .select('id')
      .single()
    contactId = newContact?.id ?? null
  }

  const { data: salesPipeline } = await supabase.from('pipelines').select('id').eq('type', 'vendas').eq('is_default', true).maybeSingle()
  const { data: fallbackPipeline } = salesPipeline
    ? { data: salesPipeline }
    : await supabase.from('pipelines').select('id').eq('type', 'vendas').limit(1).maybeSingle()

  if (!fallbackPipeline) return { error: 'Nenhum funil de vendas encontrado pra converter o lead.' }

  const { data: firstStage } = await supabase
    .from('stages')
    .select('id')
    .eq('pipeline_id', fallbackPipeline.id)
    .order('order_index', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!firstStage) return { error: 'O funil de vendas não tem etapas configuradas.' }

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .insert({
      process_number: `LEAD-${Date.now()}`,
      title: lead.company_name ?? lead.name,
      client_name: lead.company_name ?? lead.name,
      description: lead.message,
      company_id: companyId,
      contact_id: contactId,
      owner_id: user.id,
      current_assignee_id: user.id,
    })
    .select()
    .single()

  if (contractError || !contract) return { error: contractError?.message ?? 'Falha ao criar a oportunidade.' }

  const now = new Date().toISOString()
  const { data: run } = await supabase
    .from('pipeline_runs')
    .insert({
      contract_id: contract.id,
      pipeline_id: fallbackPipeline.id,
      stage_id: firstStage.id,
      stage_entered_at: now,
      created_by: user.id,
    })
    .select()
    .single()

  if (run) {
    await supabase.from('stage_history').insert({ pipeline_run_id: run.id, stage_id: firstStage.id, entered_at: now, changed_by: user.id })
  }

  await supabase.from('leads').update({ status: 'convertido', converted_contract_id: contract.id, updated_at: now }).eq('id', leadId)

  // Migra o histórico de WhatsApp do lead pro contrato novo — a
  // conversa não pode ficar pra trás só porque virou oportunidade.
  await supabase.from('contract_whatsapp_messages').update({ contract_id: contract.id, lead_id: null }).eq('lead_id', leadId)

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    user_id: user.id,
    type: 'system',
    content: 'Lead convertido em oportunidade.',
  })

  await supabase.from('activities').insert({
    contract_id: contract.id,
    user_id: user.id,
    type: 'system',
    content: `Oportunidade criada a partir do lead "${lead.name}" (origem: ${lead.source ?? 'manual'}).`,
  })

  revalidatePath('/leads')
  revalidatePath('/pipeline')
  return { contractId: contract.id }
}
