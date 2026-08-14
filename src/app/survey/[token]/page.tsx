import { createAdminClient } from '@/lib/supabase/admin'
import { CustomSurveyForm } from '@/components/surveys/custom-survey-form'
import { LogoBadge } from '@/components/ui/logo-badge'
import type { Question } from '@/lib/actions/custom-surveys'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CustomSurveyPublicPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const adminClient = createAdminClient()

  const { data: survey } = await adminClient
    .from('custom_surveys')
    .select('id, status, template_id')
    .eq('token', token)
    .maybeSingle()

  let templateName = ''
  let questions: Question[] = []

  if (survey) {
    const { data: template } = await adminClient
      .from('survey_templates')
      .select('name, questions')
      .eq('id', survey.template_id)
      .maybeSingle()
    templateName = template?.name ?? ''
    questions = (template?.questions ?? []) as Question[]
  }

  const { data: orgSettings } = await adminClient
    .from('organization_settings')
    .select('company_name, logo_storage_path, survey_clinica_bg_url, survey_hospitalar_bg_url')
    .eq('id', 'default')
    .maybeSingle()

  const rawLogo = orgSettings?.logo_storage_path
  let finalLogoUrl: string | null = null
  if (rawLogo && rawLogo.trim() && rawLogo !== 'null') {
    if (rawLogo.startsWith('http')) { finalLogoUrl = rawLogo }
    else { const { data } = adminClient.storage.from('public-assets').getPublicUrl(rawLogo); finalLogoUrl = data.publicUrl }
  }
  const isHospitalar = templateName.toLowerCase().includes('hospitalar') || templateName.toLowerCase().includes('predial')
  const rawSurveyBg = isHospitalar
    ? (orgSettings as any)?.survey_hospitalar_bg_url
    : (orgSettings as any)?.survey_clinica_bg_url
  const logoUrl = (rawLogo && rawLogo.trim() && rawLogo !== 'null')
    ? adminClient.storage.from('public-assets').getPublicUrl(rawLogo).data.publicUrl
    : null
  const surveyBgUrl = (rawSurveyBg && rawSurveyBg.startsWith('https://')) ? rawSurveyBg : null

  const bgStyle = {
    minHeight: '100vh',
    backgroundImage: surveyBgUrl ? `url('${surveyBgUrl}')` : undefined,
    backgroundColor: '#1B556B',
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
  }

  return (
    <div className="relative min-h-screen w-full">
      {/* Camada de fundo congelada */}
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          backgroundImage: surveyBgUrl ? `url('${surveyBgUrl}')` : undefined,
          backgroundColor: '#1B556B',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      {/* Overlay */}
      <div className="fixed inset-0 pointer-events-none -z-10" style={{ background: 'rgba(0,0,0,0.2)' }} />
      <main className="min-h-screen w-full flex flex-col items-center justify-start py-10 px-4">
        <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="w-full border-b-4 border-[#E98C5F] pb-4 mb-6 flex flex-col md:flex-row items-center md:items-end justify-between gap-4">
              <div className="flex-shrink-0"><LogoBadge src={finalLogoUrl ?? undefined} /></div>
              <div className="text-center md:text-left">
                <h1 className="text-xl md:text-2xl font-bold text-[#1B556B]">{templateName || 'Pesquisa de Satisfação'}</h1>
                <p className="text-xs md:text-sm font-medium text-[#32AF9D] mt-1">Avalie nossos serviços de engenharia clínica e predial. Sua opinião é fundamental.</p>
              </div>
            </div>
        <div className="w-full rounded-2xl bg-white shadow-2xl p-8">
          {!survey ? (
            <p className="text-center text-sm text-gray-500">
              Este link não é válido. Se você acredita que isso é um erro, entre em contato com quem enviou o link.
            </p>
          ) : survey.status === 'answered' ? (
            <div className="text-center">
              <p className="text-lg font-medium text-gray-900">Obrigado!</p>
              <p className="mt-1 text-sm text-gray-500">Suas respostas já foram registradas anteriormente.</p>
            </div>
          ) : (
            <>

              <CustomSurveyForm token={token} questions={questions} />
            </>
          )}
        </div>
      </div>
    </main>
    </div>
  )
}
