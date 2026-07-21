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

const CONFIG_SECTIONS = [
  {
    title: 'Oportunidades',
    items: [
      { href: '/pipelines', label: 'Funis e Etapas', description: 'Configure os funis e as etapas do seu processo de vendas' },
      { href: '/settings/campos-oportunidade', label: 'Campos por Funil', description: 'Defina quais campos são obrigatórios/opcionais em cada funil' },
      { href: '/settings/motivos-perda', label: 'Motivos de Perda', description: 'Cadastre os motivos de perda que aparecem no dashboard de gestão à vista' },
      { href: '/custom-fields', label: 'Campos Customizados', description: 'Adicione campos personalizados às oportunidades' },
      { href: '/automations', label: 'Automações', description: 'Regras automáticas por gatilho ou tempo' },
      { href: '/tags', label: 'Tags', description: 'Organize e classifique com etiquetas' },
    ],
  },
  {
    title: 'Comunicação',
    items: [
      { href: '/email-templates', label: 'Templates de E-mail', description: 'Modelos de e-mail e WhatsApp pré-configurados' },
      { href: '/proposals/templates', label: 'Modelos de Proposta', description: 'Templates de proposta comercial' },
      { href: '/proposals/catalog', label: 'Catálogo de Produtos', description: 'Produtos e serviços disponíveis nas propostas' },
    ],
  },
  {
    title: 'Pesquisas',
    items: [
      { href: '/surveys', label: 'Formulários', description: 'Formulários de pesquisa e coleta de dados' },
    ],
  },
  {
    title: 'Assinatura Digital',
    items: [
      { href: '/zapsign', label: 'Modelos ZapSign', description: 'Modelos de contrato e aditivo para assinatura digital' },
    ],
  },
  {
    title: 'Conta e Acesso',
    items: [
      { href: '/users', label: 'Usuários', description: 'Gerencie os membros da equipe e suas permissões' },
      { href: '/minha-conta', label: 'Minha Conta', description: 'Seus dados pessoais, foto e assinatura de e-mail' },
    ],
  },
]

export default async function SettingsPage() {
  const profile = await getCurrentProfile()
  if (profile?.role !== 'admin') redirect('/')

  const supabase = await createClient()
  const { data: settings } = await supabase
    .from('organization_settings')
    .select('name, company_name, company_cnpj, logo_storage_path, proposal_header_text, proposal_footer_text, proposal_brand_color, assistant_monthly_budget_usd, ticket_number_prefix, proposal_number_prefix, inbound_email_domain, mailgun_webhook_signing_key, zapi_instance_id, whatsapp_is_online, whatsapp_welcome_message, whatsapp_welcome_message_online, whatsapp_reminder_message, whatsapp_daily_auto_limit, zapsign_api_token')
    .eq('id', 'default')
    .maybeSingle()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Configurações</h1>
        <p className="mt-0.5 text-sm text-gray-500">Central de configuração da plataforma ORBIS CRM.</p>
      </div>

      {/* Atalhos pra telas de configuração específicas */}
      <div className="space-y-6">
        {CONFIG_SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{section.title}</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg border border-gray-200 bg-white p-3 hover:border-brand-300 hover:bg-brand-50 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{item.description}</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Configurações que ficam aqui mesmo (formulários inline) */}
      <div className="border-t border-gray-200 pt-6 space-y-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Configurações Gerais</h2>
        <OrganizationSettingsForm
          currentName={settings?.name ?? 'Contract CRM'}
          currentCompanyName={settings?.company_name ?? ''}
          currentCompanyCnpj={settings?.company_cnpj ?? ''}
          currentLogoPath={settings?.logo_storage_path ?? null}
          currentHeaderText={settings?.proposal_header_text ?? ''}
          currentFooterText={settings?.proposal_footer_text ?? ''}
          currentBrandColor={settings?.proposal_brand_color ?? '#1e3a5f'}
          currentAssistantBudget={settings?.assistant_monthly_budget_usd ?? 10}
        />
        <NumberingSettingsForm
          currentTicketPrefix={settings?.ticket_number_prefix ?? 'TK'}
          currentProposalPrefix={settings?.proposal_number_prefix ?? 'P'}
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

        <form method="POST" action="/api/zapsign/save-token" className="space-y-3 rounded-lg border border-gray-200 bg-white p-6">
          <div>
            <h3 className="text-sm font-medium text-gray-900">✍️ ZapSign — Assinatura Digital</h3>
            <p className="mt-0.5 text-xs text-gray-400">
              Token da API do ZapSign (em <a href="https://app.zapsign.com.br/conta/integracoes" target="_blank" rel="noopener noreferrer" className="underline">app.zapsign.com.br → Integrações → API ZAPSIGN</a>).
            </p>
          </div>
          {settings?.zapsign_api_token
            ? <p className="text-sm text-positive-700">✅ Token configurado</p>
            : <p className="text-xs text-yellow-700">⚠️ Não configurado ainda.</p>
          }
          <div>
            <label className="block text-xs text-gray-500">API Token</label>
            <input name="zapsign_api_token" type="password" placeholder={settings?.zapsign_api_token ? '••••••••' : 'Cole o token aqui'} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm font-mono focus:border-brand-700 focus:outline-none" />
          </div>
          <button type="submit" className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800">Salvar</button>
        </form>
      </div>

      <p className="text-xs text-gray-400">
        Conectar seu Gmail e configurar sua assinatura de e-mail fica em{' '}
        <Link href="/minha-conta" className="text-brand-700 hover:underline">Minha Conta</Link> — é pessoal, não de organização.
      </p>
    </div>
  )
}
