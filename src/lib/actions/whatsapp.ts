'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { sendEvoTextMessage, sendEvoImageMessage, sendEvoDocumentMessage, verifyEvoConnection, getEvoQrCode, getEvoInstanceStatus, setEvoWebhook } from '@/lib/whatsapp/evolution'
import type { EvoCredentials } from '@/lib/whatsapp/evolution'
import { canSendAutomatedWhatsApp } from '@/lib/whatsapp/guardrails'

export type ActionState = { error?: string; message?: any }

async function getEvoCredentials(): Promise<EvoCredentials | null> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('organization_settings').select('evo_server_url, evo_api_key, evo_instance_name, evo_instance_token').eq('id', 'default').maybeSingle()
  if (!data?.evo_server_url || !data?.evo_api_key || !data?.evo_instance_name) return null
  return { serverUrl: data.evo_server_url, apiKey: data.evo_api_key, instanceName: data.evo_instance_name, instanceToken: (data as any).evo_instance_token ?? null }
}

export async function connectEvo(formData: FormData): Promise<ActionState> {
  if (!(await isCurrentUserAdmin())) return { error: 'Só administradores podem configurar isso.' }

  const serverUrl     = (formData.get('evo_server_url') as string)?.trim()
  const apiKey        = (formData.get('evo_api_key') as string)?.trim()
  const instanceName  = (formData.get('evo_instance_name') as string)?.trim()

  if (!serverUrl || !apiKey || !instanceName) return { error: 'Preencha Server URL, API Key e Instance Name.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('organization_settings')
    .update({ evo_server_url: serverUrl, evo_api_key: apiKey, evo_instance_name: instanceName, updated_at: new Date().toISOString() })
    .eq('id', 'default')

  if (error) return { error: error.message }

  // Configura webhook automaticamente
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-gestaocontratos-pi.vercel.app'}/api/whatsapp-inbound/evolution`
  const webhookRes = await setEvoWebhook({ serverUrl, apiKey, instanceName, webhookUrl })
  if (!webhookRes.ok) console.warn('[evo] webhook não configurado:', webhookRes.error)

  revalidatePath('/settings')
  return {}
}

// Server Action para obter QR Code — evita CORS (chamada server-side)
export async function getEvoQrCodeAction(): Promise<{ base64?: string; status?: string; error?: string }> {
  if (!(await isCurrentUserAdmin())) return { error: 'Acesso negado.' }
  const creds = await getEvoCredentials()
  if (!creds) return { error: 'Credenciais da Evolution API não configuradas.' }
  return getEvoQrCode(creds)
}

// Server Action para configurar webhook manualmente
export async function configureEvoWebhook(): Promise<ActionState> {
  if (!(await isCurrentUserAdmin())) return { error: 'Acesso negado.' }
  const creds = await getEvoCredentials()
  if (!creds) return { error: 'Credenciais não configuradas.' }
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-gestaocontratos-pi.vercel.app'}/api/whatsapp-inbound/evolution`
  const res = await setEvoWebhook({ ...creds, webhookUrl })
  if (!res.ok) return { error: `Erro ao configurar webhook: ${res.error}` }
  return {}
}

export async function disconnectEvo(): Promise<ActionState> {
  if (!(await isCurrentUserAdmin())) return { error: 'Só administradores podem configurar isso.' }
  const supabase = await createClient()
  await supabase
    .from('organization_settings')
    .update({ evo_server_url: null, evo_api_key: null, evo_instance_name: null })
    .eq('id', 'default')
  revalidatePath('/settings')
  return {}
}

export async function sendContractWhatsApp(contractId: string, phone: string, message: string, templateId: string | null, instanceName?: string | null): Promise<ActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }
  if (!phone) return { error: 'Informe o telefone do destinatário.' }
  if (!message.trim()) return { error: 'Escreva a mensagem.' }

  const creds = await getEvoCredentials()
  if (!creds) return { error: 'WhatsApp ainda não está conectado. Vá em Configurações e conecte o Z-API.' }

  // Busca nome e cargo para assinatura (igual à Central)
  const { data: profile } = await supabase.from('profiles').select('full_name, job_title').eq('id', user.id).maybeSingle()
  const senderName = profile?.full_name ?? null
  const jobTitle = (profile as any)?.job_title ?? null
  const signature = senderName
    ? (jobTitle ? `*${senderName} - ${jobTitle}:*` : `*${senderName}:*`)
    : null
  const signedMessage = signature ? `${signature} ${message}` : message

  const evoCreds = instanceName ? { ...creds, instanceName } : creds
  const usedInstance = instanceName ?? creds.instanceName

  const admin = createAdminClient()

  try {
    const result: any = await sendEvoTextMessage({ ...evoCreds, phone, message: signedMessage })
    console.log('[sendContractWhatsApp] evo ok:', result?.key?.id)

    // INSERT da mensagem
    const { data: inserted, error: insertErr } = await admin.from('contract_whatsapp_messages')
      .insert({
        contract_id: contractId,
        sent_by: user.id,
        sent_by_name: senderName,
        direction: 'enviado',
        phone,
        message: signedMessage,
        template_id: templateId,
        evo_message_id: result?.key?.id,
        instance_name: usedInstance,
        status: 'enviado',
      })
      .select()
      .single()

    if (insertErr) console.error('[sendContractWhatsApp] insert err:', insertErr.message)
    else console.log('[sendContractWhatsApp] mensagem inserida:', inserted?.id)

    // Desarquiva via adminClient — normaliza phone igual à sidebar
    const phoneForStatus = phone.replace(/\D/g, '')
    const { error: upsertErr } = await admin.from('whatsapp_conversation_status')
      .upsert({ phone: phoneForStatus, is_archived: false, updated_at: new Date().toISOString() }, { onConflict: 'phone' })

    if (upsertErr) console.error('[sendContractWhatsApp] ERRO UPDATE desarquivar:', upsertErr.message, '| phone:', phoneForStatus)
    else console.log('[sendContractWhatsApp] conversa desarquivada:', phoneForStatus)

    await admin.from('activities').insert({
      contract_id: contractId,
      user_id: user.id,
      type: 'whatsapp',
      content: `WhatsApp enviado para ${phone}.`,
      metadata: { kind: 'sent', phone, message },
    }).then(({ error: e }) => { if (e) console.warn('[sendContractWhatsApp] activity err:', e.message) })

    revalidatePath(`/contracts/${contractId}`)
    return { message: inserted }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Falha ao enviar WhatsApp.'
    console.error('[sendContractWhatsApp] CATCH:', errorMsg, '| phone:', phone)
    await admin.from('contract_whatsapp_messages').insert({
      contract_id: contractId,
      sent_by: user.id,
      sent_by_name: senderName,
      direction: 'enviado',
      phone,
      message: signedMessage,
      template_id: templateId,
      instance_name: usedInstance,
      status: 'falhou',
      error_message: errorMsg,
    })
    return { error: errorMsg }
  }
}

// Envio de imagem ou documento
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

  const creds = await getEvoCredentials()
  if (!creds) return { error: 'WhatsApp ainda não está conectado.' }

  try {
    const result: any =
      mediaType === 'image'
        ? await sendEvoImageMessage({ ...creds, phone, imageUrl: mediaUrl })
        : await sendEvoDocumentMessage({ ...creds, phone, documentUrl: mediaUrl, fileName: filename ?? 'documento' })

    await supabase.from('contract_whatsapp_messages').insert({
      contract_id: contractId,
      sent_by: user.id,
      direction: 'enviado',
      phone,
      message: mediaType === 'image' ? '[imagem]' : `[documento] ${filename ?? ''}`,
      media_url: mediaUrl,
      media_type: mediaType,
      media_filename: filename,
      zapi_message_id: result?.key?.id,
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
  const creds = await getEvoCredentials()
  if (!creds) return

  const filled = await buildWhatsAppFromTemplate(templateId, contractId)
  if (!filled?.phone) return

  const guard = await canSendAutomatedWhatsApp(filled.phone)
  if (!guard.ok) return

  try {
    const result: any = await sendEvoTextMessage({ ...creds, phone: filled.phone, message: filled.message })
    await supabase.from('contract_whatsapp_messages').insert({
      contract_id: contractId,
      direction: 'enviado',
      phone: filled.phone,
      message: filled.message,
      template_id: templateId,
      triggered_automatically: true,
      zapi_message_id: result?.key?.id,
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
    .is('lead_id', null)
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
  const { data, error } = await supabase
    .from('contract_whatsapp_messages')
    .update({ contract_id: contractId, unlinked_sender_name: null })
    .eq('phone', phone)
    .is('contract_id', null)
    .select('id')

  if (error) return { error: error.message }
  // Se não alterou nenhuma linha, algo está bloqueando silenciosamente
  // (ex: permissão de banco) — melhor avisar do que fingir que deu certo.
  if (!data || data.length === 0) return { error: 'Não consegui vincular — nenhuma mensagem foi atualizada. Tente de novo ou avise o suporte.' }

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
export async function sendUnlinkedWhatsAppMessage(phone: string, message: string, instanceName?: string): Promise<ActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }
  if (!message.trim()) return { error: 'Escreva a mensagem.' }

  const creds = await getEvoCredentials()
  if (!creds) return { error: 'WhatsApp ainda não está conectado.' }

  // Busca nome do atendente para assinatura
  const { data: profile } = await supabase.from('profiles').select('full_name, job_title').eq('id', user.id).maybeSingle()
  const senderName = profile?.full_name ?? null
  const jobTitle = (profile as any)?.job_title ?? null
  const signature = senderName
    ? (jobTitle ? `*${senderName} - ${jobTitle}:*` : `*${senderName}:*`)
    : null
  const signedMessage = signature ? `${signature} ${message}` : message

  // Usa a instância da conversa se disponível, senão usa a padrão
  const targetCreds = instanceName ? { ...creds, instanceName } : creds

  try {
    const result: any = await sendEvoTextMessage({ ...targetCreds, phone, message: signedMessage })

    // Desarquiva conversa se estava arquivada
    await supabase.from('whatsapp_conversation_status')
      .upsert({ phone, is_archived: false, updated_at: new Date().toISOString() }, { onConflict: 'phone' })

    await supabase.from('contract_whatsapp_messages').insert({
      contract_id: null,
      sent_by: user.id,
      sent_by_name: senderName,
      direction: 'enviado',
      phone,
      message: signedMessage,
      evo_message_id: result?.key?.id,
      status: 'enviado',
      instance_name: targetCreds.instanceName,
    })
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Falha ao enviar.'
    await supabase.from('contract_whatsapp_messages').insert({
      contract_id: null,
      sent_by: user.id,
      sent_by_name: senderName,
      direction: 'enviado',
      phone,
      message: signedMessage,
      status: 'falhou',
      error_message: errorMsg,
      instance_name: targetCreds.instanceName,
    })
    return { error: errorMsg }
  }

  revalidatePath('/whatsapp')
  return {}
}

// ------------------------------------------------------------
// Lembrete pra quem recebeu o link de Captação e não preencheu ainda
// — chamado pelo cron diário. Manda só UMA vez, 24h depois do
// primeiro contato, pra não ser inconveniente.
// ------------------------------------------------------------
export async function checkAndSendWhatsAppCaptureReminders(): Promise<{ checked: number; sent: number }> {
  const supabase = createAdminClient()

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: pending } = await supabase
    .from('whatsapp_capture_prompts')
    .select('phone')
    .is('lead_id', null)
    .is('reminder_sent_at', null)
    .lt('sent_at', oneDayAgo)

  if (!pending || pending.length === 0) return { checked: 0, sent: 0 }

  const creds = await getEvoCredentials()
  if (!creds) return { checked: pending.length, sent: 0 }

  const supabaseAdmin = supabase
  const { data: settings } = await supabaseAdmin.from('organization_settings').select('company_name, whatsapp_is_online, whatsapp_welcome_message, whatsapp_welcome_message_online, whatsapp_reminder_message').eq('id', 'default').maybeSingle()

  let sent = 0
  for (const p of pending) {
    const guard = await canSendAutomatedWhatsApp(p.phone)
    if (!guard.ok) continue

    const captureUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-gestaocontratos-pi.vercel.app'}/captura?phone=${encodeURIComponent(p.phone)}`
    const { buildReminderMessage } = await import('@/lib/whatsapp/guardrails')
    const reminderMessage = buildReminderMessage(settings ?? { company_name: null, whatsapp_is_online: false, whatsapp_welcome_message: null, whatsapp_welcome_message_online: null, whatsapp_reminder_message: null }, captureUrl)
    try {
      const result: any = await sendEvoTextMessage({ ...creds, phone: p.phone, message: reminderMessage })
      await supabase.from('contract_whatsapp_messages').insert({
        contract_id: null,
        direction: 'enviado',
        phone: p.phone,
        message: reminderMessage,
        triggered_automatically: true,
        zapi_message_id: result?.key?.id,
        status: 'enviado',
      })
      await supabase.from('whatsapp_capture_prompts').update({ reminder_sent_at: new Date().toISOString() }).eq('phone', p.phone)
      sent++
    } catch (e) {
      console.error(`Falha ao mandar lembrete de captação pra ${p.phone}:`, e)
    }
  }

  return { checked: pending.length, sent }
}

export async function getWhatsAppMessagesByLead(leadId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('contract_whatsapp_messages')
    .select('id, phone, message, direction, status, triggered_automatically, error_message, created_at, media_url, media_type, media_filename, sender_photo_url, delivery_status')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
  return data ?? []
}

// Busca uma conversa por telefone, direto — funciona tanto pra "sem
// vínculo nenhum" quanto "já é um lead" (ambas vivem fora de um
// contrato). Usado pela Central de Atendimento unificada.
export async function getConversationByPhone(phone: string): Promise<{
  messages: Awaited<ReturnType<typeof getUnlinkedMessagesByPhone>>
  leadId: string | null
  displayName: string | null
  manualName: string | null
}> {
  const supabase = createAdminClient()
  const cleanPhone = phone.replace(/\D/g, '')
  const last10 = cleanPhone.slice(-10)

  // Busca exata primeiro, depois ilike para cobrir variações de DDI
  let { data } = await supabase
    .from('contract_whatsapp_messages')
    .select('id, phone, message, direction, status, triggered_automatically, error_message, created_at, media_url, media_type, media_filename, sender_photo_url, delivery_status, lead_id, unlinked_sender_name, instance_name')
    .eq('phone', cleanPhone)
    .is('contract_id', null)
    .order('created_at', { ascending: true })
    .limit(500)

  // Se não encontrou, tenta match parcial (últimos 10 dígitos)
  if (!data?.length) {
    const res = await supabase
      .from('contract_whatsapp_messages')
      .select('id, phone, message, direction, status, triggered_automatically, error_message, created_at, media_url, media_type, media_filename, sender_photo_url, delivery_status, lead_id, unlinked_sender_name, instance_name')
      .ilike('phone', `%${last10}`)
      .is('contract_id', null)
      .order('created_at', { ascending: true })
      .limit(500)
    data = res.data
  }

  // Último fallback: sem filtro de contract_id (conversa pode ter sido vinculada)
  if (!data?.length) {
    const res = await supabase
      .from('contract_whatsapp_messages')
      .select('id, phone, message, direction, status, triggered_automatically, error_message, created_at, media_url, media_type, media_filename, sender_photo_url, delivery_status, lead_id, unlinked_sender_name, instance_name')
      .ilike('phone', `%${last10}`)
      .order('created_at', { ascending: true })
      .limit(500)
    data = res.data
  }

  console.log('[getConversationByPhone] phone:', cleanPhone, '| msgs:', data?.length ?? 0)

  const leadId = data?.find((m) => m.lead_id)?.lead_id ?? null

  // Busca configs de org numa só query
  const { data: orgData } = await supabase
    .from('organization_settings')
    .select('evo_instance_aliases, evo_instance_name, whatsapp_contact_names')
    .eq('id', 'default')
    .maybeSingle()

  const aliases = (orgData as any)?.evo_instance_aliases ?? {}
  const instanceLabels = new Set<string>([
    (orgData as any)?.evo_instance_name,
    ...Object.values(aliases).map((v: any) => typeof v === 'string' ? v : v?.label),
  ].filter(Boolean).map((s: string) => s.toLowerCase()))

  const contactNames = (orgData as any)?.whatsapp_contact_names ?? {}
  const manualName = contactNames[cleanPhone]
    ?? contactNames[last10]
    ?? contactNames[`55${last10}`]
    ?? null

  console.log('[getConversationByPhone] manualName:', manualName)

  if (manualName) return { messages: data ?? [], leadId, displayName: manualName, manualName }

  function isInstanceName(name: string | null): boolean {
    if (!name) return false
    return instanceLabels.has(name.toLowerCase())
  }

  // Pega o nome do remetente de mensagens RECEBIDAS
  let displayName = data
    ?.find((m) => (m as any).direction === 'recebido' && m.unlinked_sender_name && !isInstanceName(m.unlinked_sender_name))
    ?.unlinked_sender_name ?? null

  // Fallback para qualquer mensagem com nome, se nenhuma recebida tiver
  if (!displayName) {
    const candidate = data?.find((m) => m.unlinked_sender_name)?.unlinked_sender_name ?? null
    if (!isInstanceName(candidate)) displayName = candidate
  }

  if (leadId && !displayName) {
    const { data: lead } = await supabase.from('leads').select('name').eq('id', leadId).maybeSingle()
    displayName = lead?.name ?? null
  }

  return { messages: data ?? [], leadId, displayName, manualName: null }
}

// ------------------------------------------------------------
// Atribuição de conversa (sem contrato ainda) a um atendente — evita
// dois respondendo a mesma pessoa ao mesmo tempo.
// ------------------------------------------------------------
export type ConversationAssignment = { assigned_to: string; assigned_to_name: string; assigned_at: string }

export async function getWhatsAppAssignments(phones: string[]): Promise<Record<string, ConversationAssignment>> {
  if (phones.length === 0) return {}
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('whatsapp_conversation_assignments')
    .select('phone, assigned_to, assigned_at, profiles(full_name)')
    .in('phone', phones)

  const result: Record<string, ConversationAssignment> = {}
  for (const row of data ?? []) {
    result[row.phone] = { assigned_to: row.assigned_to, assigned_to_name: (row as any).profiles?.full_name ?? 'Alguém', assigned_at: row.assigned_at }
  }
  return result
}

export async function assignWhatsAppConversation(phone: string, userId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('whatsapp_conversation_assignments').upsert({ phone, assigned_to: userId, assigned_at: new Date().toISOString() })
  if (error) return { error: error.message }

  // Notifica o cliente sobre a transferência de forma assíncrona
  ;(async () => {
    try {
      const admin = createAdminClient()
      const [{ data: profile }, { data: org }] = await Promise.all([
        admin.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
        admin.from('organization_settings').select('evo_server_url, evo_api_key, evo_instance_name').eq('id', 'default').maybeSingle(),
      ])
      const nome = profile?.full_name ?? 'nossa equipe'
      if (org?.evo_server_url && org?.evo_api_key) {
        // Detecta a instância da última mensagem desse phone
        const { data: lastMsg } = await admin.from('contract_whatsapp_messages')
          .select('instance_name').eq('phone', phone).order('created_at', { ascending: false }).limit(1).maybeSingle()
        const instance = lastMsg?.instance_name ?? org.evo_instance_name
        await fetch(`${org.evo_server_url}/message/sendText/${instance}`, {
          method: 'POST',
          headers: { 'apikey': org.evo_api_key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: phone, text: `*Transferência de atendimento:* Aguarde um momento, vou transferir você para o(a) *${nome}*... 🔄` }),
        })
      }
    } catch (e) { console.warn('[assign] falha ao notificar transferência:', e) }
  })()

  revalidatePath('/whatsapp')
  return {}
}

export async function unassignWhatsAppConversation(phone: string): Promise<ActionState> {
  const supabase = await createClient()
  await supabase.from('whatsapp_conversation_assignments').delete().eq('phone', phone)
  revalidatePath('/whatsapp')
  return {}
}

// ------------------------------------------------------------
// Importa conversas que já existiam no WhatsApp ANTES de conectar o
// CRM — sem isso, o time só via o que chegasse a partir de hoje, e o
// histórico anterior ficava perdido, só no celular.
// ------------------------------------------------------------
export async function importExistingWhatsAppChats(): Promise<ActionState & { imported?: number; skipped?: number }> {
  if (!(await isCurrentUserAdmin())) return { error: 'Só administradores podem importar.' }

  const creds = await getEvoCredentials()
  if (!creds) return { error: 'WhatsApp ainda não está conectado.' }

  const supabase = createAdminClient()

  let chats: Array<{ phone: string; isGroup: boolean; name?: string }> = []
  try {
    // Evolution API não tem endpoint de "listar chats" como Z-API.
    // Buscamos os números únicos já recebidos via webhook no banco.
    const { data: msgs } = await supabase
      .from('contract_whatsapp_messages')
      .select('phone')
      .eq('direction', 'inbound')
      .not('phone', 'is', null)
    const uniquePhones = [...new Set((msgs ?? []).map((m: any) => m.phone))]
    chats = uniquePhones.map(phone => ({ phone, isGroup: false }))
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Falha ao buscar conversas do WhatsApp.' }
  }

  let imported = 0
  let skipped = 0

  for (const chat of chats) {
    if (chat.isGroup || !chat.phone) {
      skipped++
      continue
    }

    // Já existe alguma mensagem (de qualquer tipo) pra esse telefone?
    // Não duplica.
    const cleanPhone = chat.phone.replace(/\D/g, '')
    const { count } = await supabase
      .from('contract_whatsapp_messages')
      .select('id', { count: 'exact', head: true })
      .ilike('phone', `%${cleanPhone.slice(-8)}%`)

    if ((count ?? 0) > 0) {
      skipped++
      continue
    }

    // Vê se já bate com algum contato/contrato existente (mesma
    // lógica do webhook) — senão, entra como "não vinculada".
    const { data: matchingContacts } = await supabase.from('contacts').select('id, company_id').ilike('phone', `%${cleanPhone.slice(-8)}%`)
    let contractId: string | null = null
    if (matchingContacts && matchingContacts.length > 0) {
      const { data: exactLink } = await supabase.from('contract_contacts').select('contract_id').in('contact_id', matchingContacts.map((c) => c.id)).limit(1).maybeSingle()
      contractId = exactLink?.contract_id ?? null
    }

    await supabase.from('contract_whatsapp_messages').insert({
      contract_id: contractId,
      unlinked_sender_name: contractId ? null : chat.name,
      direction: 'recebido',
      phone: chat.phone,
      message: '[Conversa importada do WhatsApp — histórico anterior à conexão com o CRM]',
      status: 'enviado',
      created_at: (chat as any).lastMessageTime ? new Date(Number((chat as any).lastMessageTime) * 1000).toISOString() : new Date().toISOString(),
    })
    imported++
  }

  revalidatePath('/whatsapp')
  return { imported, skipped }
}

// ------------------------------------------------------------
// Configuração do "bot" — mensagens editáveis e status online/offline.
// ------------------------------------------------------------
export async function updateWhatsAppBotSettings(formData: FormData): Promise<ActionState> {
  if (!(await isCurrentUserAdmin())) return { error: 'Só administradores podem configurar isso.' }

  const whatsapp_is_online = formData.get('whatsapp_is_online') === 'on'
  const whatsapp_welcome_message = (formData.get('whatsapp_welcome_message') as string)?.trim() || null
  const whatsapp_welcome_message_online = (formData.get('whatsapp_welcome_message_online') as string)?.trim() || null
  const whatsapp_reminder_message = (formData.get('whatsapp_reminder_message') as string)?.trim() || null
  const whatsapp_daily_auto_limit = formData.get('whatsapp_daily_auto_limit') ? Number(formData.get('whatsapp_daily_auto_limit')) : 3

  const supabase = await createClient()
  const { error } = await supabase
    .from('organization_settings')
    .update({
      whatsapp_is_online,
      whatsapp_welcome_message,
      whatsapp_welcome_message_online,
      whatsapp_reminder_message,
      whatsapp_daily_auto_limit,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'default')

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return {}
}

// Toggle rápido de "estamos online" — separado da action geral pra
// poder ficar num botão de um clique só, sem precisar salvar o resto.
export async function toggleWhatsAppOnlineStatus(isOnline: boolean): Promise<ActionState> {
  if (!(await isCurrentUserAdmin())) return { error: 'Só administradores podem alterar isso.' }
  const supabase = await createClient()
  const { error } = await supabase.from('organization_settings').update({ whatsapp_is_online: isOnline }).eq('id', 'default')
  if (error) return { error: error.message }
  revalidatePath('/settings')
  revalidatePath('/whatsapp')
  return {}
}

// ---- Arquivamento de conversas ----
export async function archiveWhatsAppConversation(phone: string, instanceName?: string | null): Promise<ActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  await supabase.from('whatsapp_conversation_status').upsert({
    phone,
    is_archived: true,
    archived_at: new Date().toISOString(),
    archived_by: user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'phone' })

  // Envia mensagem de encerramento pelo mesmo número da conversa
  const creds = await getEvoCredentials()
  if (creds) {
    const targetCreds = instanceName ? { ...creds, instanceName } : creds
    try {
      // Busca mensagem personalizada da instância
      const { data: org } = await createAdminClient()
        .from('organization_settings').select('evo_instance_aliases').eq('id', 'default').maybeSingle()
      const aliases = (org as any)?.evo_instance_aliases ?? {}
      const instanceAlias = instanceName ? aliases[instanceName] : null
      const closingMsg = (typeof instanceAlias === 'object' ? instanceAlias?.closingMessage : null)
        ?? '*Atendimento finalizado.* Se precisar de mais alguma coisa, basta enviar uma nova mensagem por aqui! 😊'

      await sendEvoTextMessage({ ...targetCreds, phone, message: closingMsg })
    } catch { /* ignora falha no envio da mensagem de encerramento */ }
  }

  revalidatePath('/whatsapp')
  return {}
}

export async function unarchiveWhatsAppConversation(phone: string): Promise<void> {
  const admin = createAdminClient()
  await admin.from('whatsapp_conversation_status').upsert({
    phone,
    is_archived: false,
    archived_at: null,
    archived_by: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'phone' })
}

// ---- Salvar nome manual de contato não vinculado ----
export async function saveUnlinkedContactName(
  phone: string,
  name: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const admin = createAdminClient()
  const cleanPhone = phone.replace(/\D/g, '')
  const last10 = cleanPhone.slice(-10)
  const trimmed = name.trim() || null

  const { data: org } = await admin
    .from('organization_settings')
    .select('whatsapp_contact_names')
    .eq('id', 'default')
    .maybeSingle()

  const existing = (org as any)?.whatsapp_contact_names ?? {}
  // Salva em múltiplos formatos para garantir que a busca encontre
  existing[cleanPhone] = trimmed
  existing[last10] = trimmed
  if (!cleanPhone.startsWith('55') && cleanPhone.length >= 10) {
    existing[`55${cleanPhone}`] = trimmed
  }

  await admin.from('organization_settings')
    .update({ whatsapp_contact_names: existing })
    .eq('id', 'default')

  revalidatePath('/whatsapp')
  return {}
}

// ---- Excluir mensagem ----
export async function deleteWhatsAppMessage(
  messageId: string,
  phone: string,
  zApiMessageId?: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const admin = createAdminClient()
  await admin.from('contract_whatsapp_messages').delete().eq('id', messageId)

  // Tenta apagar na Evolution API também
  if (zApiMessageId) {
    try {
      const { data: org } = await admin
        .from('organization_settings')
        .select('evo_server_url, evo_api_key, evo_instance_name')
        .eq('id', 'default').maybeSingle()

      if (org?.evo_server_url) {
        const cleanPhone = phone.replace(/\D/g, '')
        await fetch(`${org.evo_server_url}/chat/deleteMessage/${org.evo_instance_name}`, {
          method: 'DELETE',
          headers: { apikey: org.evo_api_key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ remoteJid: `${cleanPhone}@s.whatsapp.net`, id: zApiMessageId, fromMe: true }),
        })
      }
    } catch (e) { console.warn('[deleteMessage] Evolution API:', e) }
  }

  revalidatePath('/whatsapp')
  return {}
}

// ---- Excluir conversa inteira ----
export async function deleteWhatsAppConversation(phone: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const admin = createAdminClient()
  const cleanPhone = phone.replace(/\D/g, '')

  await Promise.all([
    admin.from('contract_whatsapp_messages').delete().ilike('phone', `%${cleanPhone.slice(-10)}`),
    admin.from('whatsapp_conversation_status').delete().ilike('phone', `%${cleanPhone.slice(-10)}`),
  ])

  revalidatePath('/whatsapp')
  return {}
}
