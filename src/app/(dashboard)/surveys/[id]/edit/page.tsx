import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { SurveyTemplateForm } from '@/components/surveys/survey-template-form'
import type { Question } from '@/lib/actions/custom-surveys'

export default async function EditSurveyTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: template }, { data: tags }] = await Promise.all([
    supabase.from('survey_templates').select('id, name, questions, tag_id').eq('id', id).maybeSingle(),
    supabase.from('tags').select('id, name, color').order('name'),
  ])

  if (!template) notFound()

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-lg font-semibold text-gray-900">Editar Formulário</h1>
      <SurveyTemplateForm
        tags={tags ?? []}
        initial={{
          id: template.id,
          name: template.name,
          questions: (template.questions ?? []) as Question[],
          tagId: template.tag_id,
        }}
      />
    </div>
  )
}
