import { createAdminClient } from '@/lib/supabase/admin'
import { NpsForm } from '@/components/nps/nps-form'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function NpsPublicPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const adminClient = createAdminClient()

  const { data: survey } = await adminClient
    .from('nps_surveys')
    .select('id, status, contract_id')
    .eq('token', token)
    .maybeSingle()

  let clientDisplayName = ''
  // CORREÇÃO: a pergunta do NPS precisa citar o nome da ORGANIZAÇÃO que
  // presta o serviço (ex: "ORBIS"), não o nome do cliente que está
  // respondendo — antes estava invertido.
  const { data: orgSettings } = await adminClient
    .from('organization_settings')
    .select('company_name, logo_storage_path, survey_bg_url')
    .eq('id', 'default')
    .maybeSingle()
  const organizationName = orgSettings?.company_name || 'nossa empresa'
  const rawLogo = orgSettings?.logo_storage_path
  const rawSurveyBg = (orgSettings as any)?.survey_bg_url
  const logoUrl = (rawLogo && rawLogo.trim() && rawLogo !== 'null')
    ? adminClient.storage.from('public-assets').getPublicUrl(rawLogo).data.publicUrl
    : null
  const surveyBgUrl = (rawSurveyBg && rawSurveyBg.startsWith('https://')) ? rawSurveyBg : null


  if (survey) {
    const { data: contract } = await adminClient
      .from('contracts')
      .select('client_name, company_id')
      .eq('id', survey.contract_id)
      .maybeSingle()

    clientDisplayName = contract?.client_name ?? ''

    if (contract?.company_id) {
      const { data: company } = await adminClient
        .from('companies')
        .select('name')
        .eq('id', contract.company_id)
        .maybeSingle()
      if (company?.name) clientDisplayName = company.name
    }
  }

  const GRADIENT = 'linear-gradient(to bottom right, #1B556B, #0D3B4C, #32AF9D)'
  const bgStyle = {
    minHeight: '100vh',
    backgroundImage: surveyBgUrl ? `url('${surveyBgUrl}'), ${GRADIENT}` : GRADIENT,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  }

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-start py-10" style={bgStyle}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 560, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {logoUrl && (
          <div style={{ width: 160, height: 48, backgroundImage: `url('${logoUrl}')`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', margin: '0 auto' }} />
        )}
      <div className="w-full rounded-2xl bg-white shadow-2xl p-8">
        {!survey ? (
          <p className="text-center text-sm text-gray-500">
            Este link de pesquisa não é válido. Se você acredita que isso é um erro, entre em contato com quem enviou o link.
          </p>
        ) : survey.status === 'answered' ? (
          <div className="text-center">
            <p className="text-lg font-medium text-gray-900">Obrigado!</p>
            <p className="mt-1 text-sm text-gray-500">Sua resposta a esta pesquisa já foi registrada anteriormente.</p>
          </div>
        ) : (
          <>
            {clientDisplayName && (
              <p className="mb-4 text-xs text-gray-400">Olá, {clientDisplayName}</p>
            )}
            <NpsForm token={token} companyName={organizationName} />
          </>
        )}
      </div>
      </div>
    </main>
  )
}
