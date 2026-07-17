import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth/role'
import { OrganizationSettingsForm } from '@/components/settings/organization-settings-form'
import { NumberingSettingsForm } from '@/components/settings/numbering-settings-form'
import { InboundEmailSettingsForm } from '@/components/settings/inbound-email-settings-form'
import { WhatsAppSettingsForm } from '@/components/settings/whatsapp-settings-form'
import { WhatsAppBotSettingsForm } from '@/components/settings/whatsapp-bot-settings-form'
import { DEFAULT_WELCOME_OFFLINE, DEFAULT_WELCOME_ONLINE, DEFAULT_REMINDER } from '@/lib/whatsapp/guardrails'

export default async function SettingsPage() {
  const profile = await getCurrentProfile()
  if (profile?.role !== 'admin') redirect('/')

  const supabase = await createClient()
  const { data: settings } = await supabase
    .from('organization_settings')
    .select('name, company_name, company_cnpj, logo_storage_path, proposal_header_text, proposal_footer_text, proposal_brand_color, assistant_monthly_budget_usd, ticket_number_prefix, proposal_number_prefix, inbound_email_domain, mailgun_webhook_signing_key, zapi_instance_id, whatsapp_is_online, whatsapp_welcome_message, whatsapp_welcome_message_online, whatsapp_reminder_message, whatsapp_daily_auto_limit')
    .eq('id', 'default')
    .maybeSingle()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Configurações</h1>
        <p className="mt-0.5 text-sm text-gray-500">Configurações gerais da organização.</p>
      </div>
      <OrganizationSettingsForm
        currentName={settings?.name ?? 'Contract CRM'}
        currentCompanyName={settings?.company_name ?? ''}
        currentCompanyCnpj={settings?.company_cnpj ?? ''}
        currentLogoPath={settings?.logo_storage_path ?? null}
        currentHeaderText={settings?.proposal_header_text ?? ''}
        currentFooterText={settings?.proposal_footer_text ?? ''}
        currentBrandColor={settings?.proposal_brand_color ?? '#1B556B'}
        currentAssistantBudget={settings?.assistant_monthly_budget_usd ?? 10}
      />
      <NumberingSettingsForm
        currentTicketPrefix={settings?.ticket_number_prefix ?? 'TICKET'}
        currentProposalPrefix={settings?.proposal_number_prefix ?? 'PROP'}
      />
      <InboundEmailSettingsForm
        currentDomain={settings?.inbound_email_domain ?? ''}
        hasSigningKey={!!settings?.mailgun_webhook_signing_key}
      />
      <WhatsAppSettingsForm isConnected={!!settings?.zapi_instance_id} />
      <WhatsAppBotSettingsForm
        isOnline={settings?.whatsapp_is_online ?? false}
        welcomeMessage={settings?.whatsapp_welcome_message ?? DEFAULT_WELCOME_OFFLINE}
        welcomeMessageOnline={settings?.whatsapp_welcome_message_online ?? DEFAULT_WELCOME_ONLINE}
        reminderMessage={settings?.whatsapp_reminder_message ?? DEFAULT_REMINDER}
        dailyLimit={settings?.whatsapp_daily_auto_limit ?? 3}
      />
      <p className="text-xs text-gray-400">
        Conectar seu Gmail e configurar sua assinatura de e-mail agora fica em{' '}
        <Link href="/minha-conta" className="text-brand-700 hover:underline">Minha Conta</Link> — é pessoal, não de organização.
      </p>
    </div>
  )
}
