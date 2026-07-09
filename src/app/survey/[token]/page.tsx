import { createAdminClient } from '@/lib/supabase/admin'
import { CustomSurveyForm } from '@/components/surveys/custom-survey-form'
import type { Question } from '@/lib/actions/custom-surveys'

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
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
  )
}
