'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { sendZApiTextMessage, verifyZApiConnection } from '@/lib/whatsapp/zapi'

export type ActionState = { error?: string }

async function getZApiCredentials(): Promise<{ instanceId: string; token: string; clientToken: string } | null> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('organization_settings').select('zapi_instance_id, zapi_token, zapi_client_token').eq('id', 'default').maybeSingle()
  if (!data?.zapi_instance_id || !data?.zapi_token || !data?.zapi_client_token) return null
  return { instanceId: data.zapi_instance_id, token: data.zapi_token, clientToken: data.zapi_client_token }
}

export async function connectZApi(formData: FormData): Promise<ActionState> {
  if (!(await isCurrentUserAdmin())) return { error: 'Só administradores podem configurar isso.' }

  const instanceId = (formData.get('zapi_instance_id') as string)?.trim()
  const token = (formData.get('zapi_token') as string)?.trim()
  const clientToken = (formData.get('zapi_client_token') as string)?.trim()

  if (!instanceId || !token || !clientToken) return { error: 'Preencha Instance ID, Token e Client-Token.' }

  const verify = await verifyZApiConnection({ instanceId, token, clientToken })
  if (!verify.ok) return { error: `Não consegui conectar: ${verify.error}` }

  const supabase = await createClient()
  const { error } = await supabase
    .from('organization_settings')
    .update({ zapi_instance_id: instanceId, zapi_token: token, zapi_client_token: clientToken, updated_at: new Date().toISOString() })
    .eq('id', 'default')

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return {}
}

export async function disconnectZApi(): Promise<ActionState> {
  if (!(await isCurrentUserAdmin())) return { error: 'Só administradores podem configurar isso.' }
  const supabase = await createClient()
  await supabase
    .from('organization_settings')
    .update({ zapi_instance_id: null, zapi_token: null, zapi_client_token: null })
    .eq('id', 'default')
  revalidatePath('/settings')
  return {}
}

export async function sendContractWhatsApp(contractId: string, phone: string, message: string, templateId: string | null): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }
  if (!phone) return { error: 'Informe o telefone do destinatário.' }
  if (!message.trim()) return { error: 'Escreva a mensagem.' }

  const creds = await getZApiCredentials()
  if (!creds) return { error: 'WhatsApp ainda não está conectado. Vá em Configurações e conecte o Z-API.' }

  try {
    const result = await sendZApiTextMessage({ ...creds, phone, message })

    await supabase.from('contract_whatsapp_messages').insert({
      contract_id: contractId,
      sent_by: user.id,
      direction: 'enviado',
      phone,
      message,
      template_id: templateId,
      zapi_message_id: result.messageId,
      status: 'enviado',
    })

    await supabase.from('activities').insert({
      contract_id: contractId,
      user_id: user.id,
      type: 'whatsapp',
      content: `WhatsApp enviado pra ${phone}.`,
      metadata: { kind: 'sent', phone, message },
    })
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Falha ao enviar WhatsApp.'
    await supabase.from('contract_whatsapp_messages').insert({
      contract_id: contractId,
      sent_by: user.id,
      direction: 'enviado',
      phone,
      message,
      template_id: templateId,
      status: 'falhou',
      error_message: errorMsg,
    })
    return { error: errorMsg }
  }

  revalidatePath(`/contracts/${contractId}`)
  return {}
}

function fillTemplateVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

export async function buildWhatsAppFromTemplate(templateId: string, contractId: string): Promise<{ message: string; phone: string | null } | null> {
  const supabase = createAdminClient()

  const { data: template } = await supabase.from('email_templates').select('body').eq('id', templateId).maybeSingle()
  if (!template) return null

  const { data: contract } = await supabase.from('contracts').select('*').eq('id', contractId).maybeSingle()
  if (!contract) return null

  const { data: company } = contract.company_id
    ? await supabase.from('companies').select('name, cnpj').eq('id', contract.company_id).maybeSingle()
    : { data: null }
  const { data: contact } = contract.contact_id
    ? await supabase.from('contacts').select('name, phone').eq('id', contract.contact_id).maybeSingle()
    : { data: null }
  const { data: owner } = contract.owner_id
    ? await supabase.from('profiles').select('full_name').eq('id', contract.owner_id).maybeSingle()
    : { data: null }
  const { data: orgSettings } = await supabase.from('organization_settings').select('company_name, company_cnpj').eq('id', 'default').maybeSingle()

  const { data: customFieldDefs } = await supabase.from('custom_fields').select('id, field_key')
  const { data: customFieldValues } = await supabase.from('contract_custom_field_values').select('custom_field_id, value').eq('contract_id', contractId)
  const valueByFieldId = new Map((customFieldValues ?? []).map((v) => [v.custom_field_id, v.value]))
  const customVars: Record<string, string> = {}
  for (const field of customFieldDefs ?? []) {
    customVars[field.field_key] = valueByFieldId.get(field.id) ?? ''
  }

  const vars = {
    cliente: contract.client_name ?? '',
    empresa: company?.name ?? contract.client_name ?? '',
    contato: contact?.name ?? '',
    processo: contract.process_number ?? '',
    cnpj: company?.cnpj ?? '',
    minha_empresa: orgSettings?.company_name ?? '',
    minha_cnpj: orgSettings?.company_cnpj ?? '',
    responsavel: owner?.full_name ?? '',
    data_hoje: new Date().toLocaleDateString('pt-BR'),
    ...customVars,
  }

  return {
    message: fillTemplateVariables(template.body, vars),
    phone: contact?.phone ?? null,
  }
}

export async function sendAutomatedWhatsAppTemplateMessage(contractId: string, templateId: string): Promise<void> {
  const supabase = createAdminClient()
  const creds = await getZApiCredentials()
  if (!creds) return

  const filled = await buildWhatsAppFromTemplate(templateId, contractId)
  if (!filled?.phone) return

  try {
    const result = await sendZApiTextMessage({ ...creds, phone: filled.phone, message: filled.message })
    await supabase.from('contract_whatsapp_messages').insert({
      contract_id: contractId,
      direction: 'enviado',
      phone: filled.phone,
      message: filled.message,
      template_id: templateId,
      triggered_automatically: true,
      zapi_message_id: result.messageId,
      status: 'enviado',
    })
    await supabase.from('activities').insert({
      contract_id: contractId,
      type: 'whatsapp',
      content: `WhatsApp automático enviado pra ${filled.phone}.`,
      metadata: { kind: 'sent', phone: filled.phone, message: filled.message },
    })
  } catch (e) {
    await supabase.from('contract_whatsapp_messages').insert({
      contract_id: contractId,
      direction: 'enviado',
      phone: filled.phone,
      message: filled.message,
      template_id: templateId,
      triggered_automatically: true,
      status: 'falhou',
      error_message: e instanceof Error ? e.message : 'Falha desconhecida.',
    })
  }
}
