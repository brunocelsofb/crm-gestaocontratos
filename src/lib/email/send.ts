// Ponto único de envio de e-mail — decide sozinho se usa Gmail (OAuth)
// ou SMTP, dependendo de como a pessoa conectou a conta.

import { createAdminClient } from '@/lib/supabase/admin'
import { getValidAccessToken, sendGmailMessage } from '@/lib/email/gmail'
import { sendSmtpMessage } from '@/lib/email/smtp'

export type EmailAccountInfo = { connectionType: 'oauth_google' | 'smtp'; fromEmail: string }

export async function getEmailAccountInfo(userId: string): Promise<EmailAccountInfo | null> {
  const supabase = createAdminClient()
  const { data: account } = await supabase.from('email_accounts').select('connection_type, email').eq('user_id', userId).maybeSingle()
  if (!account) return null
  return { connectionType: account.connection_type, fromEmail: account.email }
}

export async function sendEmailForUser(
  userId: string,
  to: string,
  subject: string,
  htmlBody: string
): Promise<{ messageId: string; fromEmail: string }> {
  const supabase = createAdminClient()
  const { data: account } = await supabase.from('email_accounts').select('*').eq('user_id', userId).maybeSingle()
  if (!account) throw new Error('Conta de e-mail não conectada.')

  if (account.connection_type === 'smtp') {
    if (!account.smtp_host || !account.smtp_port || !account.smtp_username || !account.smtp_password) {
      throw new Error('Configuração SMTP incompleta.')
    }
    const result = await sendSmtpMessage({
      config: {
        host: account.smtp_host,
        port: account.smtp_port,
        username: account.smtp_username,
        password: account.smtp_password,
        secure: account.smtp_secure,
      },
      fromEmail: account.email,
      to,
      subject,
      htmlBody,
    })
    return { messageId: result.messageId, fromEmail: account.email }
  }

  const oauthAccount = await getValidAccessToken(userId)
  if (!oauthAccount) throw new Error('Conta Gmail não conectada ou token inválido.')
  const result = await sendGmailMessage({ accessToken: oauthAccount.accessToken, to, subject, htmlBody })
  return { messageId: result.messageId, fromEmail: oauthAccount.fromEmail }
}
