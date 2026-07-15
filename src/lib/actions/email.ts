'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmailForUser, getEmailAccountInfo, wrapEmailHtml } from '@/lib/email/send'
import { verifySmtpConnection } from '@/lib/email/smtp'

export type ActionState = { error?: string }

export async function getConnectedEmailAccount(): Promise<{ email: string; connectedAt: string; connectionType: string } | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase.from('email_accounts').select('email, connected_at, connection_type').eq('user_id', user.id).maybeSingle()
  return data ? { email: data.email, connectedAt: data.connected_at, connectionType: data.connection_type } : null
}

// ------------------------------------------------------------
// Conexão via SMTP — alternativa ao Gmail, pra quem usa outro
// provedor de e-mail (Outlook, corporativo próprio, etc).
// ------------------------------------------------------------
export async function connectSmtpAccount(formData: FormData): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  const email = (formData.get('email') as string)?.trim()
  const host = (formData.get('smtp_host') as string)?.trim()
  const port = Number(formData.get('smtp_port'))
  const username = (formData.get('smtp_username') as string)?.trim()
  const password = (formData.get('smtp_password') as string)
  const secure = formData.get('smtp_secure') === 'on'

  if (!email || !host || !port || !username || !password) {
    return { error: 'Preencha todos os campos (e-mail, servidor, porta, usuário e senha).' }
  }

  // Testa a conexão ANTES de salvar — evita salvar uma configuração
  // que não funciona e só descobrir isso na hora de mandar de verdade.
  const verify = await verifySmtpConnection({ host, port, username, password, secure })
  if (!verify.ok) return { error: `Não consegui conectar: ${verify.error}` }

  const adminClient = createAdminClient()
  const { error } = await adminClient.from('email_accounts').upsert(
    {
      user_id: user.id,
      email,
      connection_type: 'smtp',
      smtp_host: host,
      smtp_port: port,
      smtp_username: username,
      smtp_password: password,
      smtp_secure: secure,
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (error) return { error: error.message }

  revalidatePath('/minha-conta')
  return {}
}

export async function disconnectEmailAccount(): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  await supabase.from('email_accounts').delete().eq('user_id', user.id)
  revalidatePath('/settings')
  revalidatePath('/minha-conta')
  return {}
}

// ------------------------------------------------------------
// Assinatura de e-mail — pessoal, cada usuário tem a sua, anexada
// automaticamente no fim de todo e-mail que a pessoa enviar.
// ------------------------------------------------------------
export async function getEmailSignature(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return ''

  const { data } = await supabase.from('profiles').select('email_signature').eq('id', user.id).maybeSingle()
  return data?.email_signature ?? ''
}

export async function updateEmailSignature(signature: string): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  const { error } = await supabase.from('profiles').update({ email_signature: signature }).eq('id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/minha-conta')
  return {}
}

// ------------------------------------------------------------
// Templates de e-mail
// ------------------------------------------------------------
export async function createEmailTemplate(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  const name = (formData.get('name') as string)?.trim()
  const subject = (formData.get('subject') as string)?.trim()
  const body = (formData.get('body') as string)?.trim()
  const trigger_stage_id = (formData.get('trigger_stage_id') as string) || null

  if (!name || !subject || !body) return { error: 'Preencha nome, assunto e corpo do e-mail.' }

  const { error } = await supabase.from('email_templates').insert({ name, subject, body, trigger_stage_id, created_by: user.id })
  if (error) return { error: error.message }

  revalidatePath('/email-templates')
  return {}
}

export async function deleteEmailTemplate(templateId: string) {
  const supabase = createAdminClient()
  await supabase.from('email_templates').delete().eq('id', templateId)
  revalidatePath('/email-templates')
}

function fillTemplateVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

// ------------------------------------------------------------
// Envio de e-mail — manual ou automático. Sempre pela conta Gmail de
// quem enviou — se não tiver conectado, não tem como enviar.
// ------------------------------------------------------------
export async function sendContractEmail(
  contractId: string,
  toEmail: string,
  subject: string,
  body: string,
  templateId: string | null,
  ccEmail: string | null,
  bccEmail: string | null
): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  if (!toEmail) return { error: 'Informe o e-mail do destinatário.' }

  const accountInfo = await getEmailAccountInfo(user.id)
  if (!accountInfo) {
    return { error: 'Você ainda não conectou nenhum e-mail (Gmail ou SMTP). Vá em Minha Conta e conecte antes de enviar.' }
  }

  const { data: profile } = await supabase.from('profiles').select('email_signature').eq('id', user.id).maybeSingle()

  // Reply-To pro endereço exclusivo da conta — é ISSO que faz a
  // resposta do cliente cair automaticamente no CRM (não é CC nem
  // CCO, que não seguem numa resposta). Inclui TAMBÉM o e-mail real de
  // quem mandou, separado por vírgula — sem isso, a resposta ia SÓ
  // pro endereço de rastreamento, sumindo da caixa pessoal de quem
  // enviou (Reply-To substitui, não soma, então precisa listar os dois).
  const { data: contractForReply } = await supabase.from('contracts').select('inbound_email_code').eq('id', contractId).maybeSingle()
  const { data: orgSettings } = await supabase.from('organization_settings').select('inbound_email_domain').eq('id', 'default').maybeSingle()
  const trackingAddress =
    orgSettings?.inbound_email_domain && contractForReply?.inbound_email_code
      ? `${contractForReply.inbound_email_code}@${orgSettings.inbound_email_domain}`
      : null
  const { data: senderAccount } = await supabase.from('email_accounts').select('email').eq('user_id', user.id).maybeSingle()
  const replyTo = trackingAddress
    ? senderAccount?.email
      ? `${senderAccount.email}, ${trackingAddress}`
      : trackingAddress
    : undefined

  // Cria o registro ANTES de enviar, pra já ter o token do pixel de
  // rastreamento de abertura embutido no corpo do e-mail.
  const trackingToken = crypto.randomUUID()
  const trackingPixelUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-gestaocontratos-pi.vercel.app'}/api/email-track/${trackingToken}`
  const trackingPixelHtml = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none" alt="" />`
  const bodyWithExtras = wrapEmailHtml(body, profile?.email_signature ?? null, trackingPixelHtml)

  try {
    const result = await sendEmailForUser(user.id, toEmail, subject, bodyWithExtras, { cc: ccEmail ?? undefined, bcc: bccEmail ?? undefined, replyTo })

    await supabase.from('contract_emails').insert({
      contract_id: contractId,
      sent_by: user.id,
      from_email: result.fromEmail,
      to_email: toEmail,
      cc_email: ccEmail,
      bcc_email: bccEmail,
      subject,
      body,
      template_id: templateId,
      triggered_automatically: false,
      gmail_message_id: result.messageId,
      status: 'enviado',
      tracking_token: trackingToken,
    })

    await supabase.from('activities').insert({
      contract_id: contractId,
      user_id: user.id,
      type: 'system',
      content: `E-mail enviado pra ${toEmail}: "${subject}".`,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Falha ao enviar e-mail.'
    await supabase.from('contract_emails').insert({
      contract_id: contractId,
      sent_by: user.id,
      from_email: accountInfo.fromEmail,
      to_email: toEmail,
      subject,
      body,
      template_id: templateId,
      status: 'falhou',
      error_message: message,
    })
    return { error: message }
  }

  revalidatePath(`/contracts/${contractId}`)
  return {}
}

export async function buildEmailFromTemplate(
  templateId: string,
  contractId: string
): Promise<{ subject: string; body: string; toEmail: string | null } | null> {
  const supabase = createAdminClient()

  const { data: template } = await supabase.from('email_templates').select('subject, body').eq('id', templateId).maybeSingle()
  if (!template) return null

  const { data: contract } = await supabase.from('contracts').select('*').eq('id', contractId).maybeSingle()
  if (!contract) return null

  const { data: company } = contract.company_id
    ? await supabase.from('companies').select('name, trade_name').eq('id', contract.company_id).maybeSingle()
    : { data: null }
  const { data: contact } = contract.contact_id
    ? await supabase.from('contacts').select('name, email').eq('id', contract.contact_id).maybeSingle()
    : { data: null }

  const vars = {
    cliente: contract.client_name ?? '',
    empresa: company?.name ?? contract.client_name ?? '',
    contato: contact?.name ?? '',
    processo: contract.process_number ?? '',
  }

  return {
    subject: fillTemplateVariables(template.subject, vars),
    body: fillTemplateVariables(template.body, vars),
    toEmail: contact?.email ?? null,
  }
}
