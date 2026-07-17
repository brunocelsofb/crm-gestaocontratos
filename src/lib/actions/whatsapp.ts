'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { sendZApiTextMessage, sendZApiImageMessage, sendZApiDocumentMessage, verifyZApiConnection } from '@/lib/whatsapp/zapi'

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

// Envio de imagem ou documento — o arquivo já precisa estar
// hospedado (subido pro nosso Storage antes, pela tela).
export async function sendContractWhatsAppMedia(
  contractId: string,
  phone: string,
  mediaUrl: string,
  mediaType: 'image' | 'document',
  filename: string | null
): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }
  if (!phone) return { error: 'Informe o telefone do destinatário.' }

  const creds = await getZApiCredentials()
  if (!creds) return { error: 'WhatsApp ainda não está conectado.' }

  try {
    const result =
      mediaType === 'image'
        ? await sendZApiImageMessage({ ...creds, phone, imageUrl: mediaUrl })
        : await sendZApiDocumentMessage({ ...creds, phone, documentUrl: mediaUrl, fileName: filename ?? 'documento' })

    await supabase.from('contract_whatsapp_messages').insert({
      contract_id: contractId,
      sent_by: user.id,
      direction: 'enviado',
      phone,
      message: mediaType === 'image' ? '[imagem]' : `[documento] ${filename ?? ''}`,
      media_url: mediaUrl,
      media_type: mediaType,
      media_filename: filename,
      zapi_message_id: result.messageId,
      status: 'enviado',
    })

    await supabase.from('activities').insert({
      contract_id: contractId,
      user_id: user.id,
      type: 'whatsapp',
      content: `WhatsApp (${mediaType}) enviado pra ${phone}.`,
      metadata: { kind: 'sent', phone, message: mediaType === 'image' ? '[imagem]' : `[documento] ${filename ?? ''}` },
    })
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Falha ao enviar.'
    await supabase.from('contract_whatsapp_messages').insert({
      contract_id: contractId,
      sent_by: user.id,
      direction: 'enviado',
      phone,
      message: mediaType === 'image' ? '[imagem]' : `[documento] ${filename ?? ''}`,
      media_url: mediaUrl,
      media_type: mediaType,
      media_filename: filename,
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

// ------------------------------------------------------------
// Conversas SEM conta vinculada — número escreveu, ninguém no CRM
// reconhece esse telefone ainda. Fica visível na Central de
// Atendimento até alguém vincular a uma conta.
// ------------------------------------------------------------
export type UnlinkedConversation = {
  phone: string
  senderName: string | null
  senderPhoto: string | null
  lastMessage: string
  lastMediaType: string | null
  lastMessageAt: string
}

export async function getUnlinkedWhatsAppConversations(): Promise<UnlinkedConversation[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('contract_whatsapp_messages')
    .select('phone, unlinked_sender_name, sender_photo_url, message, media_type, created_at')
    .is('contract_id', null)
    .order('created_at', { ascending: false })
    .limit(200)

  const byPhone = new Map<string, UnlinkedConversation>()
  for (const m of data ?? []) {
    if (byPhone.has(m.phone)) continue
    byPhone.set(m.phone, {
      phone: m.phone,
      senderName: m.unlinked_sender_name,
      senderPhoto: m.sender_photo_url,
      lastMessage: m.message,
      lastMediaType: m.media_type,
      lastMessageAt: m.created_at,
    })
  }
  return Array.from(byPhone.values())
}

export async function getUnlinkedMessagesByPhone(phone: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('contract_whatsapp_messages')
    .select('id, phone, message, direction, status, triggered_automatically, error_message, created_at, media_url, media_type, media_filename, sender_photo_url, delivery_status')
    .eq('phone', phone)
    .is('contract_id', null)
    .order('created_at', { ascending: false })
  return data ?? []
}

// Vincula TODO o histórico de um telefone a um contrato de uma vez —
// de agora em diante, novas mensagens desse número já entram direto
// vinculadas (porque o contato/telefone passa a ser reconhecido).
export async function linkUnlinkedWhatsAppConversation(phone: string, contractId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('contract_whatsapp_messages')
    .update({ contract_id: contractId, unlinked_sender_name: null })
    .eq('phone', phone)
    .is('contract_id', null)

  if (error) return { error: error.message }

  await supabase.from('activities').insert({
    contract_id: contractId,
    type: 'system',
    content: `Conversa de WhatsApp (${phone}) vinculada a esta conta.`,
  })

  revalidatePath('/whatsapp')
  revalidatePath(`/contracts/${contractId}`)
  return {}
}

// "Salvar como nota" — pega a conversa (ou um resumo dela) e registra
// como nota no histórico da conta, igual o recurso do PipeRun.
export async function saveWhatsAppConversationAsNote(contractId: string, noteText: string): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  const { error } = await supabase.from('activities').insert({
    contract_id: contractId,
    user_id: user.id,
    type: 'note',
    content: noteText,
  })
  if (error) return { error: error.message }

  revalidatePath(`/contracts/${contractId}`)
  return {}
}

// Resolve o NOME de quem está de verdade na conversa, pelo telefone —
// em vez de assumir que é o contato principal do contrato (que pode
// ser outra pessoa da mesma empresa).
export async function resolveContactNameByPhone(phone: string): Promise<string | null> {
  const supabase = createAdminClient()
  const cleanPhone = phone.replace(/\D/g, '')
  const last8 = cleanPhone.slice(-8)
  const { data } = await supabase.from('contacts').select('name').ilike('phone', `%${last8}%`).limit(1).maybeSingle()
  return data?.name ?? null
}

// Busca contratos pelo nome do cliente/empresa — usado no picker de
// "vincular conversa não reconhecida a uma conta".
export async function searchContractsForLinking(query: string): Promise<{ id: string; label: string }[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('contracts')
    .select('id, title, client_name')
    .ilike('client_name', `%${query}%`)
    .limit(8)

  return (data ?? []).map((c) => ({ id: c.id, label: c.client_name || c.title }))
}

// Responder uma conversa AINDA NÃO vinculada — sem isso, o time fica
// de mãos atadas até alguém formalizar o vínculo, o que não é
// realista quando a pessoa está esperando resposta na hora.
export async function sendUnlinkedWhatsAppMessage(phone: string, message: string): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }
  if (!message.trim()) return { error: 'Escreva a mensagem.' }

  const creds = await getZApiCredentials()
  if (!creds) return { error: 'WhatsApp ainda não está conectado.' }

  try {
    const result = await sendZApiTextMessage({ ...creds, phone, message })
    await supabase.from('contract_whatsapp_messages').insert({
      contract_id: null,
      sent_by: user.id,
      direction: 'enviado',
      phone,
      message,
      zapi_message_id: result.messageId,
      status: 'enviado',
    })
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Falha ao enviar.'
    await supabase.from('contract_whatsapp_messages').insert({
      contract_id: null,
      sent_by: user.id,
      direction: 'enviado',
      phone,
      message,
      status: 'falhou',
      error_message: errorMsg,
    })
    return { error: errorMsg }
  }

  revalidatePath('/whatsapp')
  return {}
}
