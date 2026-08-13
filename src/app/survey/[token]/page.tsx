import { createAdminClient } from '@/lib/supabase/admin'
import { CustomSurveyForm } from '@/components/surveys/custom-survey-form'
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
    .select('company_name, logo_storage_path, survey_bg_url')
    .eq('id', 'default')
    .maybeSingle()

  const rawLogo = orgSettings?.logo_storage_path
  const rawSurveyBg = (orgSettings as any)?.survey_bg_url
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
        {logoUrl && (
          <div style={{ width: 160, height: 48, backgroundImage: `url('${logoUrl}')`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', margin: '0 auto' }} />
        )}
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
              <h1 className="mb-4 text-base font-medium text-gray-900">{templateName}</h1>
              <CustomSurveyForm token={token} questions={questions} />
            </>
          )}
        </div>
      </div>
    </main>
    </div>
  )
}
