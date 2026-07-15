'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidAccessToken, sendGmailMessage } from '@/lib/email/gmail'

export type ActionState = { error?: string }

export async function getConnectedEmailAccount(): Promise<{ email: string; connectedAt: string } | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase.from('email_accounts').select('email, connected_at').eq('user_id', user.id).maybeSingle()
  return data ? { email: data.email, connectedAt: data.connected_at } : null
}

export async function disconnectEmailAccount(): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  await supabase.from('email_accounts').delete().eq('user_id', user.id)
  revalidatePath('/settings')
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
  templateId: string | null
): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  if (!toEmail) return { error: 'Informe o e-mail do destinatário.' }

  const account = await getValidAccessToken(user.id)
  if (!account) {
    return { error: 'Você ainda não conectou seu Gmail. Vá em Configurações → E-mail e conecte antes de enviar.' }
  }

  try {
    const result = await sendGmailMessage({ accessToken: account.accessToken, to: toEmail, subject, htmlBody: body })

    await supabase.from('contract_emails').insert({
      contract_id: contractId,
      sent_by: user.id,
      from_email: account.fromEmail,
      to_email: toEmail,
      subject,
      body,
      template_id: templateId,
      triggered_automatically: false,
      gmail_message_id: result.messageId,
      status: 'enviado',
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
      from_email: account.fromEmail,
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
