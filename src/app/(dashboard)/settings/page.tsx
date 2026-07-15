import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth/role'
import { OrganizationSettingsForm } from '@/components/settings/organization-settings-form'
import { NumberingSettingsForm } from '@/components/settings/numbering-settings-form'
import { EmailConnectionSettings } from '@/components/settings/email-connection-settings'
import { getConnectedEmailAccount } from '@/lib/actions/email'

export default async function SettingsPage() {
  const profile = await getCurrentProfile()
  if (profile?.role !== 'admin') redirect('/')

  const supabase = await createClient()
  const { data: settings } = await supabase
    .from('organization_settings')
    .select('name, company_name, logo_storage_path, proposal_header_text, proposal_footer_text, proposal_brand_color, assistant_monthly_budget_usd, ticket_number_prefix, proposal_number_prefix')
    .eq('id', 'default')
    .maybeSingle()

  const connectedAccount = await getConnectedEmailAccount()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Configurações</h1>
        <p className="mt-0.5 text-sm text-gray-500">Configurações gerais da organização.</p>
      </div>
      <OrganizationSettingsForm
        currentName={settings?.name ?? 'Contract CRM'}
        currentCompanyName={settings?.company_name ?? ''}
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
      <Suspense fallback={null}>
        <EmailConnectionSettings connectedEmail={connectedAccount?.email ?? null} connectedAt={connectedAccount?.connectedAt ?? null} />
      </Suspense>
    </div>
  )
}
